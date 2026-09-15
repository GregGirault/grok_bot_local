import type {
  Settings,
  AutoReviewRule,
  WeeklyUsage,
  InboxMessage,
  Channel,
  ChannelMessage,
} from '@grok-bot/shared';
import { DEFAULT_SETTINGS as FALLBACK } from '@grok-bot/shared';
import type { Db } from './schema';
import { nowIso, uuid } from './schema';

export class SettingsRepo {
  constructor(private db: Db) {}

  getAll(): Settings {
    const rows = this.db.prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    let autoReviewRules = FALLBACK.autoReviewRules ?? [];
    let installedPlugins = FALLBACK.installedPlugins ?? ['files', 'browser', 'terminal'];
    let weeklyUsage = FALLBACK.weeklyUsage ?? { messages: 0, tools: 0, weekStart: '' };
    let pluginDisabledTools = FALLBACK.pluginDisabledTools ?? [];
    let botSkills = FALLBACK.botSkills ?? {};
    try {
      if (map.autoReviewRules) {
        const parsed = JSON.parse(map.autoReviewRules) as AutoReviewRule[] | null;
        if (Array.isArray(parsed)) autoReviewRules = parsed;
      }
    } catch {
      /* keep default */
    }
    try {
      if (map.installedPlugins) installedPlugins = JSON.parse(map.installedPlugins) as string[];
    } catch {
      if (map.installedPlugins) installedPlugins = map.installedPlugins.split(',').filter(Boolean);
    }
    try {
      if (map.weeklyUsage) {
        const parsed = JSON.parse(map.weeklyUsage) as WeeklyUsage | null;
        if (parsed && typeof parsed === 'object') weeklyUsage = parsed;
      }
    } catch {
      /* keep default */
    }
    try {
      if (map.pluginDisabledTools) {
        const parsed = JSON.parse(map.pluginDisabledTools) as string[] | null;
        if (Array.isArray(parsed)) pluginDisabledTools = parsed;
      }
    } catch {
      /* keep default */
    }
    try {
      if (map.botSkills) {
        const parsed = JSON.parse(map.botSkills) as Record<string, string[]> | null;
        if (parsed && typeof parsed === 'object') botSkills = parsed;
      }
    } catch {
      /* keep default */
    }
    return {
      ollamaBaseUrl: map.ollamaBaseUrl ?? FALLBACK.ollamaBaseUrl,
      defaultModel: map.defaultModel ?? FALLBACK.defaultModel,
      huggingfaceToken: map.huggingfaceToken || process.env.HF_TOKEN || undefined,
      huggingfaceBaseUrl: map.huggingfaceBaseUrl ?? FALLBACK.huggingfaceBaseUrl ?? 'https://router.huggingface.co/v1',
      geminiApiKey: map.geminiApiKey || process.env.GEMINI_API_KEY || undefined,
      workspaceRoot: map.workspaceRoot ?? '',
      theme: (map.theme as Settings['theme']) ?? 'dark',
      language: (map.language as Settings['language']) ?? 'fr',
      accentColor: map.accentColor ?? '#8b5cf6',
      taskConcurrency: Number(map.taskConcurrency ?? 2),
      timezone: map.timezone ?? 'Europe/Paris',
      timezoneAuto: map.timezoneAuto === 'false' ? false : true,
      notificationsEnabled: map.notificationsEnabled === 'false' ? false : true,
      accountEmail: map.accountEmail ?? FALLBACK.accountEmail,
      localComputerPolicy: (map.localComputerPolicy as Settings['localComputerPolicy']) ?? 'ask',
      githubRepo: map.githubRepo ?? FALLBACK.githubRepo,
      accountName: map.accountName ?? FALLBACK.accountName,
      computerImage: map.computerImage ?? FALLBACK.computerImage,
      installedPlugins,
      pluginDisabledTools,
      botSkills,
      autoReviewRules,
      weeklyUsage,
      autoReviewEnforced: map.autoReviewEnforced === 'false' ? false : true,
      allowCloudAgents: map.allowCloudAgents === 'false' ? false : true,
      publicSharing: map.publicSharing === 'false' ? false : true,
      networkMode: (map.networkMode as Settings['networkMode']) ?? 'allow-all',
      networkAllowlist: (() => {
        try {
          return map.networkAllowlist ? (JSON.parse(map.networkAllowlist) as string[]) : [];
        } catch {
          return [];
        }
      })(),
      actionRecording: map.actionRecording === 'true',
      hostFacts: (() => {
        try {
          return map.hostFacts ? (JSON.parse(map.hostFacts) as Settings['hostFacts']) : undefined;
        } catch {
          return undefined;
        }
      })(),
    };
  }

  set(patch: Partial<Settings>): Settings {
    const upsert = this.db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      upsert.run(k, val);
    }
    return this.getAll();
  }
}

export class InboxRepo {
  constructor(private db: Db) {}

