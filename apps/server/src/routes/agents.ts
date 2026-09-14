import type { FastifyInstance } from 'fastify';
import type { CreateAgentInput, UpdateAgentInput } from '@grok-bot/shared';
import type { AgentRepo, MessageRepo, MemoryRepo } from '../db/repos';

export function registerAgentRoutes(
  app: FastifyInstance,
  agents: AgentRepo,
  messages: MessageRepo,
  memory: MemoryRepo
): void {
  app.get('/api/agents', async () => agents.list());

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
}
