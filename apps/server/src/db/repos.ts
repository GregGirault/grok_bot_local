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
} from '@grok-bot/shared';
import type { Db } from './schema';

const COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
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

function rowToAgent(r: Record<string, unknown>): Agent {
  return {
    id: r.id as string,
    name: r.name as string,
    title: r.title as string,
    description: r.description as string,
    systemPrompt: r.system_prompt as string,
    avatarColor: (r.avatar_color as string) || pickColor(r.name as string),
    avatarShape: ((r.avatar_shape as string) || 'circle') as Agent['avatarShape'],
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
    lastRunAt: (r.last_run_at as string) || undefined,
    createdAt: r.created_at as string,
  };
}

export class AgentRepo {
  constructor(private db: Db) {}

  list(): Agent[] {
    return this.db
      .prepare('SELECT * FROM agents ORDER BY name')
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
        `INSERT INTO agents (id, name, title, description, system_prompt, avatar_color, avatar_shape, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.title,
        input.description ?? '',
        input.systemPrompt ?? 'You are a helpful assistant.',
        color,
        shape,
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
         avatar_color = ?, avatar_shape = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.systemPrompt ?? existing.systemPrompt,
        input.avatarColor ?? existing.avatarColor,
        input.avatarShape ?? existing.avatarShape,
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
    this.db
      .prepare(
        `INSERT INTO messages (id, agent_id, role, content, kind, meta, tool_name, tool_call_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      createdAt,
    };
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

  get(id: string): ChatMessage | null {
    const r = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    return r ? rowToMessage(r as Record<string, unknown>) : null;
  }

  clear(agentId: string): void {
    this.db.prepare('DELETE FROM messages WHERE agent_id = ?').run(agentId);
  }
}

export class MemoryRepo {
  constructor(private db: Db) {}

  list(agentId?: string): MemoryEntry[] {
    if (agentId) {
      return this.db
        .prepare('SELECT * FROM memory WHERE agent_id = ? ORDER BY key')
        .all(agentId)
        .map((r) => rowToMemory(r as Record<string, unknown>));
    }
    return this.db
      .prepare('SELECT * FROM memory ORDER BY agent_id, key')
      .all()
      .map((r) => rowToMemory(r as Record<string, unknown>));
  }

  search(query: string, agentId?: string): MemoryEntry[] {
    const q = `%${query.toLowerCase()}%`;
    if (agentId) {
      return this.db
        .prepare(
          `SELECT * FROM memory WHERE agent_id = ? AND (lower(key) LIKE ? OR lower(value) LIKE ?) ORDER BY key`
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
    scope: MemoryEntry['scope'] = 'agent'
  ): MemoryEntry {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM memory WHERE agent_id = ? AND key = ?')
      .get(agentId, key) as Record<string, unknown> | undefined;
    if (existing) {
      this.db
        .prepare('UPDATE memory SET value = ?, tier = ?, scope = ?, updated_at = ? WHERE id = ?')
        .run(value, tier ?? 'note', scope ?? 'agent', now, existing.id);
      return rowToMemory({
        ...existing,
        value,
        tier: tier ?? 'note',
        scope: scope ?? 'agent',
        updated_at: now,
      });
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO memory (id, agent_id, key, value, tier, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, agentId, key, value, tier ?? 'note', scope ?? 'agent', now, now);
    return {
      id,
      agentId,
      key,
      value,
      tier: tier ?? 'note',
      scope: scope ?? 'agent',
      createdAt: now,
      updatedAt: now,
    };
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

  formatForPrompt(agentId: string): string {
    const entries = this.list(agentId);
    if (!entries.length) return '';
    const lines = entries.map((e) => `- [${e.tier}/${e.scope}] ${e.key}: ${e.value}`);
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

  create(input: CreateRoutineInput): Routine {
    const id = uuid();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, quiet_if_empty, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.agentId,
        input.name,
        input.cron,
        input.prompt,
        input.enabled === false ? 0 : 1,
        input.quietIfEmpty ? 1 : 0,
        now
      );
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<Pick<Routine, 'name' | 'cron' | 'prompt' | 'enabled' | 'lastRunAt' | 'quietIfEmpty'>>
  ): Routine | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE routines SET name = ?, cron = ?, prompt = ?, enabled = ?, quiet_if_empty = ?, last_run_at = ?
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
        patch.lastRunAt !== undefined ? patch.lastRunAt : (existing.lastRunAt ?? null),
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM routines WHERE id = ?').run(id).changes > 0;
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
    };
  }

  set(partial: Partial<Settings>): Settings {
    const upsert = this.db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) upsert.run(k, String(v));
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
      .prepare('SELECT * FROM channels ORDER BY name')
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
      createdAt: r.created_at as string,
    };
  }

  create(name: string, description: string, memberIds: string[]): Channel {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(`INSERT INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)`)
      .run(id, name, description || '', createdAt);
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`
    );
    for (const aid of memberIds) insert.run(id, aid);
    return this.get(id)!;
  }

  postMessage(channelId: string, content: string, fromAgentId?: string): ChannelMessage {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO channel_messages (id, channel_id, from_agent_id, content, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, channelId, fromAgentId ?? null, content, createdAt);
    return { id, channelId, fromAgentId, content, createdAt };
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
      createdAt: r.created_at as string,
    }));
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

  create(agentId: string, prompt: string): BackgroundTask {
    const id = uuid();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tasks (id, agent_id, prompt, status, created_at) VALUES (?, ?, ?, 'queued', ?)`
      )
      .run(id, agentId, prompt, createdAt);
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
      createdAt: r.created_at as string,
      finishedAt: (r.finished_at as string) || undefined,
    };
  }
}

