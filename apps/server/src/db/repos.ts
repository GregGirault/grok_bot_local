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
} from '@grok-bot/shared';
import type { Db } from './schema';

function rowToAgent(r: Record<string, unknown>): Agent {
  return {
    id: r.id as string,
    name: r.name as string,
    title: r.title as string,
    description: r.description as string,
    systemPrompt: r.system_prompt as string,
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
    this.db
      .prepare(
        `INSERT INTO agents (id, name, title, description, system_prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.title,
        input.description ?? '',
        input.systemPrompt ?? 'You are a helpful assistant.',
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
        `UPDATE agents SET name = ?, title = ?, description = ?, system_prompt = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.systemPrompt ?? existing.systemPrompt,
        now,
        id
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    const r = this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return r.changes > 0;
  }
}

export class MessageRepo {
  constructor(private db: Db) {}

  listByAgent(agentId: string, limit = 200): ChatMessage[] {
    return this.db
      .prepare(
        `SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at ASC LIMIT ?`
      )
      .all(agentId, limit)
      .map((r) => rowToMessage(r as Record<string, unknown>));
  }

  add(msg: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): ChatMessage {
    const id = msg.id ?? uuid();
    const createdAt = msg.createdAt ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO messages (id, agent_id, role, content, tool_name, tool_call_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, msg.agentId, msg.role, msg.content, msg.toolName ?? null, msg.toolCallId ?? null, createdAt);
    return { id, agentId: msg.agentId, role: msg.role, content: msg.content, toolName: msg.toolName, toolCallId: msg.toolCallId, createdAt };
  }

  clear(agentId: string): void {
    this.db.prepare('DELETE FROM messages WHERE agent_id = ?').run(agentId);
  }
}

export class MemoryRepo {
  constructor(private db: Db) {}

  list(agentId: string): MemoryEntry[] {
    return this.db
      .prepare('SELECT * FROM memory WHERE agent_id = ? ORDER BY key')
      .all(agentId)
      .map((r) => rowToMemory(r as Record<string, unknown>));
  }

  write(agentId: string, key: string, value: string): MemoryEntry {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM memory WHERE agent_id = ? AND key = ?')
      .get(agentId, key) as Record<string, unknown> | undefined;
    if (existing) {
      this.db
        .prepare('UPDATE memory SET value = ?, updated_at = ? WHERE id = ?')
        .run(value, now, existing.id);
      return rowToMemory({ ...existing, value, updated_at: now });
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO memory (id, agent_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, agentId, key, value, now, now);
    return { id, agentId, key, value, createdAt: now, updatedAt: now };
  }

  forget(agentId: string, key: string): boolean {
    const r = this.db
      .prepare('DELETE FROM memory WHERE agent_id = ? AND key = ?')
      .run(agentId, key);
    return r.changes > 0;
  }

  formatForPrompt(agentId: string): string {
    const entries = this.list(agentId);
    if (!entries.length) return '';
    const lines = entries.map((e) => `- ${e.key}: ${e.value}`);
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
        `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.agentId, input.name, input.cron, input.prompt, input.enabled === false ? 0 : 1, now);
    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<Pick<Routine, 'name' | 'cron' | 'prompt' | 'enabled' | 'lastRunAt'>>
  ): Routine | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE routines SET name = ?, cron = ?, prompt = ?, enabled = ?, last_run_at = ? WHERE id = ?`
      )
      .run(
        patch.name ?? existing.name,
        patch.cron ?? existing.cron,
        patch.prompt ?? existing.prompt,
        patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled ? 1 : 0,
        patch.lastRunAt !== undefined ? patch.lastRunAt : existing.lastRunAt ?? null,
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
      defaultModel: map.defaultModel || 'llama3.2',
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
