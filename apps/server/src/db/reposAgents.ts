import type {
  Agent,
  Attention,
  Presence,
  ChatMessage,
  CreateAgentInput,
  UpdateAgentInput,
  AttachmentInfo,
} from '@grok-bot/shared';
import { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_SHAPE, normalizeModelProvider } from '@grok-bot/shared';
import type { Db } from './schema';
import { nowIso, uuid } from './schema';
import { parseJson, rowAgent } from './reposUtil';

export class AgentRepo {
  constructor(private db: Db) {}

  list(includeHidden = false): Agent[] {
    const sql = includeHidden
      ? `SELECT * FROM agents ORDER BY pinned DESC, last_activity_at DESC`
      : `SELECT * FROM agents WHERE hidden = 0 ORDER BY pinned DESC, last_activity_at DESC`;
    return (this.db.prepare(sql).all() as Record<string, unknown>[]).map(rowAgent);
  }

  listHidden(): Agent[] {
    return (
      this.db.prepare(`SELECT * FROM agents WHERE hidden = 1 ORDER BY last_activity_at DESC`).all() as Record<
        string,
        unknown
      >[]
    ).map(rowAgent);
  }

  get(id: string): Agent | undefined {
    const r = this.db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowAgent(r) : undefined;
  }

  getByName(name: string): Agent | undefined {
    const r = this.db.prepare(`SELECT * FROM agents WHERE name = ?`).get(name) as
      | Record<string, unknown>
      | undefined;
    return r ? rowAgent(r) : undefined;
  }

