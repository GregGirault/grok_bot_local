import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  hf_model TEXT NOT NULL DEFAULT '',
  model_provider TEXT NOT NULL DEFAULT 'ollama',
  avatar_color TEXT NOT NULL DEFAULT '#8b5cf6',
  avatar_shape TEXT NOT NULL DEFAULT 'circle',
  accessory TEXT NOT NULL DEFAULT 'none',
  presence TEXT NOT NULL DEFAULT 'idle',
  hidden INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  notify_on_updates INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  meta TEXT,
  tool_name TEXT,
  tool_call_id TEXT,
  attachments TEXT,
  parent_message_id TEXT,
  reactions TEXT,
  edited_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'note',
  scope TEXT NOT NULL DEFAULT 'agent',
  project_id TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(agent_id, key),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cron TEXT NOT NULL,
  prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  quiet_if_empty INTEGER NOT NULL DEFAULT 0,
  timezone TEXT,
  webhook_token TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_runs (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_inbox (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (to_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, agent_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  from_agent_id TEXT,
  content TEXT NOT NULL,
  reply_to_id TEXT,
  reactions TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error TEXT,
  parent_task_id TEXT,
  post_to_chat INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT 'localhost',
  path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_team_members (
  channel_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  created_at TEXT NOT NULL
);
`;

function hasColumn(db: Db, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function migrate(db: Db): void {
  if (!hasColumn(db, 'agents', 'avatar_color')) {
    db.exec(`ALTER TABLE agents ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#8b5cf6'`);
  }
  if (!hasColumn(db, 'agents', 'model')) {
    db.exec(`ALTER TABLE agents ADD COLUMN model TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(db, 'agents', 'hf_model')) {
    db.exec(`ALTER TABLE agents ADD COLUMN hf_model TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(db, 'agents', 'model_provider')) {
    db.exec(`ALTER TABLE agents ADD COLUMN model_provider TEXT NOT NULL DEFAULT 'ollama'`);
  }
  if (!hasColumn(db, 'agents', 'avatar_shape')) {
    db.exec(`ALTER TABLE agents ADD COLUMN avatar_shape TEXT NOT NULL DEFAULT 'circle'`);
  }
  if (!hasColumn(db, 'agents', 'accessory')) {
    db.exec(`ALTER TABLE agents ADD COLUMN accessory TEXT NOT NULL DEFAULT 'none'`);
  }
  if (!hasColumn(db, 'agents', 'presence')) {
    db.exec(`ALTER TABLE agents ADD COLUMN presence TEXT NOT NULL DEFAULT 'idle'`);
  }
  if (!hasColumn(db, 'agents', 'hidden')) {
    db.exec(`ALTER TABLE agents ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'agents', 'notify_on_updates')) {
    db.exec(`ALTER TABLE agents ADD COLUMN notify_on_updates INTEGER NOT NULL DEFAULT 1`);
  }
  if (!hasColumn(db, 'agents', 'pinned')) {
    db.exec(`ALTER TABLE agents ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'messages', 'kind')) {
    db.exec(`ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`);
  }
  if (!hasColumn(db, 'messages', 'meta')) {
    db.exec(`ALTER TABLE messages ADD COLUMN meta TEXT`);
  }
  if (!hasColumn(db, 'messages', 'attachments')) {
    db.exec(`ALTER TABLE messages ADD COLUMN attachments TEXT`);
  }
  if (!hasColumn(db, 'messages', 'edited_at')) {
    db.exec(`ALTER TABLE messages ADD COLUMN edited_at TEXT`);
  }
  if (!hasColumn(db, 'messages', 'parent_message_id')) {
    db.exec(`ALTER TABLE messages ADD COLUMN parent_message_id TEXT`);
  }
  if (!hasColumn(db, 'messages', 'reactions')) {
    db.exec(`ALTER TABLE messages ADD COLUMN reactions TEXT`);
  }
  if (!hasColumn(db, 'memory', 'tier')) {
    db.exec(`ALTER TABLE memory ADD COLUMN tier TEXT NOT NULL DEFAULT 'note'`);
  }
  if (!hasColumn(db, 'memory', 'scope')) {
    db.exec(`ALTER TABLE memory ADD COLUMN scope TEXT NOT NULL DEFAULT 'agent'`);
  }
  if (!hasColumn(db, 'memory', 'project_id')) {
    db.exec(`ALTER TABLE memory ADD COLUMN project_id TEXT`);
  }
  if (!hasColumn(db, 'memory', 'pinned')) {
    db.exec(`ALTER TABLE memory ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'routines', 'quiet_if_empty')) {
    db.exec(`ALTER TABLE routines ADD COLUMN quiet_if_empty INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'routines', 'webhook_token')) {
    db.exec(`ALTER TABLE routines ADD COLUMN webhook_token TEXT`);
  }
  if (!hasColumn(db, 'routines', 'timezone')) {
    db.exec(`ALTER TABLE routines ADD COLUMN timezone TEXT`);
  }
  if (!hasColumn(db, 'channels', 'pinned')) {
    db.exec(`ALTER TABLE channels ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'channel_messages', 'reply_to_id')) {
    db.exec(`ALTER TABLE channel_messages ADD COLUMN reply_to_id TEXT`);
  }
  if (!hasColumn(db, 'channel_messages', 'reactions')) {
    db.exec(`ALTER TABLE channel_messages ADD COLUMN reactions TEXT`);
  }
  if (!hasColumn(db, 'tasks', 'parent_task_id')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN parent_task_id TEXT`);
  }
  if (!hasColumn(db, 'tasks', 'post_to_chat')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN post_to_chat INTEGER NOT NULL DEFAULT 1`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_agent_created ON messages(agent_id, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_created ON channel_messages(channel_id, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_routine_runs_routine_created ON routine_runs(routine_id, created_at)`);
}

export function openDatabase(dataDir: string): Db {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'grok_bot.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  seedDefaults(db);
  return db;
}

function seedDefaults(db: Db): void {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM agents WHERE name = ?').get('dev');
  if (!existing) {
    db.prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, avatar_color, avatar_shape, hidden, pinned, notify_on_updates, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`
    ).run(
      uuid(),
      'dev',
      'Developer',
      'Default coding assistant with workspace tools',
      `You are Grok Bot Local — a helpful local AI coding assistant.
You have tools for reading/writing files, listing directories, running shell commands (sandboxed to the workspace), fetching web pages, searching the web, browser automation, messaging other agents, and asking the user questions via widgets.
Use tools when they help answer accurately. Prefer concise, actionable answers.
When editing code, explain briefly what you changed.`,
      '#8b5cf6',
      'circle',
      now,
      now
    );
  }

  const defaults: Record<string, string> = {
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'qwen2.5:7b',
    workspaceRoot: '',
    theme: 'dark',
    language: 'en',
    accentColor: '#8b5cf6',
    taskConcurrency: '2',
    githubRepo: 'GregGirault/grok_bot_local',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    localExecutionPolicy: 'ask',
    autoReviewEnabled: 'true',
    autoReviewAskPatterns: '[]',
    autoReviewAllowPatterns: '[]',
    installedPlugins: JSON.stringify([
      'files',
      'browser',
      'terminal',
      'mail',
      'calendar',
      'github',
      'slack',
      'drive',
      'mcp',
      'linear',
      'crm',
      'notion',
      'x',
    ]),
    pluginDisabledTools: '[]',
  };
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }

  const localMachine = db.prepare('SELECT id FROM machines WHERE name = ?').get('This machine');
  if (!localMachine) {
    db.prepare(
      `INSERT INTO machines (id, name, host, path, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(uuid(), 'This machine', 'localhost', '', now);
  }
}
