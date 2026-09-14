import cron from 'node-cron';
import type { AgentRepo, RoutineRepo } from '../db/repos';
import type { AgentLoopDeps } from './agentLoop';
import { wakeAgent } from './agentLoop';

export class RoutineScheduler {
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(
    private routines: RoutineRepo,
    private agents: AgentRepo,
    private loopDeps: AgentLoopDeps
  ) {}

  start(): void {
    this.reload();
  }

  stop(): void {
    for (const t of this.tasks.values()) t.stop();
    this.tasks.clear();
  }

  reload(): void {
    this.stop();
    const all = this.routines.list().filter((r) => r.enabled);
    for (const r of all) {
      if (!cron.validate(r.cron)) {
        console.warn(`[routines] invalid cron for ${r.name}: ${r.cron}`);
        continue;
      }
      const task = cron.schedule(r.cron, () => {
        void this.runRoutine(r.id);
      });
      this.tasks.set(r.id, task);
    }
    console.log(`[routines] scheduled ${this.tasks.size} job(s)`);
  }

  async runRoutine(id: string): Promise<void> {
    const r = this.routines.get(id);
    if (!r || !r.enabled) return;
    const agent = this.agents.get(r.agentId);
    if (!agent) {
      console.warn(`[routines] agent missing for routine ${r.name}`);
      return;
    }
    console.log(`[routines] waking agent "${agent.name}" for routine "${r.name}"`);
    try {
      await wakeAgent(agent, r.prompt, this.loopDeps);
      this.routines.update(id, { lastRunAt: new Date().toISOString() });
    } catch (e) {
      console.error(`[routines] failed:`, e);
    }
  }
}
