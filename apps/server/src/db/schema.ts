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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
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
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDatabase(dataDir: string): Db {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'grok_bot.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seedDefaults(db);
  return db;
}

function seedDefaults(db: Db): void {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM agents WHERE name = ?').get('dev');
  if (!existing) {
    db.prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      'dev',
      'Developer',
      'Default coding assistant with workspace tools',
      `You are Grok Bot Local — a helpful local AI coding assistant.
You have tools for reading/writing files, listing directories, running shell commands (sandboxed to the workspace), fetching web pages, and searching the web.
Use tools when they help answer accurately. Prefer concise, actionable answers.
When editing code, explain briefly what you changed.`,
      now,
      now
    );
  }

  const defaults: Record<string, string> = {
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'llama3.2',
    workspaceRoot: '',
  };
  const upsert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }
}
