import type { FastifyInstance } from 'fastify';
import type { AgentRepo, MessageRepo } from '../db/repos';
import { runAgentChat, type AgentLoopDeps } from '../services/agentLoop';
import type { WidgetMeta } from '@grok-bot/shared';

export function registerChatRoutes(
  app: FastifyInstance,
  agents: AgentRepo,
  messages: MessageRepo,
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

  /** User clicked a widget option */
  app.post<{
    Body: { agentId: string; widgetId: string; selection: string };
  }>('/api/chat/widget-select', async (req, reply) => {
    const { agentId, widgetId, selection } = req.body ?? {};
    if (!agentId || !widgetId || !selection) {
      return reply.code(400).send({ error: 'agentId, widgetId, selection required' });
    }
    if (!agents.get(agentId)) return reply.code(404).send({ error: 'Agent not found' });

    const history = messages.listByAgent(agentId, 500);
    const widgetMsg = history.find(
      (m) =>
        m.kind === 'widget' &&
        m.meta &&
        (m.meta as WidgetMeta).widgetId === widgetId
    );
    if (widgetMsg?.meta) {
      const meta = { ...(widgetMsg.meta as WidgetMeta), selected: selection };
      messages.updateMeta(widgetMsg.id, meta, `${widgetMsg.content}\n\nSelected: ${selection}`);
    }

    // Continue chat with the selection as the user message
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
    const agent = agents.get(agentId)!;
    const ac = new AbortController();
    req.raw.on('close', () => ac.abort());
    try {
      await runAgentChat(
        agent,
        `[Widget selection: ${selection}]`,
        undefined,
        write,
        loopDeps,
        ac.signal
      );
    } catch (e) {
      write('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      reply.raw.end();
    }
  });
}
