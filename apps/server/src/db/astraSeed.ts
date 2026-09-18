import { v4 as uuid } from 'uuid';
import type { Db } from './schema';
import {
  ASTRA_BOTS,
  ASTRA_GROUP_MEMBERS,
  ASTRA_ROSTER_VERSION,
  assertRosterSize,
  ollamaForAstra,
} from './astraRoster';

const ACCESSORIES: Record<string, string> = {
  oracle: 'glasses',
  'helios-probe': 'antenna',
  'argos-watch': 'glasses',
};

const ROLE_MEMORY: Record<string, string> = {
  oracle: 'ORACLE — commandement GPT-6-ASTRA 24/7.',
  'vulcan-forge': 'Forge logicielle ASTRA — TypeScript, React, Fastify, Node, Python, PHP/Symfony.',
  'noesis-grid': 'Architecture Home Assistant OS, NOESIS, MYÉLIA et automatisations maison.',
  'axon-nexus': 'Android, AXON et pont téléphone ↔ PC.',
  'aegis-ledger': 'Recherche marchés, freqtrade et Hyperliquid avec priorité au risque.',
  'mneme-vault': 'Mémoire persistante ASTRA : profile, log, note et scopes agent/user/project.',
  'helios-probe': 'Recherche web sourcée et vérification factuelle.',
  'daedalus-core': 'Windows, opérations locales, diagnostics système et failover.',
  'sovereign-mind': 'Architecture, stratégie et arbitrage entre outils IA.',
  'argos-watch': 'Qualité, revue, tests et chasse aux régressions.',
};

function ensureMemory(db: Db, agentId: string, key: string, value: string): void {
  const existing = db
    .prepare('SELECT id FROM memory WHERE agent_id = ? AND key = ?')
    .get(agentId, key) as { id: string } | undefined;
  if (existing) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO memory (id, agent_id, key, value, tier, scope, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'profile', 'agent', 1, ?, ?)`
  ).run(uuid(), agentId, key, value, now, now);
}

function ensureRoutine(
  db: Db,
  agentId: string,
  name: string,
  cron: string,
  prompt: string,
  enabled = true
): void {
  const existing = db
    .prepare('SELECT id FROM routines WHERE agent_id = ? AND name = ?')
    .get(agentId, name) as { id: string } | undefined;
  if (existing) return;
  db.prepare(
    `INSERT INTO routines (id, agent_id, name, cron, prompt, enabled, quiet_if_empty, timezone, webhook_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'Europe/Paris', ?, ?)`
  ).run(
    uuid(),
    agentId,
    name,
    cron,
    prompt,
    enabled ? 1 : 0,
    uuid().slice(0, 12),
    new Date().toISOString()
  );
}

export function ensureAstraFleet(db: Db): void {
  assertRosterSize();
  const now = new Date().toISOString();
  const ids = new Map<string, string>();

  const tx = db.transaction(() => {
    for (const bot of ASTRA_BOTS) {
      const existing = db.prepare('SELECT id FROM agents WHERE name = ?').get(bot.name) as
        | { id: string }
        | undefined;
      const model = ollamaForAstra(bot);
      const accessory = ACCESSORIES[bot.name] || 'none';

      if (existing) {
        db.prepare(
          `UPDATE agents SET title = ?, description = ?, system_prompt = ?, model = ?, hf_model = ?,
           model_provider = 'ollama', avatar_color = ?, avatar_shape = ?, accessory = ?, hidden = 0,
           pinned = ?, notify_on_updates = 1, updated_at = ? WHERE id = ?`
        ).run(
          bot.specialty,
          bot.description,
          bot.systemPrompt,
          model,
          bot.hfModel,
          bot.avatarColor,
          bot.avatarShape,
          accessory,
          bot.name === 'oracle' ? 1 : 0,
          now,
          existing.id
        );
        ids.set(bot.name, existing.id);
      } else {
        const id = uuid();
        db.prepare(
          `INSERT INTO agents (
             id, name, title, description, system_prompt, model, hf_model, model_provider,
             avatar_color, avatar_shape, accessory, presence, hidden, pinned, notify_on_updates,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ollama', ?, ?, ?, 'idle', 0, ?, 1, ?, ?)`
        ).run(
          id,
          bot.name,
          bot.specialty,
          bot.description,
          bot.systemPrompt,
          model,
          bot.hfModel,
          bot.avatarColor,
          bot.avatarShape,
          accessory,
          bot.name === 'oracle' ? 1 : 0,
          now,
          now
        );
        ids.set(bot.name, id);
      }

      ensureMemory(db, ids.get(bot.name)!, 'astra_role', ROLE_MEMORY[bot.name] || bot.description);
    }

    // Keep the generic bootstrap Bot as an emergency fallback, but hide it from the normal roster.
    db.prepare(`UPDATE agents SET hidden = 1 WHERE name = 'dev'`).run();

    const oracleId = ids.get('oracle');
    if (oracleId) {
      ensureRoutine(
        db,
        oracleId,
        'Briefing du matin',
        '0 8 * * *',
        'Briefing ASTRA : changements du workspace, bloqueurs, tâches actives et décisions en attente. Ne publie rien à l’extérieur.'
      );
    }
    const heliosId = ids.get('helios-probe');
    if (heliosId) {
      ensureRoutine(
        db,
        heliosId,
        'Veille tech',
        '0 9 * * 1',
        'Veille hebdomadaire sourcée : IA locale, Ollama, homelab et tooling. Cinq liens, titre, URL et une ligne de synthèse.',
        false
      );
    }

    let channel = db.prepare(`SELECT id FROM channels WHERE name = 'ASTRA'`).get() as
      | { id: string }
      | undefined;
    if (!channel) {
      const id = uuid();
      db.prepare(
        `INSERT INTO channels (id, name, description, pinned, created_at)
         VALUES (?, 'ASTRA', 'Commandement partagé ORACLE · VULCAN-FORGE · DAEDALUS-CORE', 1, ?)`
      ).run(id, now);
      channel = { id };
    } else {
      db.prepare(`UPDATE channels SET pinned = 1 WHERE id = ?`).run(channel.id);
    }
    const addMember = db.prepare(
      'INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)'
    );
    for (const name of ASTRA_GROUP_MEMBERS) {
      const id = ids.get(name);
      if (id) addMember.run(channel.id, id);
    }

    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('astraRosterVersion', ?)`).run(
      ASTRA_ROSTER_VERSION
    );
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('language', 'fr')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('timezone', 'Europe/Paris')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('defaultModel', 'granite4:micro')`).run();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('installedPlugins', ?)`).run(
      JSON.stringify([
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
      ])
    );
    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('pluginDisabledTools', '[]')`).run();
  });

  tx();
}
