import type { FastifyInstance } from 'fastify';
import type { MemoryRepo, AgentRepo } from '../db/repos';

export function registerMemoryRoutes(
  app: FastifyInstance,
  memory: MemoryRepo,
  agents: AgentRepo
): void {
  app.get('/api/memory', async (req) => {
    const q = req.query as {
      agentId?: string;
      q?: string;
      projectId?: string;
      scope?: string;
    };
    if (q.scope === 'user') return memory.listUserGlobal();
    if (q.q) return memory.search(q.q, q.agentId);
    return memory.list(q.agentId, q.projectId);
  });

  app.post<{
    Body: {
      agentId: string;
      key: string;
      value: string;
      tier?: string;
      scope?: string;
      projectId?: string;
      pinned?: boolean;
    };
  }>('/api/memory', async (req, reply) => {
    const { agentId, key, value, tier, scope, projectId, pinned } = req.body ?? {};
    if (!agentId || !key?.trim() || value === undefined) {
      return reply.code(400).send({ error: 'agentId, key, value required' });
    }
    if (!agents.get(agentId)) return reply.code(404).send({ error: 'Agent not found' });
    const entry = memory.write(
      agentId,
      key.trim(),
      String(value),
      (tier as 'profile' | 'log' | 'note') || 'note',
      (scope as 'agent' | 'user' | 'project') || 'agent',
      projectId,
      pinned
    );
    return reply.code(201).send(entry);
  });

  app.post<{ Params: { id: string }; Body: { pinned: boolean } }>(
    '/api/memory/:id/pin',
    async (req, reply) => {
      const entry = memory.pin(req.params.id, Boolean(req.body?.pinned));
      if (!entry) return reply.code(404).send({ error: 'Not found' });
      return entry;
    }
  );

  app.post('/api/memory/promote', async () => {
    const n = memory.promoteStale(7);
    return { ok: true, promoted: n };
  });

  app.delete<{ Params: { id: string } }>('/api/memory/:id', async (req, reply) => {
    if (!memory.forgetById(req.params.id)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return { ok: true };
  });
}
