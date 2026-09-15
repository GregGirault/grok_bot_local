/**
 * Seed fusion Grok chrome + flotte GPT-6-ASTRA 10.
 *
 * SEED_VERSION peut avancer. Un mismatch NE doit PAS DELETE FROM agents
 * si la base live contient déjà oracle + vulcan-forge (PC-PORTABLE).
 * Dans ce cas : titres roster manquants, réglages UI absents, groupe ASTRA
 * s’il n’existe pas — jamais un wipe.
 */
import type { Db } from './schema';
import { uuid } from './schema';
import { PREMIUM_KERNEL, USER_MACHINE } from '../services/promptKernel';
import {
  ASTRA_BOTS,
  ASTRA_GROUP_MEMBERS,
  ASTRA_LIVE_SENTINELS,
  assertRosterSize,
  ollamaForAstra,
  type AstraBotSeed,
} from './astraRoster';

export const SEED_VERSION = '0.13.0';

interface SeedMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
  minutesAgo: number;
}

interface SeedExtras {
  pinned?: boolean;
  preview: string;
  minutesAgo: number;
  unread?: boolean;
  attention?: string;
  accessory?: string;
  memory?: Array<{ key: string; value: string; tier: string }>;
  messages: SeedMsg[];
  routines?: Array<{ name: string; cron: string; prompt: string; enabled?: boolean }>;
}

function packPrompt(astraPrompt: string): string {
  return `${PREMIUM_KERNEL}\n\n${USER_MACHINE}\n\n${astraPrompt.trim()}`;
}

const EXTRAS: Record<string, SeedExtras> = {
  oracle: {
    pinned: true,
    preview: 'Flotte ASTRA en ligne. Je route, je suis, je n’oublie rien.',
    minutesAgo: 6,
    unread: true,
    attention: 'needs_attention',
    accessory: 'glasses',
    memory: [{ key: 'role', value: 'ORACLE — commandement GPT-6-ASTRA 24/7.', tier: 'profile' }],
    messages: [
      {
        role: 'assistant',
        content:
          'Fusion Grok + ASTRA 10. Ollama 24/7 ; HF_TOKEN et GEMINI_API_KEY dans Réglages. Ordi en « toujours » — je demande avant destruction / force-push / envoi. Vulcan pour le diff, Daedalus pour le PC.',
        minutesAgo: 6,
      },
    ],
    routines: [
      {
        name: 'Briefing du matin',
        cron: '0 8 * * *',
        prompt: 'Briefing : ce qui a bougé dans le workspace, bloqueurs, décisions en attente. N’envoie rien.',
      },
    ],
  },
  'vulcan-forge': {
    preview: 'Montre le repo. Je lis, puis je code.',
    minutesAgo: 14,
    memory: [{ key: 'stack', value: 'TypeScript, React, Fastify, Python, PHP/Symfony.', tier: 'profile' }],
    messages: [{ role: 'assistant', content: 'Colle le traceback ou le chemin. Je lis avant d’écrire une ligne.', minutesAgo: 14 }],
  },
  'noesis-grid': {
    preview: 'HAOS : le symptôme d’abord, le YAML ensuite.',
    minutesAgo: 55,
    messages: [{ role: 'assistant', content: 'Dis la pièce ou l’automatisation. Je ne coupe jamais chauffage / serrure sans garde-fou.', minutesAgo: 55 }],
  },
  'axon-nexus': {
    preview: 'Pont téléphone ↔ PC. Device RFCY90YLP1R.',
    minutesAgo: 80,
    messages: [{ role: 'assistant', content: 'AXON / Android : latence, offline, contrat d’API avec le PC.', minutesAgo: 80 }],
  },
  'aegis-ledger': {
    preview: 'Recherche seulement. Zéro ordre réel.',
    minutesAgo: 90,
    messages: [{ role: 'assistant', content: 'Recherche marchés — zéro ordre. Paire ou sujet, sources + risques.', minutesAgo: 90 }],
  },
  'mneme-vault': {
    preview: 'Un fait durable ? Je l’écris. Je ne redemande pas.',
    minutesAgo: 110,
    messages: [{ role: 'assistant', content: 'Donne le fait (chemin, décision, préférence). Je le pin en mémoire.', minutesAgo: 110 }],
  },
  'helios-probe': {
    preview: 'Donne le sujet. Je sors des URLs, pas des impressions.',
    minutesAgo: 22,
    accessory: 'antenna',
    messages: [{ role: 'assistant', content: 'Sujet → 2–4 requêtes, URLs, synthèse sourcée.', minutesAgo: 22 }],
    routines: [
      {
        name: 'Veille tech',
        cron: '0 9 * * 1',
        prompt: 'Cinq liens de la semaine (IA locale, Ollama, homelab, trading). Titre + URL + une ligne. N’envoie rien.',
        enabled: false,
      },
    ],
  },
  'daedalus-core': {
    preview: 'PC-PORTABLE : le symptôme, puis la commande + rollback.',
    minutesAgo: 40,
    memory: [{ key: 'host', value: 'PC-PORTABLE Win11, i5-1240P, 64 Go, RTX 2050 + Iris Xe.', tier: 'log' }],
    messages: [{ role: 'assistant', content: 'Dis le symptôme. nvidia-smi avant de pousser un 14B/30B.', minutesAgo: 40 }],
  },
  'sovereign-mind': {
    preview: 'Objectif, options, décision. Pas de scope creep.',
    minutesAgo: 120,
    messages: [{ role: 'assistant', content: 'Pose l’arbitrage (Cursor / Codex / local). ADR court.', minutesAgo: 120 }],
  },
  'argos-watch': {
    preview: 'Colle le diff. Findings + preuve, ou c’est propre.',
    minutesAgo: 260,
    accessory: 'glasses',
    messages: [{ role: 'assistant', content: 'Colle le diff. Sévérité, fichier:ligne, chemin de vérif.', minutesAgo: 260 }],
  },
};

