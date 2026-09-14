import type { FastifyInstance } from 'fastify';
import type { MemoryRepo, AgentRepo } from '../db/repos';

export function registerMemoryRoutes(
  app: FastifyInstance,
  memory: MemoryRepo,
  agents: AgentRepo
): void {
  app.get('/api/memory', async (req) => {
    const q = req.query as { agentId?: string; q?: string };
    if (q.q?.trim()) return memory.search(q.q.trim(), q.agentId);
    return memory.list(q.agentId);
  });

  app.post<{
    Body: {
      agentId: string;
      key: string;
      value: string;
      tier?: 'profile' | 'log' | 'note';
      scope?: 'agent' | 'user';
    };
  }>('/api/memory', async (req, reply) => {
    const { agentId, key, value, tier, scope } = req.body ?? {};
    if (!agentId || !key?.trim() || value === undefined) {
      return reply.code(400).send({ error: 'agentId, key, value required' });
    }
    if (!agents.get(agentId)) return reply.code(404).send({ error: 'Agent not found' });
    const entry = memory.write(agentId, key.trim(), String(value), tier || 'note', scope || 'agent');
    return reply.code(201).send(entry);
  });

  app.delete<{ Params: { id: string } }>('/api/memory/:id', async (req, reply) => {
    if (!memory.forgetById(req.params.id)) {
      return reply.code(404).send({ error: 'Memory not found' });
    }
    return { ok: true };
  });
}