  list(agentId: string): InboxMessage[] {
    const rows = this.db
      .prepare(
        `SELECT i.*, a.name AS from_name FROM agent_inbox i LEFT JOIN agents a ON a.id=i.from_agent_id WHERE i.to_agent_id=? ORDER BY i.created_at DESC`
      )
      .all(agentId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      fromAgentId: String(r.from_agent_id),
      toAgentId: String(r.to_agent_id),
      content: String(r.content),
      read: Boolean(r.read),
      createdAt: String(r.created_at),
      fromAgentName: r.from_name ? String(r.from_name) : undefined,
    }));
  }

  send(fromAgentId: string, toAgentId: string, content: string): InboxMessage {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(`INSERT INTO agent_inbox (id, from_agent_id, to_agent_id, content, read, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
      .run(id, fromAgentId, toAgentId, content, now);
    return { id, fromAgentId, toAgentId, content, read: false, createdAt: now };
  }
}

export class ChannelRepo {
  constructor(private db: Db) {}

  list(): Channel[] {
    const channels = this.db.prepare(`SELECT * FROM channels ORDER BY last_activity_at DESC`).all() as Record<
      string,
      unknown
    >[];
    return channels.map((c) => this.hydrate(c));
  }

  get(id: string): Channel | undefined {
    const c = this.db.prepare(`SELECT * FROM channels WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    return c ? this.hydrate(c) : undefined;
  }

  countAll(): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM channels`).get() as { n: number };
    return Number(r.n);
  }

  create(name: string, description: string, memberIds: string[]): Channel {
    const picked = Array.from(new Set(memberIds)).slice(0, 6);
    if (picked.length < 2) throw new Error('Un groupe compte 2 à 6 bots.');
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(`INSERT INTO channels (id, name, description, last_preview, last_activity_at, created_at) VALUES (?, ?, ?, '', ?, ?)`)
      .run(id, name, description, now, now);
    const ins = this.db.prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`);
    for (const mid of picked) ins.run(id, mid);
    return this.get(id)!;
  }

  delete(id: string): boolean {
    this.db.prepare(`DELETE FROM channel_members WHERE channel_id=?`).run(id);
    this.db.prepare(`DELETE FROM channel_messages WHERE channel_id=?`).run(id);
    return this.db.prepare(`DELETE FROM channels WHERE id=?`).run(id).changes > 0;
  }

  addMember(channelId: string, agentId: string): void {
    const n = (this.db.prepare(`SELECT COUNT(*) AS n FROM channel_members WHERE channel_id=?`).get(channelId) as { n: number })
      .n;
    if (n >= 6) throw new Error('Un groupe compte au plus 6 bots.');
    this.db.prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`).run(channelId, agentId);
  }

  removeMember(channelId: string, agentId: string): void {
    this.db.prepare(`DELETE FROM channel_members WHERE channel_id=? AND agent_id=?`).run(channelId, agentId);
  }

  listMessages(channelId: string): ChannelMessage[] {
    const rows = this.db
      .prepare(`SELECT * FROM channel_messages WHERE channel_id=? ORDER BY created_at ASC`)
      .all(channelId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      channelId: String(r.channel_id),
      fromAgentId: r.from_agent_id ? String(r.from_agent_id) : undefined,
      content: String(r.content),
      createdAt: String(r.created_at),
    }));
  }

  post(channelId: string, content: string, fromAgentId?: string): ChannelMessage {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(`INSERT INTO channel_messages (id, channel_id, from_agent_id, content, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, channelId, fromAgentId ?? null, content, now);
    this.db
      .prepare(`UPDATE channels SET last_preview=?, last_activity_at=? WHERE id=?`)
      .run(content.slice(0, 140), now, channelId);
    return { id, channelId, fromAgentId, content, createdAt: now };
  }

  update(id: string, patch: { name?: string; description?: string; memberIds?: string[] }): Channel | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const name = patch.name?.trim() || cur.name;
    const description = patch.description ?? cur.description;
    this.db.prepare(`UPDATE channels SET name=?, description=? WHERE id=?`).run(name, description, id);
    if (patch.memberIds) {
      const picked = Array.from(new Set(patch.memberIds)).slice(0, 6);
      if (picked.length < 2) throw new Error('Un groupe compte 2 à 6 bots.');
      this.db.prepare(`DELETE FROM channel_members WHERE channel_id=?`).run(id);
      const ins = this.db.prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`);
      for (const mid of picked) ins.run(id, mid);
    }
    return this.get(id);
  }

  private hydrate(c: Record<string, unknown>): Channel {
    const members = this.db
      .prepare(`SELECT agent_id FROM channel_members WHERE channel_id=?`)
      .all(String(c.id)) as Array<{ agent_id: string }>;
    return {
      id: String(c.id),
      name: String(c.name),
      description: String(c.description),
      memberIds: members.map((m) => m.agent_id),
      lastPreview: String(c.last_preview || ''),
      lastActivityAt: String(c.last_activity_at),
      createdAt: String(c.created_at),
    };
  }
}