  countAll(): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM agents`).get() as { n: number };
    return Number(r.n);
  }

  uniqueName(base: string): string {
    const raw = base.trim() || 'Nouveau Bot';
    let name = raw;
    let i = 2;
    while (this.db.prepare(`SELECT 1 FROM agents WHERE name = ?`).get(name)) {
      name = `${raw} ${i++}`;
    }
    return name;
  }

  create(input: CreateAgentInput): Agent {
    const now = nowIso();
    const id = uuid();
    const name = this.uniqueName(input.name?.trim() || 'Nouveau Bot');
    this.db
      .prepare(
        `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, '', ?, 0, 'none', 'idle', '', ?, ?)`
      )
      .run(
        id,
        name,
        input.title?.trim() || 'Nouveau Bot',
        input.description ?? '',
        input.systemPrompt ??
          'Tu es un bot local. Tu parles français. Tu travailles comme un collègue : concret, bref, et tu n’agis pas sans accord sur ce qui est sensible.',
        input.model?.trim() ?? '',
        input.hfModel?.trim() ?? '',
        normalizeModelProvider(input.modelProvider),
        input.avatarColor ?? DEFAULT_AVATAR_COLOR,
        input.avatarShape ?? DEFAULT_AVATAR_SHAPE,
        input.accessory ?? 'none',
        input.notifyOnUpdates === false ? 0 : 1,
        now,
        now,
        now
      );
    return this.get(id)!;
  }

  duplicate(id: string): Agent | undefined {
    const src = this.get(id);
    if (!src) return undefined;
    return this.create({
      name: `${src.name} copy`,
      title: src.title,
      description: src.description,
      systemPrompt: src.systemPrompt,
      model: src.model,
      hfModel: src.hfModel,
      modelProvider: src.modelProvider,
      avatarColor: src.avatarColor,
      avatarShape: src.avatarShape,
      accessory: src.accessory,
      notifyOnUpdates: src.notifyOnUpdates,
    });
  }

  update(id: string, patch: UpdateAgentInput & { lastPreview?: string; presence?: Presence; currentAction?: string }): Agent | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const next: Agent = {
      ...cur,
      name: patch.name ?? cur.name,
      title: patch.title ?? cur.title,
      description: patch.description ?? cur.description,
      systemPrompt: patch.systemPrompt ?? cur.systemPrompt,
      model: patch.model !== undefined ? patch.model : cur.model,
      hfModel: patch.hfModel !== undefined ? patch.hfModel : cur.hfModel,
      modelProvider: patch.modelProvider !== undefined ? normalizeModelProvider(patch.modelProvider) : cur.modelProvider,
      avatarColor: patch.avatarColor ?? cur.avatarColor,
      avatarShape: patch.avatarShape ?? cur.avatarShape,
      accessory: patch.accessory ?? cur.accessory,
      hidden: patch.hidden ?? cur.hidden,
      pinned: patch.pinned ?? cur.pinned,
      notifyOnUpdates: patch.notifyOnUpdates ?? cur.notifyOnUpdates,
      unread: patch.unread ?? cur.unread,
      attention: patch.attention ?? cur.attention,
      lastPreview: patch.lastPreview ?? cur.lastPreview,
      presence: patch.presence ?? cur.presence,
      currentAction: patch.currentAction ?? cur.currentAction,
      updatedAt: nowIso(),
    };
    if (patch.lastPreview) next.lastActivityAt = nowIso();
    this.db
      .prepare(
        `UPDATE agents SET name=?, title=?, description=?, system_prompt=?, model=?, hf_model=?, model_provider=?, avatar_color=?, avatar_shape=?, accessory=?, hidden=?, pinned=?, notify_on_updates=?, last_preview=?, last_activity_at=?, unread=?, attention=?, presence=?, current_action=?, updated_at=? WHERE id=?`
      )
      .run(
        next.name,
        next.title,
        next.description,
        next.systemPrompt,
        next.model,
        next.hfModel,
        next.modelProvider,
        next.avatarColor,
        next.avatarShape,
        next.accessory,
        next.hidden ? 1 : 0,
        next.pinned ? 1 : 0,
        next.notifyOnUpdates ? 1 : 0,
        next.lastPreview,
        next.lastActivityAt,
        next.unread ? 1 : 0,
        next.attention,
        next.presence,
        next.currentAction,
        next.updatedAt,
        id
      );
    return this.get(id);
  }

  setPresence(id: string, presence: Presence, action = ''): void {
    this.db
      .prepare(`UPDATE agents SET presence=?, current_action=?, updated_at=? WHERE id=?`)
      .run(presence, action, nowIso(), id);
  }

  markRead(id: string): void {
    this.db.prepare(`UPDATE agents SET unread=0, attention='none', updated_at=? WHERE id=?`).run(nowIso(), id);
  }

  delete(id: string): boolean {
    const run = this.db.transaction(() => {
      if (!this.get(id)) return false;
      this.db.pragma('foreign_keys = ON');
      const exec = (sql: string, ...args: unknown[]) => {
        try {
          this.db.prepare(sql).run(...args);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/no such table/i.test(msg)) return;
          throw e;
        }
      };
      let routineIds: Array<{ id: string }> = [];
      try {
        routineIds = this.db.prepare(`SELECT id FROM routines WHERE agent_id=?`).all(id) as Array<{ id: string }>;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/no such table/i.test(msg)) throw e;
      }
      for (const r of routineIds) {
        exec(`DELETE FROM routine_runs WHERE routine_id=?`, r.id);
      }
      exec(`DELETE FROM routines WHERE agent_id=?`, id);
      exec(`DELETE FROM messages WHERE agent_id=?`, id);
      exec(`DELETE FROM memory WHERE agent_id=?`, id);
      exec(`DELETE FROM agent_inbox WHERE from_agent_id=? OR to_agent_id=?`, id, id);
      exec(`DELETE FROM channel_members WHERE agent_id=?`, id);
      exec(`UPDATE channel_messages SET from_agent_id=NULL WHERE from_agent_id=?`, id);
      exec(`DELETE FROM tasks WHERE agent_id=?`, id);
      exec(`DELETE FROM approvals WHERE agent_id=?`, id);
      exec(`DELETE FROM shares WHERE agent_id=?`, id);
      exec(`UPDATE uploads SET agent_id=NULL WHERE agent_id=?`, id);
      try {
        const lonely = this.db
          .prepare(
            `SELECT c.id FROM channels c LEFT JOIN channel_members m ON m.channel_id=c.id GROUP BY c.id HAVING COUNT(m.agent_id) < 2`
          )
          .all() as Array<{ id: string }>;
        for (const row of lonely) {
          exec(`DELETE FROM channel_messages WHERE channel_id=?`, row.id);
          exec(`DELETE FROM channel_members WHERE channel_id=?`, row.id);
          exec(`DELETE FROM channels WHERE id=?`, row.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/no such table/i.test(msg)) throw e;
      }
      return this.db.prepare(`DELETE FROM agents WHERE id=?`).run(id).changes > 0;
    });
    return run();
  }
}

export class MessageRepo {
  constructor(private db: Db) {}

  listByAgent(agentId: string, limit = 200): ChatMessage[] {
    const rows = this.db
      .prepare(`SELECT * FROM messages WHERE agent_id=? ORDER BY created_at ASC LIMIT ?`)
      .all(agentId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.row(r));
  }

  get(id: string): ChatMessage | undefined {
    const r = this.db.prepare(`SELECT * FROM messages WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    return r ? this.row(r) : undefined;
  }

  add(input: {
    agentId: string;
    role: ChatMessage['role'];
    content: string;
    kind?: ChatMessage['kind'];
    meta?: unknown;
    toolName?: string;
    toolCallId?: string;
    attachments?: AttachmentInfo[];
    replyToId?: string;
  }): ChatMessage {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO messages (id, agent_id, role, content, kind, meta, tool_name, tool_call_id, attachments, reactions, reply_to_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`
      )
      .run(
        id,
        input.agentId,
        input.role,
        input.content,
        input.kind ?? 'text',
        input.meta ? JSON.stringify(input.meta) : null,
        input.toolName ?? null,
        input.toolCallId ?? null,
        input.attachments ? JSON.stringify(input.attachments) : null,
        input.replyToId ?? null,
        now
      );
    return this.get(id)!;
  }

  edit(id: string, content: string): ChatMessage | undefined {
    this.db.prepare(`UPDATE messages SET content=?, edited_at=? WHERE id=?`).run(content, nowIso(), id);
    return this.get(id);
  }

  deleteAfter(agentId: string, createdAt: string): void {
    this.db.prepare(`DELETE FROM messages WHERE agent_id=? AND created_at>=?`).run(agentId, createdAt);
  }

  clear(agentId: string): void {
    this.db.prepare(`DELETE FROM messages WHERE agent_id=?`).run(agentId);
  }

  react(id: string, emoji: string): ChatMessage | undefined {
    const msg = this.get(id);
    if (!msg) return undefined;
    const reactions = [...(msg.reactions ?? [])];
    const found = reactions.find((r) => r.emoji === emoji);
    if (found) found.count += 1;
    else reactions.push({ emoji, count: 1 });
    this.db.prepare(`UPDATE messages SET reactions=? WHERE id=?`).run(JSON.stringify(reactions), id);
    return this.get(id);
  }

  private row(r: Record<string, unknown>): ChatMessage {
    return {
      id: String(r.id),
      agentId: String(r.agent_id),
      role: r.role as ChatMessage['role'],
      content: String(r.content),
      kind: (r.kind as ChatMessage['kind']) || 'text',
      meta: parseJson(r.meta as string | null, undefined),
      toolName: r.tool_name ? String(r.tool_name) : undefined,
      toolCallId: r.tool_call_id ? String(r.tool_call_id) : undefined,
      attachments: parseJson(r.attachments as string | null, undefined),
      reactions: parseJson(r.reactions as string | null, []),
      replyToId: r.reply_to_id ? String(r.reply_to_id) : undefined,
      editedAt: r.edited_at ? String(r.edited_at) : undefined,
      createdAt: String(r.created_at),
    };
  }
}
