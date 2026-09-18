import { v4 as uuid } from 'uuid';
import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  ChatMessage,
  MemoryEntry,
  Routine,
  CreateRoutineInput,
  Settings,
  InboxMessage,
  Channel,
  ChannelMessage,
  BackgroundTask,
  MessageKind,
  Machine,
  TeamMember,
  Project,
  ApprovalRequest,
  RoutineRun,
  AttachmentInfo,
  SearchResult,
} from '@grok-bot/shared';
import type { Db } from './schema';

const COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16',
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function parseMeta(raw: unknown): ChatMessage['meta'] {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ChatMessage['meta'];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseAttachments(raw: unknown): AttachmentInfo[] | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AttachmentInfo[];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseReactions(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) out[key] = n;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

function rowToAgent(r: Record<string, unknown>): Agent {
  return {
    id: r.id as string,
    name: r.name as string,
    title: r.title as string,
    description: r.description as string,
    systemPrompt: r.system_prompt as string,
    avatarColor: (r.avatar_color as string) || pickColor(r.name as string),
    avatarShape: ((r.avatar_shape as string) || 'circle') as Agent['avatarShape'],
    hidden: Boolean(r.hidden),
    pinned: Boolean(r.pinned),
    notifyOnUpdates: r.notify_on_updates === undefined ? true : Boolean(r.notify_on_updates),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    agentId: r.agent_id as string,
    role: r.role as ChatMessage['role'],
    content: r.content as string,
    kind: ((r.kind as string) || 'text') as MessageKind,
    meta: parseMeta(r.meta),
    toolName: (r.tool_name as string) || undefined,
    toolCallId: (r.tool_call_id as string) || undefined,
    attachments: parseAttachments(r.attachments),
    parentMessageId: (r.parent_message_id as string) || undefined,
    reactions: parseReactions(r.reactions),
    editedAt: (r.edited_at as string) || undefined,
    createdAt: r.created_at as string,
  };
}

function rowToMemory(r: Record<string, unknown>): MemoryEntry {
  return {
    id: r.id as string,
    agentId: r.agent_id as string,
    key: r.key as string,
    value: r.value as string,
    tier: ((r.tier as string) || 'note') as MemoryEntry['tier'],
    scope: ((r.scope as string) || 'agent') as MemoryEntry['scope'],
    projectId: (r.project_id as string) || undefined,
    pinned: Boolean(r.pinned),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToRoutine(r: Record<string, unknown>): Routine {
  return {
    id: r.id as string,
    agentId: r.agent_id as string,
    name: r.name as string,
    cron: r.cron as string,
    prompt: r.prompt as string,
    enabled: Boolean(r.enabled),
    quietIfEmpty: Boolean(r.quiet_if_empty),
    timezone: (r.timezone as string) || undefined,
    webhookToken: (r.webhook_token as string) || undefined,
    lastRunAt: (r.last_run_at as string) || undefined,
    createdAt: r.created_at as string,
  };
}

export class AgentRepo {
  constructor(private db: Db) {}

  list(includeHidden = false): Agent[] {
    const sql = includeHidden
      ? 'SELECT * FROM agents ORDER BY pinned DESC, name'
      : 'SELECT * FROM agents WHERE hidden = 0 ORDER BY pinned DESC, name';
    return this.db.prepare(sql).all().map((r) => rowToAgent(r as Record<string, unknown>));
  }

  listHidden(): Agent[] {
    return this.db
      .prepare('SELECT * FROM agents WHERE hidden = 1 ORDER BY name')
      .all()
      .map((r) => rowToAgent(r as Record<string, unknown>));
  }

  get(id: string): Agent | null {
    const r = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    return r ? rowToAgent(r as Record<string, unknown>) : null;
  }

  getByName(name: string): Agent | null {
    const r = this.db.prepare('SELECT * FROM agents WHERE name = ?').get(name);
    return r ? rowToAgent(r as Record<string, unknown>) : null;
  }

  create(input: CreateAgentInput): Agent {
    const now = new Date().toISOString();
    const id = uuid();
    const color = input.avatarColor || pickColor(input.name);
    const shape = input.avatarShape || 'circle';
    this.db
      .prepare(
        `INSERT INTO agents (id, name, title, description, system_prompt, avatar_color, avatar_shape, hidden, pinned, notify_on_updates, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.title,
        input.description ?? '',
        input.systemPrompt ?? 'You are a helpful assistant.',
        color,
        shape,
        input.notifyOnUpdates === false ? 0 : 1,
        now,
        now
      );
    return this.get(id)!;
  }

  update(id: string, input: UpdateAgentInput): Agent | null {
    const existing = this.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE agents SET name = ?, title = ?, description = ?, system_prompt = ?,
         avatar_color = ?, avatar_shape = ?, hidden = ?, pinned = ?, notify_on_updates = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.systemPrompt ?? existing.systemPrompt,
        input.avatarColor ?? existing.avatarColor,
        input.avatarShape ?? existing.avatarShape,
        input.hidden !== undefined ? (input.hidden ? 1 : 0) : existing.hidden ? 1 : 0,
        input.pinned !== undefined ? (input.pinned ? 1 : 0) : existing.pinned ? 1 : 0,
        input.notifyOnUpdates !== undefined
          ? input.notifyOnUpdates
            ? 1
            : 0
          : existing.notifyOnUpdates
            ? 1
            : 0,
        now,
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0;
  }
}

export class MessageRepo {
  constructor(private db: Db) {}

  listByAgent(agentId: string, limit = 200): ChatMessage[] {
    return this.db
      .prepare(`SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at ASC LIMIT ?`)
      .all(agentId, limit)
      .map((r) => rowToMessage(r as Record<string, unknown>));
  }

  add(
    msg: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ): ChatMessage {
    const id = msg.id ?? uuid();
    const createdAt = msg.createdAt ?? new Date().toISOString();
    const kind = msg.kind ?? 'text';
    const meta = msg.meta ? JSON.stringify(msg.meta) : null;
    const attachments = msg.attachments ? JSON.stringify(msg.attachments) : null;
    this.db
      .prepare(
        `INSERT INTO messages (id, agent_id, role, content, kind, meta, tool_name, tool_call_id, attachments, parent_message_id, reactions, edited_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        msg.agentId,
        msg.role,
        msg.content,
        kind,
        meta,
        msg.toolName ?? null,
        msg.toolCallId ?? null,
        attachments,
        msg.parentMessageId ?? null,
        msg.reactions ? JSON.stringify(msg.reactions) : null,
        msg.editedAt ?? null,
        createdAt
      );
    return {
      id,
      agentId: msg.agentId,
      role: msg.role,
      content: msg.content,
      kind,
      meta: msg.meta,
      toolName: msg.toolName,
      toolCallId: msg.toolCallId,
      attachments: msg.attachments,
      parentMessageId: msg.parentMessageId,
      reactions: msg.reactions,
      editedAt: msg.editedAt,
      createdAt,
    };
  }

  updateContent(id: string, content: string): ChatMessage | null {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?')
      .run(content, now, id);
    return this.get(id);
  }

  updateMeta(id: string, meta: ChatMessage['meta'], content?: string): void {
    if (content !== undefined) {
      this.db
        .prepare('UPDATE messages SET meta = ?, content = ? WHERE id = ?')
        .run(JSON.stringify(meta), content, id);
    } else {
      this.db.prepare('UPDATE messages SET meta = ? WHERE id = ?').run(JSON.stringify(meta), id);
    }
  }

  toggleReaction(id: string, emoji: string): ChatMessage | null {
    const existing = this.get(id);
    if (!existing) return null;
    const reactions = { ...(existing.reactions || {}) };
    if (reactions[emoji]) delete reactions[emoji];
    else reactions[emoji] = 1;
    this.db
      .prepare('UPDATE messages SET reactions = ? WHERE id = ?')
      .run(Object.keys(reactions).length ? JSON.stringify(reactions) : null, id);
    return this.get(id);
  }

  get(id: string): ChatMessage | null {
    const r = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    return r ? rowToMessage(r as Record<string, unknown>) : null;
  }

  deleteFrom(id: string, agentId: string): void {
    const msg = this.get(id);
    if (!msg || msg.agentId !== agentId) return;
    this.db
      .prepare('DELETE FROM messages WHERE agent_id = ? AND created_at >= ?')
      .run(agentId, msg.createdAt);
  }

  clear(agentId: string): void {
    this.db.prepare('DELETE FROM messages WHERE agent_id = ?').run(agentId);
  }
}

export class MemoryRepo {
  constructor(private db: Db) {}

  list(agentId?: string, projectId?: string): MemoryEntry[] {
    if (projectId) {
      return this.db
        .prepare('SELECT * FROM memory WHERE project_id = ? ORDER BY key')
        .all(projectId)
        .map((r) => rowToMemory(r as Record<string, unknown>));
    }
    if (agentId) {
      return this.db
        .prepare(
          `SELECT * FROM memory WHERE agent_id = ? OR scope = 'user' ORDER BY key`
        )
        .all(agentId)
        .map((r) => rowToMemory(r as Record<string, unknown>));
    }
    return this.db
      .prepare('SELECT * FROM memory ORDER BY agent_id, key')
      .all()
      .map((r) => rowToMemory(r as Record<string, unknown>));
  }

  listUserGlobal(): MemoryEntry[] {
    return this.db
      .prepare(`SELECT * FROM memory WHERE scope = 'user' ORDER BY key`)
      .all()
      .map((r) => rowToMemory(r as Record<string, unknown>));
  }

  search(query: string, agentId?: string): MemoryEntry[] {
    const q = `%${query.toLowerCase()}%`;
    if (agentId) {
      return this.db
        .prepare(
          `SELECT * FROM memory WHERE (agent_id = ? OR scope = 'user') AND (lower(key) LIKE ? OR lower(value) LIKE ?) ORDER BY key`
        )
        .all(agentId, q, q)
        .map((r) => rowToMemory(r as Record<string, unknown>));
    }
    return this.db
      .prepare(`SELECT * FROM memory WHERE lower(key) LIKE ? OR lower(value) LIKE ? ORDER BY key`)
      .all(q, q)
      .map((r) => rowToMemory(r as Record<string, unknown>));
  }

  write(
    agentId: string,
    key: string,
    value: string,
    tier: MemoryEntry['tier'] = 'note',
    scope: MemoryEntry['scope'] = 'agent',
    projectId?: string,
    pinned?: boolean
  ): MemoryEntry {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM memory WHERE agent_id = ? AND key = ?')
      .get(agentId, key) as Record<string, unknown> | undefined;
    if (existing) {
      this.db
        .prepare(
          'UPDATE memory SET value = ?, tier = ?, scope = ?, project_id = ?, pinned = ?, updated_at = ? WHERE id = ?'
        )
        .run(
          value,
          tier ?? 'note',
          scope ?? 'agent',
          projectId ?? existing.project_id ?? null,
          pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned ? 1 : 0,
          now,
          existing.id
        );
      return rowToMemory(
        this.db.prepare('SELECT * FROM memory WHERE id = ?').get(existing.id as string) as Record<string, unknown>
      );
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO memory (id, agent_id, key, value, tier, scope, project_id, pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        agentId,
        key,
        value,
        tier ?? 'note',
        scope ?? 'agent',
        projectId ?? null,
        pinned ? 1 : 0,
        now,
        now
      );
    return rowToMemory(
      this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as Record<string, unknown>
    );
  }

  pin(id: string, pinned: boolean): MemoryEntry | null {
    const r = this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    let tier = r.tier as string;
    if (pinned && tier === 'note') tier = 'profile';
    this.db
      .prepare('UPDATE memory SET pinned = ?, tier = ?, updated_at = ? WHERE id = ?')
      .run(pinned ? 1 : 0, tier, new Date().toISOString(), id);
    return rowToMemory(
      this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as Record<string, unknown>
    );
  }

  promoteStale(days = 7): number {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const res = this.db
      .prepare(
        `UPDATE memory SET tier = 'log', updated_at = ? WHERE tier = 'note' AND pinned = 0 AND created_at < ?`
      )
      .run(new Date().toISOString(), cutoff);
    return res.changes;
  }

  forget(agentId: string, key: string): boolean {
    return (
      this.db.prepare('DELETE FROM memory WHERE agent_id = ? AND key = ?').run(agentId, key)
        .changes > 0
    );
  }

  forgetById(id: string): boolean {
    return this.db.prepare('DELETE FROM memory WHERE id = ?').run(id).changes > 0;
  }

  formatForPrompt(agentId: string, projectId?: string): string {
    const entries = this.list(agentId, projectId);
    const userGlobal = this.listUserGlobal().filter((e) => e.agentId !== agentId);
    const all = [...entries];
    for (const u of userGlobal) {
      if (!all.find((a) => a.id === u.id)) all.push(u);
    }
    if (!all.length) return '';
    const lines = all.map(
      (e) =>
        `- [${e.tier}/${e.scope}${e.projectId ? '/proj' : ''}${e.pinned ? '/pin' : ''}] ${e.key}: ${e.value}`
    );
    return `\n\n## Persistent memory\n${lines.join('\n')}`;
  }
}

export class RoutineRepo {
  constructor(private db: Db) {}

  list(agentId?: string): Routine[] {
    if (agentId) {
      return this.db
        .prepare('SELECT * FROM routines WHERE agent_id = ? ORDER BY name')
        .all(agentId)
        .map((r) => rowToRoutine(r as Record<string, unknown>));
    }
    return this.db
      .prepare('SELECT * FROM routines ORDER BY name')
      .all()
      .map((r) => rowToRoutine(r as Record<string, unknown>));
  }

  get(id: string): Routine | null {
    const r = this.db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    return r ? rowToRoutine(r as Record<string, unknown>) : null;
  }

  getByToken(token: string): Routine | null {
    const r = this.db.prepare('SELECT * FROM routines WHERE webhook_token = ?').get(token);
    return r ? rowToRoutine(r as Record<string, unknown>) : null;
  }

  create(input: CreateRoutineInput): Routine {
    const id = uuid();
    const now = new Date().toISOString();
    const token = uuid().replace(/-/g, '').slice(0, 24);
    this.db
      .prepare(
        `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, quiet_if_empty, timezone, webhook_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.agentId,
        input.name,
        input.cron,
        input.prompt,
        input.enabled === false ? 0 : 1,
        input.quietIfEmpty ? 1 : 0,
        input.timezone ?? null,
        token,
        now
      );
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<
      Pick<Routine, 'name' | 'cron' | 'prompt' | 'enabled' | 'lastRunAt' | 'quietIfEmpty' | 'timezone'>
    >
  ): Routine | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE routines SET name = ?, cron = ?, prompt = ?, enabled = ?, quiet_if_empty = ?, timezone = ?, last_run_at = ?
         WHERE id = ?`
      )
      .run(
        patch.name ?? existing.name,
        patch.cron ?? existing.cron,
        patch.prompt ?? existing.prompt,
        patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled ? 1 : 0,
        patch.quietIfEmpty !== undefined
          ? patch.quietIfEmpty
            ? 1
            : 0
          : existing.quietIfEmpty
            ? 1
            : 0,
        patch.timezone !== undefined ? patch.timezone : (existing.timezone ?? null),
        patch.lastRunAt !== undefined ? patch.lastRunAt : (existing.lastRunAt ?? null),
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM routines WHERE id = ?').run(id).changes > 0;
  }

  addRun(routineId: string, status: RoutineRun['status'], output?: string, error?: string): RoutineRun {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO routine_runs (id, routine_id, status, output, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, routineId, status, output ?? null, error ?? null, createdAt);
    this.db
      .prepare(
        `DELETE FROM routine_runs WHERE routine_id = ? AND id NOT IN (
           SELECT id FROM routine_runs WHERE routine_id = ? ORDER BY created_at DESC LIMIT 20
         )`
      )
      .run(routineId, routineId);
    return { id, routineId, status, output, error, createdAt };
  }

  listRuns(routineId?: string, limit = 50): RoutineRun[] {
    const effectiveLimit = routineId ? Math.min(limit, 20) : limit;
    const rows = (
      routineId
        ? this.db
            .prepare(
              `SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY created_at DESC LIMIT ?`
            )
            .all(routineId, effectiveLimit)
        : this.db
            .prepare(`SELECT * FROM routine_runs ORDER BY created_at DESC LIMIT ?`)
            .all(effectiveLimit)
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      routineId: r.routine_id as string,
      status: r.status as RoutineRun['status'],
      output: (r.output as string) || undefined,
      error: (r.error as string) || undefined,
      createdAt: r.created_at as string,
    }));
  }
}

export class SettingsRepo {
  constructor(private db: Db) {}

  getAll(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      ollamaBaseUrl: map.ollamaBaseUrl || 'http://127.0.0.1:11434',
      defaultModel: map.defaultModel || 'qwen2.5:7b',
      workspaceRoot: map.workspaceRoot || '',
      theme: (map.theme as Settings['theme']) || 'dark',
      language: (map.language as Settings['language']) || 'en',
      accentColor: map.accentColor || '#8b5cf6',
      taskConcurrency: Number(map.taskConcurrency || '2') || 2,
      githubRepo: map.githubRepo || 'GregGirault/grok_bot_local',
      timezone: map.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      localExecutionPolicy:
        (map.localExecutionPolicy as Settings['localExecutionPolicy']) || 'ask',
      autoReviewEnabled: map.autoReviewEnabled !== 'false',
      autoReviewAskPatterns: parseStringArray(map.autoReviewAskPatterns),
      autoReviewAllowPatterns: parseStringArray(map.autoReviewAllowPatterns),
    };
  }

  set(partial: Partial<Settings>): Settings {
    const upsert = this.db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) upsert.run(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    }
    return this.getAll();
  }
}

export class InboxRepo {
  constructor(private db: Db) {}

  list(toAgentId: string, limit = 100): InboxMessage[] {
    return (
      this.db
        .prepare(
          `SELECT i.*, a.name as from_name FROM agent_inbox i
           LEFT JOIN agents a ON a.id = i.from_agent_id
           WHERE i.to_agent_id = ? ORDER BY i.created_at DESC LIMIT ?`
        )
        .all(toAgentId, limit) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id as string,
      fromAgentId: r.from_agent_id as string,
      toAgentId: r.to_agent_id as string,
      content: r.content as string,
      read: Boolean(r.read),
      createdAt: r.created_at as string,
      fromAgentName: (r.from_name as string) || undefined,
    }));
  }

  send(fromAgentId: string, toAgentId: string, content: string): InboxMessage {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO agent_inbox (id, from_agent_id, to_agent_id, content, read, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      )
      .run(id, fromAgentId, toAgentId, content, createdAt);
    return { id, fromAgentId, toAgentId, content, read: false, createdAt };
  }

  markRead(id: string): boolean {
    return this.db.prepare('UPDATE agent_inbox SET read = 1 WHERE id = ?').run(id).changes > 0;
  }
}

