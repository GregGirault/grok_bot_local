import type { FastifyInstance } from 'fastify';
import type { AgentRepo, TaskRepo } from '../db/repos';
import type { TaskRunner } from '../services/tasks';

export function registerTaskRoutes(
  app: FastifyInstance,
  tasks: TaskRepo,
  agents: AgentRepo,
  runner: TaskRunner
): void {
  app.get('/api/tasks', async () => tasks.list());

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const t = tasks.get(req.params.id);
    if (!t) return reply.code(404).send({ error: 'Task not found' });
    return t;
  });

  app.post<{ Body: { agentId: string; prompt: string } }>('/api/tasks', async (req, reply) => {
    const { agentId, prompt } = req.body ?? {};
    if (!agentId || !prompt?.trim()) {
      return reply.code(400).send({ error: 'agentId and prompt required' });
    }
    if (!agents.get(agentId)) return reply.code(404).send({ error: 'Agent not found' });
    const task = runner.enqueue(agentId, prompt.trim());
    return reply.code(201).send(task);
  });
}
