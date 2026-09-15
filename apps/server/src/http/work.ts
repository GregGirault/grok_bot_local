import { v4 as uuid } from 'uuid';
import { displayName } from '@grok-bot/shared';
import { loadSkills, saveSkill, deleteSkill } from '../services/skills';
import { runShell, executeTool } from '../tools';
import { addNotice } from '../services/notices';
import type { HttpDeps } from './deps';

export function registerHttpWork(d: HttpDeps): void {
  const {
    app,
    routines,
    scheduler,
    skillsDir,
    agents,
    channels,
    tasks,
    machines,
    members,
    projects,
    approvals,
    settings,
    defaultWorkspace,
    dataDir,
    memory,
    messages,
  } = d;

  app.get('/api/routines', async (req) => {
    const q = req.query as { agentId?: string };
    return routines.list(q.agentId);
  });
  app.get('/api/routines/runs', async (req) => {
    const q = req.query as { routineId?: string };
    return routines.listRuns(q.routineId);
  });
  app.post('/api/routines', async (req) => {
    const r = routines.create(req.body as never);
    scheduler.schedule(r.id);
    return r;
  });
  app.patch('/api/routines/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = routines.update(id, req.body as never);
    if (!r) return reply.code(404).send({ error: 'Routine introuvable' });
    scheduler.schedule(id);
    return r;
  });
  app.delete('/api/routines/:id', async (req) => {
    const { id } = req.params as { id: string };
    scheduler.unschedule(id);
    return { ok: routines.delete(id) };
  });
  app.post('/api/routines/:id/run', async (req) => {
    const { id } = req.params as { id: string };
    await scheduler.run(id);
    return { ok: true };
  });
  app.post('/api/hooks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = routines.get(id);
    if (!r) return reply.code(404).send({ error: 'Routine introuvable' });
    await scheduler.run(id);
    return { ok: true };
  });
  app.post('/api/hooks/event/:kind', async (req) => {
    const { kind } = req.params as { kind: string };
    const cron = `event:${kind}`;
    const hits = routines.list().filter((r) => r.enabled && r.cron === cron);
    for (const r of hits) await scheduler.run(r.id);
    addNotice({ title: `Événement ${kind}`, body: `${hits.length} routine(s) déclenchée(s).` });
    return { ok: true, ran: hits.map((r) => r.id) };
  });

  app.get('/api/skills', async () => loadSkills(skillsDir));
  app.get('/api/skills/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const s = loadSkills(skillsDir).find((x) => x.name === name);
    if (!s) return reply.code(404).send({ error: 'Compétence introuvable' });
    return s;
  });
  app.post('/api/skills', async (req) => {
    const b = req.body as { name: string; content: string };
    saveSkill(skillsDir, b.name, b.content);
    return loadSkills(skillsDir).find((s) => s.name === b.name);
  });
  app.delete('/api/skills/:name', async (req) => {
    const { name } = req.params as { name: string };
    return { ok: deleteSkill(skillsDir, name) };
  });

  app.get('/api/channels', async () => channels.list());
  app.post('/api/channels', async (req, reply) => {
    const b = req.body as { name: string; description?: string; memberIds: string[] };
    if (agents.countAll() + channels.countAll() >= 50) {
      return reply.code(400).send({ error: 'Limite de 50 bots et groupes combinés.' });
    }
    try {
      return channels.create(b.name, b.description ?? '', b.memberIds);
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });
  app.patch('/api/channels/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; description?: string; memberIds?: string[] };
    const ch = channels.get(id);
    if (!ch) return reply.code(404).send({ error: 'Groupe introuvable' });
    try {
      const updated = channels.update(id, {
        name: body.name ?? ch.name,
        description: body.description ?? ch.description,
        memberIds: body.memberIds ?? ch.memberIds,
      });
      return updated;
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });
  app.delete('/api/channels/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: channels.delete(id) };
  });
  app.get('/api/channels/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    return channels.listMessages(id);
  });
  app.post('/api/channels/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const b = req.body as { content: string; fromAgentId?: string };
    const msg = channels.post(id, b.content, b.fromAgentId);
    const ch = channels.get(id);
    const mentions = [...new Set((b.content.match(/@([A-Za-zÀ-ÿ0-9._-]+)/g) ?? []).map((m) => m.slice(1).toLowerCase()))];
    if (!b.fromAgentId && ch) {
      const memberAgents = ch.memberIds
        .map((mid) => agents.get(mid))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const everyone = mentions.includes('everyone') || mentions.includes('tous');
      let responders = memberAgents.filter((bot) => {
        const first = bot.name.split(' ')[0].toLowerCase();
        return mentions.includes(first) || mentions.includes(bot.name.toLowerCase());
      });
      if (everyone) responders = memberAgents;
      else if (!responders.length) responders = memberAgents.slice(0, 1);
      for (const bot of responders) {
        const replyText = everyone
          ? `${displayName(bot.name)} — reçu pour tout le groupe. Je m’arrête à toute action externe.`
          : `${displayName(bot.name)} a vu la mention. Je prends le relais dans ce groupe — je m’arrête à toute action externe.`;
        channels.post(id, replyText, bot.id);
        agents.update(bot.id, { unread: true, attention: 'needs_attention', lastPreview: b.content.slice(0, 120) });
      }
    }
    return msg;
  });
  app.get('/api/channels/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    const ch = channels.get(id);
    return { agents: (ch?.memberIds ?? []).map((mid) => agents.get(mid)).filter(Boolean), team: members.list() };
  });
  app.post('/api/channels/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    const b = req.body as { agentId?: string };
    if (b.agentId) channels.addMember(id, b.agentId);
    return { ok: true };
  });
  app.delete('/api/channels/:id/members/:mid', async (req) => {
    const { id, mid } = req.params as { id: string; mid: string };
    channels.removeMember(id, mid);
    return { ok: true };
  });

  app.get('/api/tasks', async () => tasks.list());
  app.post('/api/tasks', async (req) => {
    const b = req.body as { agentId: string; prompt: string };
    return tasks.create(b.agentId, b.prompt);
  });

  app.get('/api/machines', async () => machines.list());
  app.post('/api/machines', async (req) => {
    const b = req.body as { name: string; host?: string; path?: string };
    return machines.create(b.name, b.host, b.path);
  });
  app.patch('/api/machines/:id', async (req) => {
    const { id } = req.params as { id: string };
    return machines.update(id, req.body as never);
  });
  app.delete('/api/machines/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: machines.delete(id) };
  });

  app.get('/api/members', async () => members.list());
  app.post('/api/members', async (req) => {
    const b = req.body as { name: string; email?: string; role?: string };
    return members.create(b.name, b.email, b.role);
  });
  app.delete('/api/members/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: members.delete(id) };
  });

  app.get('/api/projects', async () => projects.list());
  app.post('/api/projects', async (req) => {
    const b = req.body as { slug: string; name: string; path?: string; description?: string };
    return projects.create(b.slug, b.name, b.path, b.description);
  });
  app.patch('/api/projects/:id', async (req) => {
    const { id } = req.params as { id: string };
    return projects.update(id, req.body as never);
  });
  app.delete('/api/projects/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: projects.delete(id) };
  });

  app.get('/api/approvals', async (req) => {
    const q = req.query as { agentId?: string };
    return approvals.list(q.agentId);
  });
  app.post('/api/approvals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as { decision: 'approved' | 'denied' | 'always' };
    const status = b.decision === 'denied' ? 'denied' : 'approved';
    const a = approvals.resolve(id, status);
    if (!a) return reply.code(404).send({ error: 'Approbation introuvable' });
    if (b.decision === 'always') {
      const rules = [...(settings.getAll().autoReviewRules ?? [])];
      rules.push({ id: uuid(), kind: 'allow', pattern: a.command.slice(0, 80), toolName: a.toolName });
      settings.set({ autoReviewRules: rules });
    }
    if (status === 'approved') {
      const agent = agents.get(a.agentId);
      if (agent) {
        const s = settings.getAll();
        const ctx = {
          workspaceRoot: s.workspaceRoot || defaultWorkspace,
          dataDir,
          agentId: agent.id,
          memory,
          agents,
          messages,
          approvals,
          installedPlugins: s.installedPlugins,
          pluginDisabledTools: s.pluginDisabledTools,
          autoReviewRules: s.autoReviewRules,
          localPolicy: s.localComputerPolicy,
          skillsDir,
          routines,
        };
        const out =
          a.toolName === 'shell'
            ? await runShell(a.command, ctx)
            : await executeTool(a.toolName, a.command, ctx, true);
        messages.add({ agentId: agent.id, role: 'system', content: `Commande autorisée :\n${out}`, kind: 'event' });
      }
    }
    return { ok: true };
  });
}