export class ChannelRepo {
  constructor(private db: Db) {}

  list(): Channel[] {
    const channels = this.db
      .prepare('SELECT * FROM channels ORDER BY pinned DESC, name')
      .all() as Array<Record<string, unknown>>;
    return channels.map((c) => this.hydrate(c));
  }

  get(id: string): Channel | null {
    const r = this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return r ? this.hydrate(r) : null;
  }

  private hydrate(r: Record<string, unknown>): Channel {
    const members = this.db
      .prepare('SELECT agent_id FROM channel_members WHERE channel_id = ?')
      .all(r.id) as Array<{ agent_id: string }>;
    return {
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      memberIds: members.map((m) => m.agent_id),
      pinned: Boolean(r.pinned),
      createdAt: r.created_at as string,
    };
  }

  create(name: string, description: string, memberIds: string[]): Channel {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(`INSERT INTO channels (id, name, description, pinned, created_at) VALUES (?, ?, ?, 0, ?)`)
      .run(id, name, description || '', createdAt);
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`
    );
    for (const aid of memberIds) insert.run(id, aid);
    return this.get(id)!;
  }

  addMember(channelId: string, agentId: string): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`)
      .run(channelId, agentId);
  }

  removeMember(channelId: string, agentId: string): void {
    this.db
      .prepare(`DELETE FROM channel_members WHERE channel_id = ? AND agent_id = ?`)
      .run(channelId, agentId);
  }

  update(
    id: string,
    patch: Partial<Pick<Channel, 'name' | 'description' | 'pinned'>>
  ): Channel | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare('UPDATE channels SET name = ?, description = ?, pinned = ? WHERE id = ?')
      .run(
        patch.name ?? existing.name,
        patch.description ?? existing.description,
        patch.pinned !== undefined ? (patch.pinned ? 1 : 0) : existing.pinned ? 1 : 0,
        id
      );
    return this.get(id);
  }

  postMessage(
    channelId: string,
    content: string,
    fromAgentId?: string,
    replyToId?: string
  ): ChannelMessage {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO channel_messages (id, channel_id, from_agent_id, content, reply_to_id, reactions, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`
      )
      .run(id, channelId, fromAgentId ?? null, content, replyToId ?? null, createdAt);
    return { id, channelId, fromAgentId, content, replyToId, createdAt };
  }

  listMessages(channelId: string, limit = 100): ChannelMessage[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM channel_messages WHERE channel_id = ? ORDER BY created_at ASC LIMIT ?`
        )
        .all(channelId, limit) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id as string,
      channelId: r.channel_id as string,
      fromAgentId: (r.from_agent_id as string) || undefined,
      content: r.content as string,
      replyToId: (r.reply_to_id as string) || undefined,
      reactions: parseReactions(r.reactions),
      createdAt: r.created_at as string,
    }));
  }

  getMessage(id: string): ChannelMessage | null {
    const r = this.db.prepare('SELECT * FROM channel_messages WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      channelId: r.channel_id as string,
      fromAgentId: (r.from_agent_id as string) || undefined,
      content: r.content as string,
      replyToId: (r.reply_to_id as string) || undefined,
      reactions: parseReactions(r.reactions),
      createdAt: r.created_at as string,
    };
  }

  toggleReaction(id: string, emoji: string): ChannelMessage | null {
    const existing = this.getMessage(id);
    if (!existing) return null;
    const reactions = { ...(existing.reactions || {}) };
    if (reactions[emoji]) delete reactions[emoji];
    else reactions[emoji] = 1;
    this.db
      .prepare('UPDATE channel_messages SET reactions = ? WHERE id = ?')
      .run(Object.keys(reactions).length ? JSON.stringify(reactions) : null, id);
    return this.getMessage(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM channels WHERE id = ?').run(id).changes > 0;
  }
}

