import type { FastifyInstance } from 'fastify';
import type { CreateAgentInput, UpdateAgentInput } from '@grok-bot/shared';
import type { AgentRepo, MessageRepo, MemoryRepo, InboxRepo } from '../db/repos';

export function registerAgentRoutes(
  app: FastifyInstance,
  agents: AgentRepo,
  messages: MessageRepo,
  memory: MemoryRepo,
  inbox: InboxRepo
): void {
  app.get('/api/agents', async (req) => {
    const includeHidden = (req.query as { includeHidden?: string }).includeHidden === '1';
    return agents.list(includeHidden);
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const a = agents.get(req.params.id);
    if (!a) return reply.code(404).send({ error: 'Agent not found' });
    return a;
  });

  app.post<{ Body: CreateAgentInput }>('/api/agents', async (req, reply) => {
    const body = req.body;
    if (!body?.name?.trim() || !body?.title?.trim()) {
      return reply.code(400).send({ error: 'name and title required' });
    }
    if (agents.getByName(body.name.trim())) {
      return reply.code(409).send({ error: 'Agent name already exists' });
    }
    const created = agents.create({
      name: body.name.trim(),
      title: body.title.trim(),
      description: body.description,
      systemPrompt: body.systemPrompt,
      model: body.model,
      hfModel: body.hfModel,
      modelProvider: body.modelProvider,
      avatarColor: body.avatarColor,
      avatarShape: body.avatarShape,
      accessory: body.accessory,
      notifyOnUpdates: body.notifyOnUpdates,
    });
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string }; Body: UpdateAgentInput }>(
    '/api/agents/:id',
    async (req, reply) => {
      const updated = agents.update(req.params.id, req.body ?? {});
      if (!updated) return reply.code(404).send({ error: 'Agent not found' });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const a = agents.get(req.params.id);
    if (!a) return reply.code(404).send({ error: 'Agent not found' });
    if (a.name === 'dev') {
      return reply.code(400).send({ error: 'Cannot delete default "dev" agent' });
    }
    agents.delete(req.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id/messages', async (req, reply) => {
    if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
    return messages.listByAgent(req.params.id);
  });

  app.delete<{ Params: { id: string } }>(
    '/api/agents/:id/messages',
    async (req, reply) => {
      if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
      messages.clear(req.params.id);
      return { ok: true };
    }
  );

  app.get<{ Params: { id: string } }>('/api/agents/:id/memory', async (req, reply) => {
    if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
    return memory.list(req.params.id);
  });

  app.post<{
    Params: { id: string };
    Body: { key: string; value: string; tier?: string; scope?: string; projectId?: string };
  }>('/api/agents/:id/memory', async (req, reply) => {
    if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
    const { key, value, tier, scope, projectId } = req.body ?? {};
    if (!key?.trim() || value === undefined) {
      return reply.code(400).send({ error: 'key and value required' });
    }
    const entry = memory.write(
      req.params.id,
      key.trim(),
      String(value),
      (tier as 'profile' | 'log' | 'note') || 'note',
      (scope as 'agent' | 'user' | 'project') || 'agent',
      projectId
    );
    return reply.code(201).send(entry);
  });

  app.delete<{ Params: { id: string; key: string } }>(
    '/api/agents/:id/memory/:key',
    async (req, reply) => {
      if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
      const ok = memory.forget(req.params.id, decodeURIComponent(req.params.key));
      if (!ok) return reply.code(404).send({ error: 'Memory key not found' });
      return { ok: true };
    }
  );

  app.get<{ Params: { id: string } }>('/api/agents/:id/inbox', async (req, reply) => {
    if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
    return inbox.list(req.params.id);
  });

  app.post<{
    Params: { id: string };
    Body: { toAgentId?: string; toAgent?: string; message: string };
  }>('/api/agents/:id/inbox', async (req, reply) => {
    const from = agents.get(req.params.id);
    if (!from) return reply.code(404).send({ error: 'Agent not found' });
    const { message, toAgentId, toAgent } = req.body ?? {};
    if (!message?.trim()) return reply.code(400).send({ error: 'message required' });
    const dest =
      (toAgentId && agents.get(toAgentId)) ||
      (toAgent && agents.getByName(toAgent)) ||
      null;
    if (!dest) return reply.code(404).send({ error: 'Target agent not found' });
    const msg = inbox.send(from.id, dest.id, message.trim());
    messages.add({
      agentId: dest.id,
      role: 'system',
      content: `[Message from @${from.name}] ${message.trim()}`,
      kind: 'system',
    });
    return reply.code(201).send(msg);
  });

  app.post<{ Params: { id: string; msgId: string } }>(
    '/api/agents/:id/inbox/:msgId/read',
    async (req, reply) => {
      if (!agents.get(req.params.id)) return reply.code(404).send({ error: 'Agent not found' });
      inbox.markRead(req.params.msgId);
      return { ok: true };
    }
  );
}
