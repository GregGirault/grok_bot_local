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
  avatar_color TEXT NOT NULL DEFAULT '#8b5cf6',
  avatar_shape TEXT NOT NULL DEFAULT 'circle',
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
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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
  created_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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
  if (!hasColumn(db, 'agents', 'avatar_shape')) {
    db.exec(`ALTER TABLE agents ADD COLUMN avatar_shape TEXT NOT NULL DEFAULT 'circle'`);
  }
  if (!hasColumn(db, 'messages', 'kind')) {
    db.exec(`ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`);
  }
  if (!hasColumn(db, 'messages', 'meta')) {
    db.exec(`ALTER TABLE messages ADD COLUMN meta TEXT`);
  }
  if (!hasColumn(db, 'memory', 'tier')) {
    db.exec(`ALTER TABLE memory ADD COLUMN tier TEXT NOT NULL DEFAULT 'note'`);
  }
  if (!hasColumn(db, 'memory', 'scope')) {
    db.exec(`ALTER TABLE memory ADD COLUMN scope TEXT NOT NULL DEFAULT 'agent'`);
  }
  if (!hasColumn(db, 'routines', 'quiet_if_empty')) {
    db.exec(`ALTER TABLE routines ADD COLUMN quiet_if_empty INTEGER NOT NULL DEFAULT 0`);
  }
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
      `INSERT INTO agents (id, name, title, description, system_prompt, avatar_color, avatar_shape, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
  };
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }
}