export class TaskRepo {
  constructor(private db: Db) {}

  list(limit = 50): BackgroundTask[] {
    return (
      this.db
        .prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as Array<Record<string, unknown>>
    ).map((r) => this.row(r));
  }

  get(id: string): BackgroundTask | null {
    const r = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return r ? this.row(r) : null;
  }

  create(
    agentId: string,
    prompt: string,
    opts?: { parentTaskId?: string; postToChat?: boolean }
  ): BackgroundTask {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tasks (id, agent_id, prompt, status, parent_task_id, post_to_chat, created_at)
         VALUES (?, ?, ?, 'queued', ?, ?, ?)`
      )
      .run(
        id,
        agentId,
        prompt,
        opts?.parentTaskId ?? null,
        opts?.postToChat === false ? 0 : 1,
        createdAt
      );
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<Pick<BackgroundTask, 'status' | 'result' | 'error' | 'finishedAt'>>
  ): BackgroundTask | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE tasks SET status = ?, result = ?, error = ?, finished_at = ? WHERE id = ?`
      )
      .run(
        patch.status ?? existing.status,
        patch.result !== undefined ? patch.result : (existing.result ?? null),
        patch.error !== undefined ? patch.error : (existing.error ?? null),
        patch.finishedAt !== undefined ? patch.finishedAt : (existing.finishedAt ?? null),
        id
      );
    return this.get(id);
  }

  private row(r: Record<string, unknown>): BackgroundTask {
    return {
      id: r.id as string,
      agentId: r.agent_id as string,
      prompt: r.prompt as string,
      status: r.status as BackgroundTask['status'],
      result: (r.result as string) || undefined,
      error: (r.error as string) || undefined,
      parentTaskId: (r.parent_task_id as string) || undefined,
      postToChat: r.post_to_chat === undefined ? true : Boolean(r.post_to_chat),
      createdAt: r.created_at as string,
      finishedAt: (r.finished_at as string) || undefined,
    };
  }
}

