#!/usr/bin/env node
/**
 * Dump live SQLite agents WITHOUT wiping.
 * On PC-PORTABLE the source of truth is:
 *   C:\Users\grego\grok_bot_local\data\grok_bot.db
 *
 * Usage:
 *   node scripts/inspect_live_bots.mjs
 *   node scripts/inspect_live_bots.mjs "C:\Users\grego\grok_bot_local\data\grok_bot.db"
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../apps/server/package.json'));

function candidates() {
  const extra = process.argv[2];
  return [
    extra,
    path.join(process.cwd(), 'data', 'grok_bot.db'),
    path.join('C:\\Users\\grego\\grok_bot_local\\data', 'grok_bot.db'),
    path.join(os.homedir(), 'grok_bot_local', 'data', 'grok_bot.db'),
  ].filter(Boolean);
}

const dbPath = candidates().find((p) => fs.existsSync(p));
if (!dbPath) {
  console.error('grok_bot.db introuvable. Passer le chemin en argument.');
  console.error(candidates().join('\n'));
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const cols = db.prepare('PRAGMA table_info(agents)').all().map((c) => c.name);
const agents = db.prepare('SELECT * FROM agents ORDER BY name').all();
const out = {
  dbPath,
  hostname: os.hostname(),
  capturedAt: new Date().toISOString(),
  columns: cols,
  count: agents.length,
  agents: agents.map((a) => ({
    id: a.id,
    name: a.name,
    title: a.title,
    description: a.description,
    specialty: a.specialty,
    domain: a.domain,
    model: a.model,
    hf_model: a.hf_model,
    effort: a.effort,
    hidden: a.hidden,
    systemPromptChars: String(a.system_prompt ?? '').length,
    systemPromptPreview: String(a.system_prompt ?? '').slice(0, 400),
  })),
};
console.log(JSON.stringify(out, null, 2));
db.close();
