import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import type { AutoReviewRule, SharePayload } from '@grok-bot/shared';
import { loadSkills } from '../services/skills';
import {
  getComputer,
  setTakeover,
  pushComputer,
  snapshotWorkspace,
  resetWorkspace,
  recoverComputer,
  listWorkspaceFiles,
  setSetupPhase,
} from '../services/computer';
import { listPlugins, installPlugin, uninstallPlugin, togglePluginTool } from '../services/plugins';
import { getMcpConfigRaw, saveMcpConfig, summarizeMcp, type McpServerEntry } from '../services/mcp';
import { addNotice, listNotices, dismissNotice, dismissAll } from '../services/notices';
import { startTeach, addTeachStep, stopTeach, getTeach } from '../services/teach';
import type { HttpDeps } from './deps';

export function registerHttpExtra(d: HttpDeps): void {
  const {
    app,
    settings,
    defaultWorkspace,
    dataDir,
    secrets,
    skillsDir,
    shares,
    agents,
    routines,
    projectRoot,
    messages,
    uploads,
    channels,
  } = d;

  app.get('/api/computer', async (req) => {
    const q = req.query as { agentId?: string };
    return getComputer(q.agentId);
  });
  app.post('/api/computer/takeover', async (req) => {
    const b = req.body as { on: boolean; agentId?: string };
    setTakeover(b.on);
    if (b.agentId) pushComputer(b.agentId, 'status', b.on ? 'Prise de contrôle' : 'Contrôle rendu');
    return getComputer(b.agentId);
  });
  app.post('/api/computer/navigate', async (req) => {
    const b = req.body as { agentId: string; url: string };
    pushComputer(b.agentId, 'navigate', b.url);
    return getComputer(b.agentId);
  });
  app.post('/api/computer/update', async () => {
    setSetupPhase('updating');
    await new Promise((r) => setTimeout(r, 700));
    const s = settings.getAll();
    const r = snapshotWorkspace(s.workspaceRoot || defaultWorkspace, dataDir);
    settings.set({ computerImage: `local-${Date.now().toString(36)}` });
    addNotice({ title: 'Ordinateur mis à jour', body: 'Image locale reconstruite, workspace conservé.' });
    return { ok: true, path: r.path, computer: getComputer() };
  });
  app.post('/api/computer/recover', async () => {
    recoverComputer();
    addNotice({ title: 'Ordinateur récupéré', body: 'L’écran a été réinitialisé. Les fichiers du workspace sont intacts.' });
    return { ok: true, computer: getComputer() };
  });
  app.post('/api/computer/reset', async () => {
    const s = settings.getAll();
    const r = resetWorkspace(s.workspaceRoot || defaultWorkspace, dataDir);
    addNotice({
      title: r.ok ? 'Ordinateur réinitialisé' : 'Pas d’instantané',
      body: r.ok ? 'Retour au dernier instantané durable.' : 'Fais d’abord « Mettre à jour l’ordinateur » pour créer un instantané.',
    });
    return { ok: r.ok, computer: getComputer() };
  });
  app.get('/api/computer/files', async (req) => {
    const q = req.query as { path?: string };
    const s = settings.getAll();
    return { files: listWorkspaceFiles(s.workspaceRoot || defaultWorkspace, q.path || '.'), computer: getComputer() };
  });
  app.post('/api/computer/type', async (req) => {
    const b = req.body as { agentId: string; text: string };
    pushComputer(b.agentId, 'type', b.text);
    return getComputer(b.agentId);
  });
  app.post('/api/computer/click', async (req) => {
    const b = req.body as { agentId: string; target: string };
    pushComputer(b.agentId, 'click', b.target);
    return getComputer(b.agentId);
  });

  app.get('/api/plugins', async () => listPlugins(settings.getAll().installedPlugins ?? [], settings.getAll().pluginDisabledTools ?? []));
  app.post('/api/plugins/:slug/install', async (req) => {
    const { slug } = req.params as { slug: string };
    const next = installPlugin(settings.getAll().installedPlugins ?? [], slug);
    settings.set({ installedPlugins: next });
    return listPlugins(next, settings.getAll().pluginDisabledTools ?? []);
  });
  app.post('/api/plugins/:slug/uninstall', async (req) => {
    const { slug } = req.params as { slug: string };
    const next = uninstallPlugin(settings.getAll().installedPlugins ?? [], slug);
    settings.set({ installedPlugins: next });
    return listPlugins(next, settings.getAll().pluginDisabledTools ?? []);
  });
  app.post('/api/plugins/:slug/tools', async (req) => {
    const b = req.body as { toolName: string; enabled: boolean };
    const next = togglePluginTool(settings.getAll().pluginDisabledTools ?? [], b.toolName, b.enabled);
    settings.set({ pluginDisabledTools: next });
    return listPlugins(settings.getAll().installedPlugins ?? [], next);
  });
  app.post('/api/plugins/:slug/connect', async (req) => {
    const { slug } = req.params as { slug: string };
    const b = req.body as { keyName?: string; value: string };
    secrets.put(slug, b.keyName || 'token', b.value);
    addNotice({ title: 'Plugin connecté', body: `${slug} authentifié en local (secret masqué).` });
    return listPlugins(settings.getAll().installedPlugins ?? [], settings.getAll().pluginDisabledTools ?? []);
  });

  app.get('/api/notices', async (req) => {
    const q = req.query as { agentId?: string };
    return listNotices(q.agentId);
  });
  app.post('/api/notices/:id/dismiss', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: dismissNotice(id) };
  });
  app.post('/api/notices/clear', async () => {
    dismissAll();
    return { ok: true };
  });

  app.post('/api/teach/start', async (req) => {
    const b = req.body as { agentId: string; goal: string };
    return startTeach(b.agentId, b.goal);
  });
  app.post('/api/teach/:id/step', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as { kind: string; detail: string };
    const s = addTeachStep(id, b.kind, b.detail);
    if (!s) return reply.code(404).send({ error: 'Session introuvable' });
    return s;
  });
  app.post('/api/teach/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = stopTeach(id, skillsDir);
    if (!s) return reply.code(404).send({ error: 'Session introuvable' });
    return s;
  });
  app.get('/api/teach/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = getTeach(id);
    if (!s) return reply.code(404).send({ error: 'Session introuvable' });
    return s;
  });

  app.post('/api/agents/:id/share', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!settings.getAll().publicSharing) {
      return reply.code(403).send({ error: 'Le partage public est désactivé (Réglages → Général).' });
    }
    const agent = agents.get(id);
    if (!agent) return reply.code(404).send({ error: 'Bot introuvable' });
    const payload: SharePayload = {
      token: '',
      name: agent.name,
      title: agent.title,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      hfModel: agent.hfModel,
      modelProvider: agent.modelProvider,
      avatarColor: agent.avatarColor,
      avatarShape: agent.avatarShape,
      accessory: agent.accessory,
      routines: routines.list(id).map((r) => ({ name: r.name, cron: r.cron, prompt: r.prompt })),
    };
    const { token } = shares.create(id, JSON.stringify(payload));
    payload.token = token;
    return { token, url: `/add/${token}`, payload };
  });
  app.get('/api/agents/:id/skills', async (req) => {
    const { id } = req.params as { id: string };
    const all = loadSkills(skillsDir);
    const enabled = settings.getAll().botSkills?.[id];
    return all.map((s) => ({ ...s, enabled: !enabled || enabled.includes(s.name) }));
  });
  app.put('/api/agents/:id/skills', async (req) => {
    const { id } = req.params as { id: string };
    const b = req.body as { names: string[] };
    const map = { ...(settings.getAll().botSkills ?? {}) };
    map[id] = b.names;
    settings.set({ botSkills: map });
    return { ok: true, names: b.names };
  });
  app.get('/api/share/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!settings.getAll().publicSharing) {
      return reply.code(403).send({ error: 'Le partage public est désactivé.' });
    }
    const row = shares.get(token);
    if (!row) return reply.code(404).send({ error: 'Lien introuvable' });
    return JSON.parse(row.payload) as SharePayload;
  });
  app.post('/api/share/:token/import', async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!settings.getAll().publicSharing) {
      return reply.code(403).send({ error: 'Le partage public est désactivé.' });
    }
    const row = shares.get(token);
    if (!row) return reply.code(404).send({ error: 'Lien introuvable' });
    const p = JSON.parse(row.payload) as SharePayload;
    const copy = agents.create({
      name: p.name,
      title: p.title,
      description: p.description,
      systemPrompt: p.systemPrompt,
      model: p.model,
      hfModel: p.hfModel,
      modelProvider: p.modelProvider,
      avatarColor: p.avatarColor,
      avatarShape: p.avatarShape,
      accessory: p.accessory,
    });
    for (const r of p.routines) {
      routines.create({ agentId: copy.id, name: r.name, cron: r.cron, prompt: r.prompt, enabled: false });
    }
    return copy;
  });

  app.post('/api/secrets', async (req) => {
    const b = req.body as { plugin?: string; keyName: string; value: string };
    return secrets.put(b.plugin, b.keyName, b.value);
  });
  app.get('/api/secrets', async () => secrets.list());

  app.get('/api/usage', async () => settings.getAll().weeklyUsage ?? { messages: 0, tools: 0, weekStart: '' });

  app.post('/api/auto-review', async (req) => {
    const b = req.body as AutoReviewRule;
    const rules = [...(settings.getAll().autoReviewRules ?? [])];
    rules.push({ id: b.id || uuid(), kind: b.kind, pattern: b.pattern, toolName: b.toolName });
    settings.set({ autoReviewRules: rules });
    return rules;
  });
  app.delete('/api/auto-review/:id', async (req) => {
    const { id } = req.params as { id: string };
    const rules = (settings.getAll().autoReviewRules ?? []).filter((r) => r.id !== id);
    settings.set({ autoReviewRules: rules });
    return rules;
  });

  app.get('/api/search', async (req) => {
    const q = ((req.query as { q?: string }).q || '').toLowerCase();
    if (!q) return { agents: [], messages: [], routines: [], files: [], channels: [] };
    const ag = agents.list(true).filter((a) => `${a.name} ${a.title} ${a.description}`.toLowerCase().includes(q));
    const msgs = agents
      .list(true)
      .flatMap((a) => messages.listByAgent(a.id).filter((m) => m.content.toLowerCase().includes(q)).slice(-3));
    const rts = routines.list().filter((r) => `${r.name} ${r.prompt}`.toLowerCase().includes(q));
    const files = uploads.list(q);
    const chans = channels.list().filter((c) => `${c.name} ${c.description} ${c.lastPreview}`.toLowerCase().includes(q));
    return { agents: ag, messages: msgs.slice(0, 20), routines: rts, files, channels: chans };
  });

  app.get('/api/uploads', async (req) => {
    const q = (req.query as { q?: string }).q;
    return uploads.list(q);
  });

  app.post('/api/uploads', async (req, reply) => {
    const b = req.body as { agentId?: string; name: string; contentBase64: string; mime?: string };
    const buf = Buffer.from(b.contentBase64, 'base64');
    const isVideo = (b.mime || '').startsWith('video/');
    const max = isVideo ? 200 * 1024 * 1024 : 25 * 1024 * 1024;
    if (buf.length > max) {
      return reply.code(413).send({ error: isVideo ? 'Vidéo trop volumineuse (200 Mo max).' : 'Fichier trop volumineux (25 Mo max).' });
    }
    const safe = `${Date.now()}-${b.name.replace(/[^\w.-]/g, '_')}`;
    const dest = path.join(dataDir, 'uploads', safe);
    fs.writeFileSync(dest, buf);
    const att = uploads.add(b.agentId, b.name, dest, b.mime, buf.length, `/uploads/${safe}`);
    return { ...att, url: `/uploads/${safe}` };
  });

  app.get('/api/mcp', async () => {
    const raw = getMcpConfigRaw(projectRoot);
    return { ...summarizeMcp(projectRoot), raw: raw.servers };
  });
  app.put('/api/mcp', async (req, reply) => {
    const b = req.body as { servers?: McpServerEntry[] };
    if (!Array.isArray(b.servers)) {
      return reply.code(400).send({ error: 'Tableau servers requis.' });
    }
    try {
      saveMcpConfig(projectRoot, { servers: b.servers });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
    const raw = getMcpConfigRaw(projectRoot);
    return { ...summarizeMcp(projectRoot), raw: raw.servers };
  });
  app.post('/api/mcp/toggle', async (req, reply) => {
    const b = req.body as { name: string; disabled: boolean };
    if (!b.name) return reply.code(400).send({ error: 'name requis' });
    const cfg = getMcpConfigRaw(projectRoot);
    const hit = cfg.servers.find((s) => s.name === b.name);
    if (!hit) return reply.code(404).send({ error: 'Serveur MCP introuvable' });
    hit.disabled = b.disabled;
    saveMcpConfig(projectRoot, cfg);
    const raw = getMcpConfigRaw(projectRoot);
    return { ...summarizeMcp(projectRoot), raw: raw.servers };
  });

  app.get('/api/team-setup', async () => {
    const setupPath = path.join(projectRoot, 'config', 'team-setup.md');
    const applied = path.join(settings.getAll().workspaceRoot || defaultWorkspace, 'TEAM.md');
    return {
      source: fs.existsSync(setupPath) ? fs.readFileSync(setupPath, 'utf-8') : '',
      applied: fs.existsSync(applied),
      appliedAt: fs.existsSync(applied) ? fs.statSync(applied).mtime.toISOString() : null,
    };
  });
  app.post('/api/team-setup/reinstall', async () => {
    const setupPath = path.join(projectRoot, 'config', 'team-setup.md');
    const dest = path.join(settings.getAll().workspaceRoot || defaultWorkspace, 'TEAM.md');
    const body = fs.existsSync(setupPath)
      ? fs.readFileSync(setupPath, 'utf-8')
      : '# Configuration d’équipe locale\nWorkspace partagé, plugins installés, pas de secrets en clair.\n';
    fs.writeFileSync(dest, body);
    addNotice({ title: 'Configuration d’équipe', body: 'TEAM.md réinstallé dans le workspace.' });
    return { ok: true };
  });
}
