import type { AgentRepo, TaskRepo } from '../db/repos';
import type { AgentLoopDeps } from './agentLoop';
import { wakeAgent } from './agentLoop';

export class TaskRunner {
  private queue: string[] = [];
  private running = false;

  constructor(
    private tasks: TaskRepo,
    private agents: AgentRepo,
    private loopDeps: AgentLoopDeps
  ) {}

  enqueue(agentId: string, prompt: string) {
    const task = this.tasks.create(agentId, prompt);
    this.queue.push(task.id);
    void this.pump();
    return task;
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const id = this.queue.shift()!;
        await this.runOne(id);
      }
    } finally {
      this.running = false;
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
      const result = await wakeAgent(agent, `[Background task]\n${task.prompt}`, this.loopDeps);
      this.tasks.update(id, {
        status: 'done',
        result: result || '(empty)',
        finishedAt: new Date().toISOString(),
      });
    } catch (e) {
      this.tasks.update(id, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        finishedAt: new Date().toISOString(),
      });
    }
  }
}
