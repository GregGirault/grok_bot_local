import type { MemoryEntry, Routine, RoutineRun } from '@grok-bot/shared';
import type { Db } from './schema';
import { nowIso, uuid } from './schema';

export class MemoryRepo {
  constructor(private db: Db) {}

  list(agentId?: string, projectId?: string): MemoryEntry[] {
    let sql = `SELECT * FROM memory WHERE 1=1`;
    const args: string[] = [];
    if (agentId) {
      sql += ` AND agent_id=?`;
      args.push(agentId);
    }
    if (projectId) {
      sql += ` AND project_id=?`;
      args.push(projectId);
    }
    sql += ` ORDER BY pinned DESC, updated_at DESC`;
    return (this.db.prepare(sql).all(...args) as Record<string, unknown>[]).map((r) => this.row(r));
  }

  write(
    agentId: string,
    key: string,
    value: string,
    tier: MemoryEntry['tier'] = 'note',
    scope: MemoryEntry['scope'] = 'agent',
    projectId?: string
  ): MemoryEntry {
    const now = nowIso();
    const existing = this.db
      .prepare(`SELECT id FROM memory WHERE agent_id=? AND key=?`)
      .get(agentId, key) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(`UPDATE memory SET value=?, tier=?, scope=?, project_id=?, updated_at=? WHERE id=?`)
        .run(value, tier, scope, projectId ?? null, now, existing.id);
      return this.list(agentId).find((m) => m.id === existing.id)!;
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO memory (id, agent_id, key, value, tier, scope, project_id, pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(id, agentId, key, value, tier, scope, projectId ?? null, now, now);
    return this.list(agentId).find((m) => m.id === id)!;
  }

  forget(agentId: string, key: string): boolean {
    return this.db.prepare(`DELETE FROM memory WHERE agent_id=? AND key=?`).run(agentId, key).changes > 0;
  }

  deleteId(id: string): boolean {
    return this.db.prepare(`DELETE FROM memory WHERE id=?`).run(id).changes > 0;
  }

  pin(id: string, pinned: boolean): void {
    this.db.prepare(`UPDATE memory SET pinned=?, updated_at=? WHERE id=?`).run(pinned ? 1 : 0, nowIso(), id);
  }

  search(q: string, agentId?: string): MemoryEntry[] {
    const like = `%${q}%`;
    const rows = agentId
      ? (this.db
          .prepare(`SELECT * FROM memory WHERE agent_id=? AND (key LIKE ? OR value LIKE ?)`)
          .all(agentId, like, like) as Record<string, unknown>[])
      : (this.db.prepare(`SELECT * FROM memory WHERE key LIKE ? OR value LIKE ?`).all(like, like) as Record<
          string,
          unknown
        >[]);
    return rows.map((r) => this.row(r));
  }

  formatForPrompt(agentId: string): string {
    const entries = this.list(agentId);
    const user = this.db
      .prepare(`SELECT * FROM memory WHERE scope='user'`)
      .all() as Record<string, unknown>[];
    const all = [...user.map((r) => this.row(r)), ...entries];
    if (!all.length) return '';
    const rank = (tier: string) => (tier === 'profile' ? 0 : tier === 'log' ? 1 : 2);
    const lines = [...all]
      .sort((a, b) => rank(a.tier ?? 'note') - rank(b.tier ?? 'note'))
      .slice(0, 80)
      .map((m) => `- [${m.tier}/${m.scope}] ${m.key}: ${m.value}`);
    return `\n\nMémoire persistante (ne jamais ignorer, surtout profile) :\n${lines.join('\n')}`;
  }

  promoteStale(days: number): void {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    this.db
      .prepare(`UPDATE memory SET tier='log', updated_at=? WHERE tier='note' AND pinned=0 AND updated_at<?`)
      .run(nowIso(), cutoff);
  }

  private row(r: Record<string, unknown>): MemoryEntry {
    return {
      id: String(r.id),
      agentId: String(r.agent_id),
      key: String(r.key),
      value: String(r.value),
      tier: r.tier as MemoryEntry['tier'],
      scope: r.scope as MemoryEntry['scope'],
      projectId: r.project_id ? String(r.project_id) : undefined,
      pinned: Boolean(r.pinned),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }
}

export class RoutineRepo {
  constructor(private db: Db) {}

  list(agentId?: string): Routine[] {
    const rows = (
      agentId
        ? this.db.prepare(`SELECT * FROM routines WHERE agent_id=? ORDER BY created_at DESC`).all(agentId)
        : this.db.prepare(`SELECT * FROM routines ORDER BY created_at DESC`).all()
    ) as Record<string, unknown>[];
    return rows.map((r) => this.row(r));
  }

  get(id: string): Routine | undefined {
    const r = this.db.prepare(`SELECT * FROM routines WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    return r ? this.row(r) : undefined;
  }

  countForAgent(agentId: string): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM routines WHERE agent_id=?`).get(agentId) as { n: number };
    return Number(r.n);
  }

  create(input: {
    agentId: string;
    name: string;
    cron: string;
    prompt: string;
    enabled?: boolean;
    quietIfEmpty?: boolean;
  }): Routine {
    if (this.countForAgent(input.agentId) >= 50) throw new Error('Un bot peut posséder au plus 50 routines.');
    const id = uuid();
    const now = nowIso();
    const token = uuid().slice(0, 12);
    this.db
      .prepare(
        `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, quiet_if_empty, webhook_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.agentId,
        input.name,
        input.cron,
        input.prompt,
        input.enabled === false ? 0 : 1,
        input.quietIfEmpty ? 1 : 0,
        token,
        now
      );
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<{ name: string; cron: string; prompt: string; enabled: boolean; quietIfEmpty: boolean; lastRunAt: string }>
  ): Routine | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    this.db
      .prepare(
        `UPDATE routines SET name=?, cron=?, prompt=?, enabled=?, quiet_if_empty=?, last_run_at=? WHERE id=?`
      )
      .run(
        patch.name ?? cur.name,
        patch.cron ?? cur.cron,
        patch.prompt ?? cur.prompt,
        (patch.enabled ?? cur.enabled) ? 1 : 0,
        (patch.quietIfEmpty ?? cur.quietIfEmpty) ? 1 : 0,
        patch.lastRunAt ?? cur.lastRunAt ?? null,
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM routines WHERE id=?`).run(id).changes > 0;
  }

  addRun(routineId: string, status: RoutineRun['status'], output?: string, error?: string): RoutineRun {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(`INSERT INTO routine_runs (id, routine_id, status, output, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, routineId, status, output ?? null, error ?? null, now);
    return {
      id,
      routineId,
      status,
      output,
      error,
      createdAt: now,
    };
  }

  listRuns(routineId?: string): RoutineRun[] {
    const rows = (
      routineId
        ? this.db
            .prepare(`SELECT * FROM routine_runs WHERE routine_id=? ORDER BY created_at DESC LIMIT 20`)
            .all(routineId)
        : this.db.prepare(`SELECT * FROM routine_runs ORDER BY created_at DESC LIMIT 50`).all()
    ) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      routineId: String(r.routine_id),
      status: r.status as RoutineRun['status'],
      output: r.output ? String(r.output) : undefined,
      error: r.error ? String(r.error) : undefined,
      createdAt: String(r.created_at),
    }));
  }

  private row(r: Record<string, unknown>): Routine {
    return {
      id: String(r.id),
      agentId: String(r.agent_id),
      name: String(r.name),
      cron: String(r.cron),
      prompt: String(r.prompt),
      enabled: Boolean(r.enabled),
      quietIfEmpty: Boolean(r.quiet_if_empty),
      webhookToken: r.webhook_token ? String(r.webhook_token) : undefined,
      lastRunAt: r.last_run_at ? String(r.last_run_at) : undefined,
      createdAt: String(r.created_at),
    };
  }
}
