import os from 'os';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { runAgentChat } from '../services/agentLoop';
import { OllamaClient, HuggingFaceClient } from '../services/llm';
import { getComputer } from '../services/computer';
import type { HostFacts } from '@grok-bot/shared';
import type { HttpDeps } from './deps';

export function registerHttpCore(d: HttpDeps): void {
  const {
    app,
    settings,
    agents,
    channels,
    messages,
    inbox,
    uploads,
    sse,
    loopDeps,
    memory,
    routines,
    PORT,
    VERSION,
    serverHostFacts,
  } = d;

  app.get('/health', async () => {
    const s = settings.getAll();
    const ollama = new OllamaClient(s.ollamaBaseUrl);
    const h = await ollama.health();
    const token = (s.huggingfaceToken || process.env.HF_TOKEN || '').trim();
    const hf = token
      ? new HuggingFaceClient(s.huggingfaceBaseUrl || 'https://router.huggingface.co/v1', token)
      : null;
    const hfHealth = hf ? await hf.health() : { reachable: false, error: 'HF_TOKEN absent' };
    const llmMode = h.reachable ? 'ollama' : hfHealth.reachable ? 'huggingface' : 'local';
    return {
      ok: true,
      ollama: { ...h, baseUrl: s.ollamaBaseUrl },
      huggingface: { configured: Boolean(token), reachable: hfHealth.reachable, error: hfHealth.error },
      llmMode,
      version: VERSION,
      computer: getComputer(),
      hostFacts: s.hostFacts,
      serverHost: serverHostFacts(),
    };
  });
  app.get('/api/host-facts', async () => {
    const s = settings.getAll();
    return { hostFacts: s.hostFacts ?? null, serverHost: serverHostFacts() };
  });
  app.put('/api/host-facts', async (req) => {
    const body = req.body as HostFacts;
    const hostFacts: HostFacts = {
      ...body,
      capturedAt: new Date().toISOString(),
      source: body.source || 'browser',
    };
    return settings.set({ hostFacts });
  });
  app.get('/api/version', async () => ({ version: VERSION }));
  app.get('/api/network', async () => {
    const webPort = Number(process.env.WEB_PORT || 48731);
    const apiPort = PORT;
    const urls: string[] = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list ?? []) {
        if (n.internal || String(n.family) !== 'IPv4') continue;
        urls.push(`http://${n.address}:${webPort}`);
      }
    }
    return { urls, apiPort, webPort };
  });

  app.get('/api/agents', async (req) => {
    const q = req.query as { includeHidden?: string };
    return agents.list(q.includeHidden === '1');
  });
  app.get('/api/agents-hidden', async () => agents.listHidden());
  app.post('/api/agents', async (req, reply) => {
    if (agents.countAll() + channels.countAll() >= 50) {
      return reply.code(400).send({ error: 'Limite de 50 bots et groupes combinés.' });
    }
    return agents.create(req.body as never);
  });
  app.patch('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updated = agents.update(id, req.body as never);
    if (!updated) return reply.code(404).send({ error: 'Bot introuvable' });
    return updated;
  });
  app.post('/api/agents/:id/hide', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { hidden: boolean };
    const updated = agents.update(id, { hidden: body.hidden });
    if (!updated) return reply.code(404).send({ error: 'Bot introuvable' });
    return updated;
  });
  app.post('/api/agents/:id/pin', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { pinned: boolean };
    const updated = agents.update(id, { pinned: body.pinned });
    if (!updated) return reply.code(404).send({ error: 'Bot introuvable' });
    return updated;
  });
  app.post('/api/agents/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (agents.countAll() + channels.countAll() >= 50) {
      return reply.code(400).send({ error: 'Limite de 50 bots et groupes combinés.' });
    }
    const copy = agents.duplicate(id);
    if (!copy) return reply.code(404).send({ error: 'Bot introuvable' });
    for (const r of routines.list(id)) {
      routines.create({
        agentId: copy.id,
        name: r.name,
        cron: r.cron,
        prompt: r.prompt,
        enabled: r.enabled,
        quietIfEmpty: r.quietIfEmpty,
      });
    }
    const map = { ...(settings.getAll().botSkills ?? {}) };
    if (map[id]) {
      map[copy.id] = [...map[id]];
      settings.set({ botSkills: map });
    }
    return copy;
  });
  app.post('/api/agents/:id/read', async (req) => {
    const { id } = req.params as { id: string };
    agents.markRead(id);
    return { ok: true };
  });
  app.delete('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      if (!agents.delete(id)) return reply.code(404).send({ error: 'Bot introuvable' });
      return { ok: true };
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({
        error: e instanceof Error ? e.message : 'Impossible de supprimer ce bot',
      });
    }
  });
  app.get('/api/agents/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    return messages.listByAgent(id);
  });
  app.delete('/api/agents/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    messages.clear(id);
    return { ok: true };
  });
  app.get('/api/agents/:id/inbox', async (req) => {
    const { id } = req.params as { id: string };
    return inbox.list(id);
  });
  app.post('/api/agents/:id/inbox', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { toAgentId?: string; toAgent?: string; message: string };
    const dest = body.toAgentId ? agents.get(body.toAgentId) : body.toAgent ? agents.getByName(body.toAgent) : undefined;
    if (!dest) return reply.code(404).send({ error: 'Destinataire introuvable' });
    return inbox.send(id, dest.id, body.message);
  });

  app.patch('/api/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { content: string };
    const m = messages.edit(id, body.content);
    if (!m) return reply.code(404).send({ error: 'Message introuvable' });
    return m;
  });
  app.post('/api/messages/:id/react', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { emoji: string };
    const m = messages.react(id, body.emoji);
    if (!m) return reply.code(404).send({ error: 'Message introuvable' });
    return m;
  });

  const runChat = async (
    req: FastifyRequest,
    reply: FastifyReply,
    agentId: string,
    message: string,
    extra?: { attachmentIds?: string[]; skipPersistUser?: boolean; replyToId?: string }
  ) => {
    const agent = agents.get(agentId);
    if (!agent) return reply.code(404).send({ error: 'Bot introuvable' });
    const ids = extra?.attachmentIds ?? [];
    if (ids.length > 6) return reply.code(400).send({ error: '6 fichiers maximum par message.' });
    const atts = ids.map((id) => uploads.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const write = sse(reply);
    const ac = new AbortController();
    req.raw.on('close', () => ac.abort());
    await runAgentChat(agent, message, undefined, write, loopDeps, ac.signal, {
      attachments: atts,
      skipPersistUser: extra?.skipPersistUser,
      replyToId: extra?.replyToId,
    });
    reply.raw.end();
  };

  app.post('/api/chat', async (req, reply) => {
    const body = req.body as { agentId: string; message: string; attachmentIds?: string[]; replyToId?: string };
    await runChat(req, reply, body.agentId, body.message, {
      attachmentIds: body.attachmentIds,
      replyToId: body.replyToId,
    });
  });
  app.post('/api/chat/widget-select', async (req, reply) => {
    const body = req.body as { agentId: string; widgetId: string; selection: string };
    await runChat(req, reply, body.agentId, body.selection);
  });
  app.post('/api/chat/regenerate', async (req, reply) => {
    const body = req.body as { agentId: string; messageId: string };
    const msg = messages.get(body.messageId);
    if (!msg) return reply.code(404).send({ error: 'Message introuvable' });
    messages.deleteAfter(body.agentId, msg.createdAt);
    const lastUser = messages.listByAgent(body.agentId).reverse().find((m) => m.role === 'user');
    await runChat(req, reply, body.agentId, lastUser?.content || 'Continue.', { skipPersistUser: true });
  });

  app.get('/api/memory', async (req) => {
    const q = req.query as { agentId?: string; projectId?: string; q?: string; scope?: string };
    if (q.q) return memory.search(q.q, q.agentId);
    if (q.scope === 'user') return memory.list(undefined);
    return memory.list(q.agentId, q.projectId);
  });
  app.post('/api/memory', async (req) => {
    const b = req.body as {
      agentId: string;
      key: string;
      value: string;
      tier?: 'profile' | 'log' | 'note';
      scope?: 'agent' | 'user' | 'project';
      projectId?: string;
    };
    return memory.write(b.agentId, b.key, b.value, b.tier, b.scope, b.projectId);
  });
  app.post('/api/memory/:id/pin', async (req) => {
    const { id } = req.params as { id: string };
    const b = req.body as { pinned: boolean };
    memory.pin(id, b.pinned);
    return { ok: true };
  });
  app.delete('/api/memory/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { ok: memory.deleteId(id) };
  });

  app.get('/api/settings', async () => settings.getAll());
  app.put('/api/settings', async (req) => settings.set(req.body as never));
  app.get('/api/models', async () => {
    const s = settings.getAll();
    const o = new OllamaClient(s.ollamaBaseUrl);
    const h = await o.health();
    const token = (s.huggingfaceToken || process.env.HF_TOKEN || '').trim();
    let huggingface: string[] = [];
    if (token) {
      const hf = new HuggingFaceClient(s.huggingfaceBaseUrl || 'https://router.huggingface.co/v1', token);
      huggingface = await hf.listModels().catch(() => []);
    }
    return { models: h.models ?? [], huggingface };
  });
}
