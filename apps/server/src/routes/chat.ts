import type { FastifyInstance } from 'fastify';
import type { AgentRepo } from '../db/repos';
import { runAgentChat, type AgentLoopDeps } from '../services/agentLoop';

export function registerChatRoutes(
  app: FastifyInstance,
  agents: AgentRepo,
  loopDeps: AgentLoopDeps
): void {
  app.post<{
    Body: { agentId: string; message: string; model?: string };
  }>('/api/chat', async (req, reply) => {
    const { agentId, message, model } = req.body ?? {};
    if (!agentId || !message?.trim()) {
      return reply.code(400).send({ error: 'agentId and message required' });
    }
    const agent = agents.get(agentId);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ac = new AbortController();
    req.raw.on('close', () => ac.abort());

    try {
      await runAgentChat(agent, message.trim(), model, write, loopDeps, ac.signal);
    } catch (e) {
      write('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      reply.raw.end();
    }
  });
}