export class MachineRepo {
  constructor(private db: Db) {}

  list(): Machine[] {
    return (
      this.db.prepare('SELECT * FROM machines ORDER BY name').all() as Array<
        Record<string, unknown>
      >
    ).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      host: r.host as string,
      path: r.path as string,
      createdAt: r.created_at as string,
    }));
  }

  get(id: string): Machine | null {
    const r = this.db.prepare('SELECT * FROM machines WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      name: r.name as string,
      host: r.host as string,
      path: r.path as string,
      createdAt: r.created_at as string,
    };
  }

  create(name: string, host: string, pathVal: string): Machine {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(`INSERT INTO machines (id, name, host, path, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, name, host || 'localhost', pathVal || '', createdAt);
    return this.get(id)!;
  }

  update(id: string, patch: Partial<Pick<Machine, 'name' | 'host' | 'path'>>): Machine | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(`UPDATE machines SET name = ?, host = ?, path = ? WHERE id = ?`)
      .run(patch.name ?? existing.name, patch.host ?? existing.host, patch.path ?? existing.path, id);
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM machines WHERE id = ?').run(id).changes > 0;
  }
}

export class TeamMemberRepo {
  constructor(private db: Db) {}

  list(): TeamMember[] {
    return (
      this.db.prepare('SELECT * FROM team_members ORDER BY name').all() as Array<
        Record<string, unknown>
      >
    ).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string) || undefined,
      role: r.role as string,
      createdAt: r.created_at as string,
    }));
  }

  get(id: string): TeamMember | null {
    const r = this.db.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string) || undefined,
      role: r.role as string,
      createdAt: r.created_at as string,
    };
  }

  create(name: string, email?: string, role = 'member'): TeamMember {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO team_members (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, name, email ?? null, role, createdAt);
    return this.get(id)!;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM team_members WHERE id = ?').run(id).changes > 0;
  }

  listForChannel(channelId: string): TeamMember[] {
    return (
      this.db
        .prepare(
          `SELECT t.* FROM team_members t
           JOIN channel_team_members c ON c.member_id = t.id
           WHERE c.channel_id = ? ORDER BY t.name`
        )
        .all(channelId) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string) || undefined,
      role: r.role as string,
      createdAt: r.created_at as string,
    }));
  }

  addToChannel(channelId: string, memberId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO channel_team_members (channel_id, member_id) VALUES (?, ?)`
      )
      .run(channelId, memberId);
  }

  removeFromChannel(channelId: string, memberId: string): void {
    this.db
      .prepare(`DELETE FROM channel_team_members WHERE channel_id = ? AND member_id = ?`)
      .run(channelId, memberId);
  }
}

