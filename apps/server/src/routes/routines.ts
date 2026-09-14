import type { FastifyInstance } from 'fastify';
import type { CreateRoutineInput } from '@grok-bot/shared';
import type { RoutineRepo, AgentRepo } from '../db/repos';
import type { RoutineScheduler } from '../services/routines';
import cron from 'node-cron';

export function registerRoutineRoutes(
  app: FastifyInstance,
  routines: RoutineRepo,
  agents: AgentRepo,
  scheduler: RoutineScheduler
): void {
  app.get('/api/routines', async (req) => {
    const agentId = (req.query as { agentId?: string }).agentId;
    return routines.list(agentId);
  });

  app.post<{ Body: CreateRoutineInput }>('/api/routines', async (req, reply) => {
    const body = req.body;
    if (!body?.agentId || !body?.name || !body?.cron || !body?.prompt) {
      return reply.code(400).send({ error: 'agentId, name, cron, prompt required' });
    }
    if (!agents.get(body.agentId)) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    if (!cron.validate(body.cron)) {
      return reply.code(400).send({ error: 'Invalid cron expression' });
    }
    const created = routines.create(body);
    scheduler.reload();
    return reply.code(201).send(created);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{ name: string; cron: string; prompt: string; enabled: boolean }>;
  }>('/api/routines/:id', async (req, reply) => {
    if (req.body?.cron && !cron.validate(req.body.cron)) {
      return reply.code(400).send({ error: 'Invalid cron expression' });
    }
    const updated = routines.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: 'Routine not found' });
    scheduler.reload();
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/api/routines/:id', async (req, reply) => {
    if (!routines.delete(req.params.id)) {
      return reply.code(404).send({ error: 'Routine not found' });
    }
    scheduler.reload();
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/routines/:id/run', async (req, reply) => {
    const r = routines.get(req.params.id);
    if (!r) return reply.code(404).send({ error: 'Routine not found' });
    void scheduler.runRoutine(r.id);
    return { ok: true, message: 'Routine started' };
  });
}
