import type { FastifyInstance } from 'fastify';
import type { AgentRepo, MessageRepo, UploadRepo } from '../db/repos';
import { runAgentChat, type AgentLoopDeps } from '../services/agentLoop';
import type { WidgetMeta, ApprovalMeta } from '@grok-bot/shared';

export function registerChatRoutes(
  app: FastifyInstance,
  agents: AgentRepo,
  messages: MessageRepo,
  loopDeps: AgentLoopDeps,
  uploads?: UploadRepo,
  _dataDir?: string
): void {
  app.post<{
    Body: {
      agentId: string;
      message: string;
      model?: string;
      attachmentIds?: string[];
    };
  }>('/api/chat', async (req, reply) => {
    const { agentId, message, model, attachmentIds } = req.body ?? {};
    if (!agentId || !message?.trim()) {
      return reply.code(400).send({ error: 'agentId and message required' });
    }
    const agent = agents.get(agentId);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });

    const attachments =
      attachmentIds
        ?.map((id) => uploads?.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)) ?? [];

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
      await runAgentChat(agent, message.trim(), model, write, loopDeps, ac.signal, {
        attachments,
      });
    } catch (e) {
      write('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      reply.raw.end();
    }
  });

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

    // Also resolve linked approval if present
    const approvalMsg = [...history].reverse().find((m) => m.kind === 'approval');
    if (approvalMsg?.meta && (approvalMsg.meta as ApprovalMeta).type === 'approval') {
      const am = approvalMsg.meta as ApprovalMeta;
      if (am.status === 'pending') {
        messages.updateMeta(approvalMsg.id, {
          ...am,
          status: selection === 'Approve' ? 'approved' : 'denied',
        });
      }
    }

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

  // Edit message
  app.patch<{ Params: { id: string }; Body: { content: string } }>(
    '/api/messages/:id',
    async (req, reply) => {
      const msg = messages.get(req.params.id);
      if (!msg) return reply.code(404).send({ error: 'Not found' });
      if (!req.body?.content?.trim()) return reply.code(400).send({ error: 'content required' });
      return messages.updateContent(req.params.id, req.body.content.trim());
    }
  );

  // Regenerate: delete from message onward and re-run last user message
  app.post<{
    Body: { agentId: string; messageId: string; model?: string };
  }>('/api/chat/regenerate', async (req, reply) => {
    const { agentId, messageId, model } = req.body ?? {};
    if (!agentId || !messageId) {
      return reply.code(400).send({ error: 'agentId and messageId required' });
    }
    const agent = agents.get(agentId);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    const target = messages.get(messageId);
    if (!target || target.agentId !== agentId) {
      return reply.code(404).send({ error: 'Message not found' });
    }

    // Find the user message to regenerate from
    const history = messages.listByAgent(agentId, 500);
    let userMsg = target.role === 'user' ? target : null;
    if (!userMsg) {
      const idx = history.findIndex((m) => m.id === messageId);
      for (let i = idx; i >= 0; i--) {
        if (history[i].role === 'user') {
          userMsg = history[i];
          break;
        }
      }
    }
    if (!userMsg) return reply.code(400).send({ error: 'No user message to regenerate' });

    // Delete from user message onward
    messages.deleteFrom(userMsg.id, agentId);

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
      await runAgentChat(agent, userMsg.content, model, write, loopDeps, ac.signal);
    } catch (e) {
      write('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      reply.raw.end();
    }
  });
}
