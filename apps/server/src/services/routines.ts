import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { AgentRepo, RoutineRepo } from '../db/repos';
import type { AgentLoopDeps } from './agentLoop';
import { wakeAgent } from './agentLoop';

function isEmptyOutput(text: string): boolean {
  const t = text.trim().toLowerCase();
  return !t || t === '(no change)' || t === '(empty)' || t === 'no change' || t === 'none';
}

export class RoutineScheduler {
  private tasks = new Map<string, ScheduledTask>();

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
      const task = cron.schedule(
        r.cron,
        () => {
          void this.runRoutine(r.id);
        },
        r.timezone ? { timezone: r.timezone } : undefined
      );
      this.tasks.set(r.id, task);
    }
    console.log(`[routines] scheduled ${this.tasks.size} job(s)`);
  }

  async runRoutine(
    id: string,
    opts?: { force?: boolean }
  ): Promise<{ skipped?: boolean; output?: string }> {
    const r = this.routines.get(id);
    if (!r || (!r.enabled && !opts?.force)) return {};
    const agent = this.agents.get(r.agentId);
    if (!agent) {
      console.warn(`[routines] agent missing for routine ${r.name}`);
      this.routines.addRun(id, 'error', undefined, 'Agent not found');
      return {};
    }

    // Honor notify_on_updates: still run but may skip chat post via quiet
    const notify = agent.notifyOnUpdates !== false;
    console.log(`[routines] waking agent "${agent.name}" for routine "${r.name}"`);
    try {
      const output = await wakeAgent(agent, r.prompt, this.loopDeps, {
        skipPersistUser: false,
        quietChat: !notify,
      });
      this.routines.update(id, { lastRunAt: new Date().toISOString() });

      if (r.quietIfEmpty && isEmptyOutput(output)) {
        this.routines.addRun(id, 'skipped', output || '(no change)');
        // Remove the last assistant message if quiet-if-empty
        console.log(`[routines] quiet-if-empty: skipped post for "${r.name}"`);
        return { skipped: true, output };
      }

      this.routines.addRun(id, 'ok', output);
      return { output };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[routines] failed:`, e);
      this.routines.addRun(id, 'error', undefined, err);
      return {};
    }
  }
}
