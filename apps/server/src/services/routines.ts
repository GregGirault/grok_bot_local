import cron from 'node-cron';
import type { AgentRepo, MessageRepo, RoutineRepo, SettingsRepo, TaskRepo } from '../db/repos';
import { wakeAgent, type AgentLoopDeps } from './agentLoop';

export class RoutineScheduler {
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(
    private routines: RoutineRepo,
    private agents: AgentRepo,
    private loopDeps: AgentLoopDeps
  ) {}

  start(): void {
    for (const r of this.routines.list()) {
      if (r.enabled) this.schedule(r.id);
    }
  }

  schedule(id: string): void {
    this.unschedule(id);
    const r = this.routines.get(id);
    if (!r || !r.enabled) return;
    if (!cron.validate(r.cron)) return;
    const task = cron.schedule(r.cron, () => {
      void this.run(id);
    });
    this.tasks.set(id, task);
  }

  unschedule(id: string): void {
    const t = this.tasks.get(id);
    if (t) {
      t.stop();
      this.tasks.delete(id);
    }
  }

  async run(id: string): Promise<void> {
    const r = this.routines.get(id);
    if (!r) return;
    const agent = this.agents.get(r.agentId);
    if (!agent) return;
    try {
      const out = await wakeAgent(agent, r.prompt, this.loopDeps, { quietChat: false });
      if (r.quietIfEmpty && (!out.trim() || out.includes('(aucun changement)'))) {
        this.routines.addRun(id, 'skipped', out);
        return;
      }
      this.routines.update(id, { lastRunAt: new Date().toISOString() });
      this.routines.addRun(id, 'ok', out.slice(0, 4000));
      this.agents.update(agent.id, {
        unread: true,
        attention: 'unread',
        lastPreview: out.slice(0, 140) || r.name,
      });
    } catch (e) {
      this.routines.addRun(id, 'error', undefined, e instanceof Error ? e.message : String(e));
    }
  }
}

export class TaskRunner {
  private running = 0;

  constructor(
    private tasks: TaskRepo,
    private agents: AgentRepo,
    private loopDeps: AgentLoopDeps,
    private messages: MessageRepo,
    private settings: SettingsRepo
  ) {
    setInterval(() => this.tick(), 1500);
  }

  enqueue(agentId: string, prompt: string, opts?: { parentTaskId?: string; postToChat?: boolean }): { id: string } {
    const t = this.tasks.create(agentId, prompt, opts?.parentTaskId, opts?.postToChat !== false);
    return { id: t.id };
  }

  private tick(): void {
    const conc = this.settings.getAll().taskConcurrency ?? 2;
    if (this.running >= conc) return;
    const next = this.tasks.nextQueued();
    if (!next) return;
    this.running++;
    this.tasks.update(next.id, { status: 'running' });
    const agent = this.agents.get(next.agentId);
    void (async () => {
      try {
        if (!agent) throw new Error('Bot introuvable');
        const result = await wakeAgent(agent, next.prompt, this.loopDeps);
        this.tasks.update(next.id, { status: 'done', result, finishedAt: new Date().toISOString() });
        if (next.postToChat) {
          this.messages.add({
            agentId: agent.id,
            role: 'system',
            content: `Tâche terminée : ${result.slice(0, 500)}`,
            kind: 'event',
            meta: { type: 'event', event: 'computer', label: 'Tâche' },
          });
        }
      } catch (e) {
        this.tasks.update(next.id, {
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
          finishedAt: new Date().toISOString(),
        });
      } finally {
        this.running--;
      }
    })();
  }
}