export class ProjectRepo {
  constructor(private db: Db) {}

  list(): Project[] {
    return (
      this.db.prepare('SELECT * FROM projects ORDER BY name').all() as Array<
        Record<string, unknown>
      >
    ).map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      path: r.path as string,
      description: r.description as string,
      createdAt: r.created_at as string,
    }));
  }

  get(id: string): Project | null {
    const r = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      path: r.path as string,
      description: r.description as string,
      createdAt: r.created_at as string,
    };
  }

  getBySlug(slug: string): Project | null {
    const r = this.db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      path: r.path as string,
      description: r.description as string,
      createdAt: r.created_at as string,
    };
  }

  create(slug: string, name: string, pathVal: string, description: string): Project {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO projects (id, slug, name, path, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, slug, name, pathVal || '', description || '', createdAt);
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<Pick<Project, 'slug' | 'name' | 'path' | 'description'>>
  ): Project | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE projects SET slug = ?, name = ?, path = ?, description = ? WHERE id = ?`
      )
      .run(
        patch.slug ?? existing.slug,
        patch.name ?? existing.name,
        patch.path ?? existing.path,
        patch.description ?? existing.description,
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
  }
}

export class ApprovalRepo {
  constructor(private db: Db) {}

  create(agentId: string, toolName: string, command: string): ApprovalRequest {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO approvals (id, agent_id, tool_name, command, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .run(id, agentId, toolName, command, createdAt);
    return this.get(id)!;
  }

  get(id: string): ApprovalRequest | null {
    const r = this.db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      agentId: r.agent_id as string,
      toolName: r.tool_name as string,
      command: r.command as string,
      status: r.status as ApprovalRequest['status'],
      createdAt: r.created_at as string,
      resolvedAt: (r.resolved_at as string) || undefined,
    };
  }

  listPending(agentId?: string): ApprovalRequest[] {
    const rows = (
      agentId
        ? this.db
            .prepare(
              `SELECT * FROM approvals WHERE status = 'pending' AND agent_id = ? ORDER BY created_at DESC`
            )
            .all(agentId)
        : this.db
            .prepare(`SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC`)
            .all()
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      agentId: r.agent_id as string,
      toolName: r.tool_name as string,
      command: r.command as string,
      status: r.status as ApprovalRequest['status'],
      createdAt: r.created_at as string,
      resolvedAt: (r.resolved_at as string) || undefined,
    }));
  }

  resolve(id: string, status: 'approved' | 'denied'): ApprovalRequest | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(`UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), id);
    return this.get(id);
  }
}