function extrasFor(name: string): SeedExtras {
  const hit = EXTRAS[name];
  if (hit) return hit;
  return {
    preview: '',
    minutesAgo: 30,
    messages: [],
  };
}

export function hasLiveAstraRoster(db: Db): boolean {
  const rows = db.prepare(`SELECT name FROM agents`).all() as Array<{ name: string }>;
  const names = new Set(rows.map((r) => r.name.toLowerCase()));
  return ASTRA_LIVE_SENTINELS.every((n) => names.has(n));
}

function readSeedVersion(db: Db): string {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'seedVersion'`).get() as { value: string } | undefined;
    return row?.value ?? '';
  } catch {
    return '';
  }
}

function wipeSeedData(db: Db): void {
  if (hasLiveAstraRoster(db)) {
    throw new Error(
      'Refus de wipe : oracle + vulcan-forge sont en base. Messages, mémoire et agents ASTRA restent.'
    );
  }
  db.exec(`
    DELETE FROM channel_members;
    DELETE FROM channel_messages;
    DELETE FROM channels;
    DELETE FROM messages;
    DELETE FROM memory;
    DELETE FROM routine_runs;
    DELETE FROM routines;
    DELETE FROM agent_inbox;
    DELETE FROM tasks;
    DELETE FROM approvals;
    DELETE FROM uploads;
    DELETE FROM agents;
    DELETE FROM team_members;
    DELETE FROM machines;
  `);
  try {
    db.exec(`DELETE FROM shares;`);
  } catch {
    /* table added in later migrate */
  }
}

function insertAgentRow(db: Db, bot: AstraBotSeed, extra: SeedExtras, now: number): string {
  const id = uuid();
  const activity = new Date(now - extra.minutesAgo * 60_000).toISOString();
  const created = new Date(now - 14 * 86400000).toISOString();
  db.prepare(
    `INSERT INTO agents (id, name, title, description, system_prompt, model, hf_model, model_provider, avatar_color, avatar_shape, accessory, hidden, pinned, notify_on_updates, last_preview, last_activity_at, unread, attention, presence, current_action, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ollama', ?, ?, ?, 0, ?, 1, ?, ?, ?, ?, 'idle', '', ?, ?)`
  ).run(
    id,
    bot.name,
    bot.specialty,
    bot.description,
    packPrompt(bot.systemPrompt),
    ollamaForAstra(bot),
    bot.hfModel,
    bot.avatarColor,
    bot.avatarShape,
    extra.accessory ?? 'none',
    extra.pinned ? 1 : 0,
    extra.preview,
    activity,
    extra.unread ? 1 : 0,
    extra.attention ?? 'none',
    created,
    activity
  );
  const insertMsg = db.prepare(
    `INSERT INTO messages (id, agent_id, role, content, kind, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const m of extra.messages) {
    insertMsg.run(uuid(), id, m.role, m.content, 'text', null, new Date(now - m.minutesAgo * 60_000).toISOString());
  }
  const insertMem = db.prepare(
    `INSERT INTO memory (id, agent_id, key, value, tier, scope, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );
  for (const mem of extra.memory ?? []) {
    insertMem.run(uuid(), id, mem.key, mem.value, mem.tier, 'agent', activity, activity);
  }
  const insertRoutine = db.prepare(
    `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, quiet_if_empty, webhook_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );
  for (const r of extra.routines ?? []) {
    insertRoutine.run(uuid(), id, r.name, r.cron, r.prompt, r.enabled === false ? 0 : 1, uuid().slice(0, 12), created);
  }
  return id;
}

function agentIdByName(db: Db, name: string): string | undefined {
  const row = db.prepare(`SELECT id FROM agents WHERE name = ?`).get(name) as { id: string } | undefined;
  return row?.id;
}

function refreshAstraPresentation(db: Db): void {
  const upd = db.prepare(
    `UPDATE agents SET title = ?, description = CASE WHEN description = '' THEN ? ELSE description END,
     avatar_color = CASE WHEN avatar_color IN ('', '#8b5cf6') THEN ? ELSE avatar_color END,
     avatar_shape = CASE WHEN avatar_shape IN ('', 'blob') THEN ? ELSE avatar_shape END,
     model = CASE WHEN model = '' THEN ? ELSE model END,
     hf_model = CASE WHEN hf_model = '' THEN ? ELSE hf_model END,
     model_provider = CASE WHEN model_provider = '' THEN 'ollama' ELSE model_provider END,
     updated_at = ?
     WHERE name = ?`
  );
  const now = new Date().toISOString();
  for (const bot of ASTRA_BOTS) {
    upd.run(
      bot.specialty,
      bot.description,
      bot.avatarColor,
      bot.avatarShape,
      ollamaForAstra(bot),
      bot.hfModel,
      now,
      bot.name
    );
  }
}

function fillMissingAstraBots(db: Db, now: number): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const bot of ASTRA_BOTS) {
    const existing = agentIdByName(db, bot.name);
    if (existing) {
      ids[bot.name] = existing;
      continue;
    }
    ids[bot.name] = insertAgentRow(db, bot, extrasFor(bot.name), now);
  }
  return ids;
}

function ensureAstraGroup(db: Db, ids: Record<string, string>, now: number): void {
  const members = ASTRA_GROUP_MEMBERS.map((n) => ids[n]).filter(Boolean);
  if (members.length < 2) return;
  const existing = db.prepare(`SELECT id FROM channels WHERE name = ?`).get('ASTRA') as { id: string } | undefined;
  if (existing) return;
  const groupId = uuid();
  const gNow = new Date(now - 60 * 11 * 60_000).toISOString();
  db.prepare(
    `INSERT INTO channels (id, name, description, last_preview, last_activity_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(groupId, 'ASTRA', 'ORACLE, VULCAN-FORGE, DAEDALUS-CORE — commandement, code, ops.', 'Oracle : flotte GPT-6-ASTRA 10, chrome Grok.', gNow, gNow);
  const addMem = db.prepare(`INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)`);
  for (const id of members) addMem.run(groupId, id);
  const oracleId = ids.oracle;
  if (oracleId) {
    db.prepare(`INSERT INTO channel_messages (id, channel_id, from_agent_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      uuid(),
      groupId,
      oracleId,
      '64 Go + RTX 2050 : 30B pour le commandement, coder 14B, 14B/8B pour le reste. HF_TOKEN dans Réglages pour le cloud open-weights.',
      gNow
    );
  }
}

function uiSettings(workspaceRoot: string): Record<string, string> {
  return {
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'qwen2.5:14b',
    huggingfaceBaseUrl: 'https://router.huggingface.co/v1',
    workspaceRoot,
    theme: 'dark',
    language: 'fr',
    accentColor: '#8b5cf6',
    taskConcurrency: '2',
    timezone: 'Europe/Paris',
    localComputerPolicy: 'always',
    autoReviewEnforced: 'true',
    autoReviewRules: JSON.stringify([
      { id: 'hard-rm', kind: 'require', pattern: 'rm -', toolName: 'shell' },
      { id: 'hard-mkfs', kind: 'require', pattern: 'mkfs', toolName: 'shell' },
      { id: 'hard-force', kind: 'require', pattern: 'push --force', toolName: 'shell' },
      { id: 'hard-format', kind: 'require', pattern: 'format ', toolName: 'shell' },
    ]),
    githubRepo: 'GregGirault/grok_bot_local',
    accountName: '3pas sage .',
    accountEmail: 'yakary88@gmail.com',
    computerImage: 'local-1',
    installedPlugins: JSON.stringify(['files', 'browser', 'terminal', 'mcp']),
    publicSharing: 'false',
    seedVersion: SEED_VERSION,
  };
}

function fillMissingUiSettings(db: Db, workspaceRoot: string): void {
  const existing = db.prepare(`SELECT key FROM settings`).all() as Array<{ key: string }>;
  const have = new Set(existing.map((r) => r.key));
  const insert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
  const settings = uiSettings(workspaceRoot);
  for (const [k, v] of Object.entries(settings)) {
    if (k === 'seedVersion') continue;
    if (!have.has(k)) insert.run(k, v);
  }
  ensureMcpPluginListed(db);
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('seedVersion', ?)`).run(SEED_VERSION);
}

/** Ajoute mcp à installedPlugins s’il manque — n’écrase pas les autres plugins live. */
function ensureMcpPluginListed(db: Db): void {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'installedPlugins'`).get() as { value: string } | undefined;
  if (!row) return;
  try {
    const list = JSON.parse(row.value) as unknown;
    if (!Array.isArray(list)) return;
    const names = list.map((x) => String(x));
    if (names.includes('mcp')) return;
    names.push('mcp');
    db.prepare(`UPDATE settings SET value = ? WHERE key = 'installedPlugins'`).run(JSON.stringify(names));
  } catch {
    /* ignore malformed */
  }
}

function ensureAccountAndMachine(db: Db, workspaceRoot: string): void {
  const members = db.prepare(`SELECT COUNT(*) AS n FROM team_members`).get() as { n: number };
  if (members.n === 0) {
    db.prepare(`INSERT INTO team_members (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      uuid(),
      '3pas sage .',
      'yakary88@gmail.com',
      'propriétaire',
      new Date().toISOString()
    );
  }
  const machines = db.prepare(`SELECT COUNT(*) AS n FROM machines`).get() as { n: number };
  if (machines.n === 0) {
    db.prepare(`INSERT INTO machines (id, name, host, path, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      uuid(),
      'Cet ordinateur',
      'localhost',
      workspaceRoot,
      new Date().toISOString()
    );
  }
}

function preserveLiveAstra(db: Db, workspaceRoot: string): void {
  const now = Date.now();
  const tx = db.transaction(() => {
    const ids = fillMissingAstraBots(db, now);
    refreshAstraPresentation(db);
    ensureAstraGroup(db, ids, now);
    fillMissingUiSettings(db, workspaceRoot);
    ensureAccountAndMachine(db, workspaceRoot);
  });
  tx();
}

function fullSeed(db: Db, workspaceRoot: string): void {
  const now = Date.now();
  const tx = db.transaction(() => {
    const ids: Record<string, string> = {};
    for (const bot of ASTRA_BOTS) {
      ids[bot.name] = insertAgentRow(db, bot, extrasFor(bot.name), now);
    }

    const oracleId = ids.oracle;
    const insertMem = db.prepare(
      `INSERT INTO memory (id, agent_id, key, value, tier, scope, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    );
    if (oracleId) {
      const userFacts: Array<{ key: string; value: string }> = [
        {
          key: 'machine',
          value: 'PC-PORTABLE, Windows 11 Pro, i5-1240P 16 threads, 63,7 Go RAM, RTX 2050 + Iris Xe, C: ~1,1 To libre, Ollama joignable.',
        },
        {
          key: 'habitudes',
          value: 'Cursor, Grok Bot local, Codex Desktop, HAOS/homelab, freqtrade/crypto, PHP/Symfony plus ancien. IA surtout via Cursor / Grok Bot.',
        },
      ];
      for (const f of userFacts) {
        insertMem.run(uuid(), oracleId, f.key, f.value, 'profile', 'user', new Date().toISOString(), new Date().toISOString());
      }
    }

    ensureAstraGroup(db, ids, now);

    const up = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
    for (const [k, v] of Object.entries(uiSettings(workspaceRoot))) up.run(k, v);

    ensureAccountAndMachine(db, workspaceRoot);
  });
  tx();
}

export function seedIfEmpty(db: Db, workspaceRoot: string): void {
  assertRosterSize();
  const count = db.prepare(`SELECT COUNT(*) AS n FROM agents`).get() as { n: number };
  const ver = readSeedVersion(db);
  const liveAstra = hasLiveAstraRoster(db);

  if (liveAstra) {
    if (ver === SEED_VERSION) {
      refreshAstraPresentation(db);
      ensureMcpPluginListed(db);
      return;
    }
    preserveLiveAstra(db, workspaceRoot);
    return;
  }

  if (count.n > 0 && ver === SEED_VERSION) return;
  if (count.n > 0) wipeSeedData(db);
  fullSeed(db, workspaceRoot);
}
