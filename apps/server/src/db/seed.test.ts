import fs from 'fs';
import os from 'os';
import path from 'path';
import { openDatabase } from './schema';
import { hasLiveAstraRoster, seedIfEmpty, SEED_VERSION } from './seed';
import { ASTRA_BOT_NAMES, ASTRA_LIVE_SENTINELS } from './astraRoster';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gb-seed-${label}-`));
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run(): void {
  // 1. Base vide → 10 ASTRA, titres = specialty, groupe ASTRA.
  const emptyDir = tmpDir('empty');
  const emptyDb = openDatabase(emptyDir);
  seedIfEmpty(emptyDb, path.join(emptyDir, 'ws'));
  const emptyAgents = emptyDb.prepare(`SELECT name, title FROM agents ORDER BY name`).all() as Array<{
    name: string;
    title: string;
  }>;
  assert(emptyAgents.length === 10, `attendu 10 bots, got ${emptyAgents.length}`);
  const emptyNames = emptyAgents.map((a) => a.name).sort();
  assert(
    emptyNames.join(',') === [...ASTRA_BOT_NAMES].sort().join(','),
    `noms ASTRA incorrects: ${emptyNames.join(',')}`
  );
  const oracle = emptyAgents.find((a) => a.name === 'oracle');
  assert(oracle?.title.includes('ORACLE'), `2e ligne oracle: ${oracle?.title}`);
  const vulcan = emptyAgents.find((a) => a.name === 'vulcan-forge');
  assert(vulcan?.title.toLowerCase().includes('code') || vulcan?.title.includes('VULCAN'), `titre vulcan: ${vulcan?.title}`);
  const group = emptyDb.prepare(`SELECT name FROM channels WHERE name = 'ASTRA'`).get() as { name: string } | undefined;
  assert(group?.name === 'ASTRA', 'groupe ASTRA manquant');
  const ver = emptyDb.prepare(`SELECT value FROM settings WHERE key = 'seedVersion'`).get() as { value: string };
  assert(ver.value === SEED_VERSION, `seedVersion ${ver.value}`);
  emptyDb.close();

  // 2. oracle + vulcan-forge déjà là → PAS de wipe, id conservé, bot custom conservé.
  const liveDir = tmpDir('live');
  const liveDb = openDatabase(liveDir);
  const keepOracle = 'keep-oracle-id';
  const keepVulcan = 'keep-vulcan-id';
  const keepCustom = 'keep-custom-id';
  const now = new Date().toISOString();
  liveDb
    .prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'ollama', '#111111', 'circle', 'none', 0, 0, 1, 'live', ?, 0, 'none', 'idle', '', ?, ?)`
    )
    .run(keepOracle, 'oracle', 'old-title', 'old-desc', 'PROMPT-LIVE-ORACLE', now, now, now);
  liveDb
    .prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'ollama', '#222222', 'circle', 'none', 0, 0, 1, 'live', ?, 0, 'none', 'idle', '', ?, ?)`
    )
    .run(keepVulcan, 'vulcan-forge', 'old-vulcan', 'old-desc', 'PROMPT-LIVE-VULCAN', now, now, now);
  liveDb
    .prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'ollama', '#333333', 'circle', 'none', 0, 0, 1, 'custom', ?, 0, 'none', 'idle', '', ?, ?)`
    )
    .run(keepCustom, 'mon-bot-perso', 'Perso', 'ne pas toucher', 'PROMPT-CUSTOM', now, now, now);
  liveDb.prepare(`INSERT INTO settings (key, value) VALUES ('seedVersion', '0.12.1')`).run();
  liveDb.prepare(`INSERT INTO settings (key, value) VALUES ('installedPlugins', ?)`).run(
    JSON.stringify(['files', 'browser', 'terminal'])
  );
  liveDb
    .prepare(`INSERT INTO messages (id, agent_id, role, content, kind, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('keep-oracle-msg', keepOracle, 'user', 'PROMPT-LIVE-MSG', 'text', null, now);
  liveDb
    .prepare(
      `INSERT INTO memory (id, agent_id, key, value, tier, scope, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run('keep-oracle-mem', keepOracle, 'live-fact', 'PROMPT-LIVE-MEM', 'profile', 'agent', now, now);
  assert(hasLiveAstraRoster(liveDb), 'sentinelles oracle+vulcan-forge absentes');
  seedIfEmpty(liveDb, path.join(liveDir, 'ws'));
  const after = liveDb.prepare(`SELECT id, name, title, system_prompt FROM agents`).all() as Array<{
    id: string;
    name: string;
    title: string;
    system_prompt: string;
  }>;
  const byName = Object.fromEntries(after.map((a) => [a.name, a]));
  assert(byName.oracle?.id === keepOracle, 'id oracle wipe');
  assert(byName['vulcan-forge']?.id === keepVulcan, 'id vulcan wipe');
  assert(byName['mon-bot-perso']?.id === keepCustom, 'bot custom supprimé');
  assert(byName.oracle.system_prompt === 'PROMPT-LIVE-ORACLE', 'system_prompt oracle écrasé');
  assert(byName['vulcan-forge'].system_prompt === 'PROMPT-LIVE-VULCAN', 'system_prompt vulcan écrasé');
  assert(byName['mon-bot-perso'].system_prompt === 'PROMPT-CUSTOM', 'prompt custom écrasé');
  assert(byName.oracle.title.includes('ORACLE'), `titre oracle non rafraîchi: ${byName.oracle.title}`);
  const liveMsg = liveDb.prepare(`SELECT content FROM messages WHERE id = ?`).get('keep-oracle-msg') as
    | { content: string }
    | undefined;
  assert(liveMsg?.content === 'PROMPT-LIVE-MSG', 'message oracle wipe');
  const liveMem = liveDb.prepare(`SELECT value FROM memory WHERE id = ?`).get('keep-oracle-mem') as
    | { value: string }
    | undefined;
  assert(liveMem?.value === 'PROMPT-LIVE-MEM', 'mémoire oracle wipe');
  const msgCount = liveDb.prepare(`SELECT COUNT(*) AS n FROM messages WHERE agent_id = ?`).get(keepOracle) as { n: number };
  assert(msgCount.n === 1, `messages oracle inattendus: ${msgCount.n}`);
  for (const n of ASTRA_BOT_NAMES) {
    assert(byName[n], `bot manquant après preserve: ${n}`);
  }
  const liveVer = liveDb.prepare(`SELECT value FROM settings WHERE key = 'seedVersion'`).get() as { value: string };
  assert(liveVer.value === SEED_VERSION, `seedVersion live ${liveVer.value}`);
  const plugsRow = liveDb.prepare(`SELECT value FROM settings WHERE key = 'installedPlugins'`).get() as { value: string };
  const plugs = JSON.parse(plugsRow.value) as string[];
  assert(plugs.includes('files') && plugs.includes('terminal'), 'plugins live écrasés');
  assert(plugs.includes('mcp'), 'plugin mcp non ajouté (UI default, sans wipe)');
  assert(ASTRA_LIVE_SENTINELS.length === 2, 'sentinelles');
  liveDb.close();

  // 3. Anciens 12 experts (astra/vertex) sans ASTRA → wipe puis ASTRA 10.
  const oldDir = tmpDir('old12');
  const oldDb = openDatabase(oldDir);
  oldDb
    .prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
       VALUES ('a1', 'astra', 'Cerveau', '', 'old', '', '', 'ollama', '#FF6A00', 'blob', 'none', 0, 1, 1, '', ?, 0, 'none', 'idle', '', ?, ?)`
    )
    .run(now, now, now);
  oldDb
    .prepare(
      `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
       VALUES ('v1', 'vertex', 'Code', '', 'old', '', '', 'ollama', '#4A90E2', 'hexagon', 'none', 0, 0, 1, '', ?, 0, 'none', 'idle', '', ?, ?)`
    )
    .run(now, now, now);
  oldDb.prepare(`INSERT INTO settings (key, value) VALUES ('seedVersion', '0.12.1')`).run();
  seedIfEmpty(oldDb, path.join(oldDir, 'ws'));
  const migrated = oldDb.prepare(`SELECT name FROM agents`).all() as Array<{ name: string }>;
  const migratedNames = new Set(migrated.map((a) => a.name));
  assert(!migratedNames.has('astra'), 'astra 12-experts encore là');
  assert(!migratedNames.has('vertex'), 'vertex 12-experts encore là');
  assert(migratedNames.has('oracle') && migratedNames.has('vulcan-forge'), 'ASTRA non semé après wipe 12-experts');
  assert(migrated.length === 10, `après wipe 12-experts: ${migrated.length}`);
  oldDb.close();

  console.log('seed safety OK');
}

run();