export class UploadRepo {
  constructor(private db: Db) {}

  create(
    name: string,
    pathVal: string,
    opts?: { agentId?: string; mime?: string; size?: number }
  ): AttachmentInfo {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO uploads (id, agent_id, name, path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        opts?.agentId ?? null,
        name,
        pathVal,
        opts?.mime ?? null,
        opts?.size ?? null,
        createdAt
      );
    return {
      id,
      name,
      path: pathVal,
      mime: opts?.mime,
      size: opts?.size,
    };
  }

  get(id: string): AttachmentInfo | null {
    const r = this.db.prepare('SELECT * FROM uploads WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) return null;
    return {
      id: r.id as string,
      name: r.name as string,
      path: r.path as string,
      mime: (r.mime as string) || undefined,
      size: (r.size as number) || undefined,
    };
  }
}

function parseStringArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export class SearchRepo {
  constructor(private db: Db) {}

  search(query: string, limit = 50): SearchResult[] {
    const q = `%${query.toLowerCase()}%`;
    const perType = Math.max(3, Math.min(20, Math.ceil(limit / 5)));
    const results: SearchResult[] = [];

    const agents = this.db
      .prepare(
        `SELECT id, name, title, description, updated_at FROM agents
         WHERE lower(name) LIKE ? OR lower(title) LIKE ? OR lower(description) LIKE ?
         ORDER BY pinned DESC, updated_at DESC LIMIT ?`
      )
      .all(q, q, q, perType) as Array<Record<string, unknown>>;
    for (const r of agents) {
      results.push({
        type: 'agent',
        id: r.id as string,
        title: r.title as string,
        subtitle: `@${r.name as string}`,
        snippet: r.description as string,
        target: `/chat/${r.id as string}`,
        createdAt: r.updated_at as string,
      });
    }

    const messages = this.db
      .prepare(
        `SELECT m.id, m.agent_id, m.content, m.created_at, a.name AS agent_name
         FROM messages m JOIN agents a ON a.id = m.agent_id
         WHERE lower(m.content) LIKE ?
         ORDER BY m.created_at DESC LIMIT ?`
      )
      .all(q, perType) as Array<Record<string, unknown>>;
    for (const r of messages) {
      results.push({
        type: 'message',
        id: r.id as string,
        title: `Message · @${r.agent_name as string}`,
        snippet: String(r.content || '').slice(0, 240),
        target: `/chat/${r.agent_id as string}?message=${encodeURIComponent(r.id as string)}`,
        createdAt: r.created_at as string,
      });
    }

    const channels = this.db
      .prepare(
        `SELECT id, name, description, created_at FROM channels
         WHERE lower(name) LIKE ? OR lower(description) LIKE ?
         ORDER BY pinned DESC, created_at DESC LIMIT ?`
      )
      .all(q, q, perType) as Array<Record<string, unknown>>;
    for (const r of channels) {
      results.push({
        type: 'channel',
        id: r.id as string,
        title: `#${r.name as string}`,
        snippet: r.description as string,
        target: `/channels/${r.id as string}`,
        createdAt: r.created_at as string,
      });
    }

    const routines = this.db
      .prepare(
        `SELECT id, name, prompt, created_at FROM routines
         WHERE lower(name) LIKE ? OR lower(prompt) LIKE ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(q, q, perType) as Array<Record<string, unknown>>;
    for (const r of routines) {
      results.push({
        type: 'routine',
        id: r.id as string,
        title: r.name as string,
        snippet: String(r.prompt || '').slice(0, 240),
        target: '/routines',
        createdAt: r.created_at as string,
      });
    }

    const uploads = this.db
      .prepare(
        `SELECT id, name, path, mime, created_at FROM uploads
         WHERE lower(name) LIKE ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(q, perType) as Array<Record<string, unknown>>;
    for (const r of uploads) {
      results.push({
        type: 'file',
        id: r.id as string,
        title: r.name as string,
        subtitle: (r.mime as string) || 'file',
        target: `/uploads/${encodeURIComponent(String(r.path).split(/[\\/]/).pop() || '')}`,
        createdAt: r.created_at as string,
      });
    }

    return results
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, limit);
  }
}
