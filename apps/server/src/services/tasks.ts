import type { AgentRepo, TaskRepo, MessageRepo, SettingsRepo } from '../db/repos';
import type { AgentLoopDeps } from './agentLoop';
import { wakeAgent } from './agentLoop';

export class TaskRunner {
  private queue: string[] = [];
  private active = 0;
  private concurrency = 2;

  constructor(
    private tasks: TaskRepo,
    private agents: AgentRepo,
    private loopDeps: AgentLoopDeps,
    private messages?: MessageRepo,
    private settings?: SettingsRepo
  ) {
    this.refreshConcurrency();
  }

  refreshConcurrency(): void {
    const n = this.settings?.getAll().taskConcurrency ?? 2;
    this.concurrency = Math.max(1, Math.min(8, Number(n) || 2));
  }

  enqueue(
    agentId: string,
    prompt: string,
    opts?: { parentTaskId?: string; postToChat?: boolean }
  ) {
    this.refreshConcurrency();
    const task = this.tasks.create(agentId, prompt, opts);
    this.queue.push(task.id);
    void this.pump();
    return task;
  }

  private async pump(): Promise<void> {
    while (this.queue.length && this.active < this.concurrency) {
      const id = this.queue.shift()!;
      this.active++;
      void this.runOne(id).finally(() => {
        this.active--;
        void this.pump();
      });
    }
  }

  private async runOne(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;
    const agent = this.agents.get(task.agentId);
    if (!agent) {
      this.tasks.update(id, {
        status: 'error',
        error: 'Agent not found',
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    this.tasks.update(id, { status: 'running' });
    try {
      const result = await wakeAgent(
        agent,
        `[Background task]\n${task.prompt}`,
        this.loopDeps
      );
      const text = result || '(empty)';
      this.tasks.update(id, {
        status: 'done',
        result: text,
        finishedAt: new Date().toISOString(),
      });

      // Auto-post task result into agent chat thread
      if (task.postToChat !== false && this.messages) {
        const notify = agent.notifyOnUpdates !== false;
        if (notify) {
          this.messages.add({
            agentId: agent.id,
            role: 'system',
            content: `[Task ${id.slice(0, 8)} done]\n${text.slice(0, 4000)}`,
            kind: 'system',
          });
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.tasks.update(id, {
        status: 'error',
        error: err,
        finishedAt: new Date().toISOString(),
      });
      if (task.postToChat !== false && this.messages) {
        this.messages.add({
          agentId: agent.id,
          role: 'system',
          content: `[Task ${id.slice(0, 8)} error] ${err}`,
          kind: 'system',
        });
      }
    }
  }
}
