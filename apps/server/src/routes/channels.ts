import type { FastifyInstance } from 'fastify';
import type { AgentRepo, ChannelRepo, InboxRepo, MessageRepo } from '../db/repos';
import { wakeAgent, type AgentLoopDeps } from '../services/agentLoop';

export function registerChannelRoutes(
  app: FastifyInstance,
  channels: ChannelRepo,
  agents: AgentRepo,
  inbox: InboxRepo,
  messages: MessageRepo,
  loopDeps: AgentLoopDeps
): void {
  app.get('/api/channels', async () => channels.list());

  app.get<{ Params: { id: string } }>('/api/channels/:id', async (req, reply) => {
    const c = channels.get(req.params.id);
    if (!c) return reply.code(404).send({ error: 'Channel not found' });
    return c;
  });

  app.post<{
    Body: { name: string; description?: string; memberIds: string[] };
  }>('/api/channels', async (req, reply) => {
    const { name, description, memberIds } = req.body ?? {};
    if (!name?.trim() || !Array.isArray(memberIds) || memberIds.length < 2 || memberIds.length > 6) {
      return reply.code(400).send({ error: 'name and 2-6 memberIds required' });
    }
    for (const id of memberIds) {
      if (!agents.get(id)) {
        return reply.code(400).send({ error: `Unknown agent id: ${id}` });
      }
    }
    const created = channels.create(name.trim(), description ?? '', memberIds);
    return reply.code(201).send(created);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{ name: string; description: string; pinned: boolean }>;
  }>('/api/channels/:id', async (req, reply) => {
    const updated = channels.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: 'Channel not found' });
    return updated;
  });

  app.get<{ Params: { id: string } }>('/api/channels/:id/messages', async (req, reply) => {
    if (!channels.get(req.params.id)) return reply.code(404).send({ error: 'Channel not found' });
    return channels.listMessages(req.params.id);
  });

  app.post<{
    Params: { id: string };
    Body: { content: string; fromAgentId?: string; replyToId?: string };
  }>('/api/channels/:id/messages', async (req, reply) => {
    const channel = channels.get(req.params.id);
    if (!channel) return reply.code(404).send({ error: 'Channel not found' });
    const { content, fromAgentId, replyToId } = req.body ?? {};
    if (!content?.trim()) return reply.code(400).send({ error: 'content required' });
    if (fromAgentId && !channel.memberIds.includes(fromAgentId)) {
      return reply.code(400).send({ error: 'fromAgentId is not a channel member' });
    }
    if (replyToId) {
      const parent = channels.getMessage(replyToId);
      if (!parent || parent.channelId !== channel.id) {
        return reply.code(400).send({ error: 'Invalid replyToId' });
      }
    }

    const msg = channels.postMessage(channel.id, content.trim(), fromAgentId, replyToId);
    const fromName = fromAgentId ? agents.get(fromAgentId)?.name : 'user';

    // Fan-out to member agents (inbox + chat system note)
    for (const memberId of channel.memberIds) {
      if (fromAgentId && memberId === fromAgentId) continue;
      const text = `[#${channel.name}] ${fromName ?? 'user'}: ${content.trim()}`;
      if (fromAgentId) {
        inbox.send(fromAgentId, memberId, text);
      }
      messages.add({
        agentId: memberId,
        role: 'system',
        content: text,
        kind: 'system',
      });
    }

    // User-authored group messages wake participating Bots in parallel. Explicit
    // @mentions narrow the target set; @everyone or no mention addresses the group.
    if (!fromAgentId) {
      const lowered = content.toLowerCase();
      const mentioned = channel.memberIds.filter((memberId) => {
        const a = agents.get(memberId);
        return a ? lowered.includes(`@${a.name.toLowerCase()}`) : false;
      });
      const targets = lowered.includes('@everyone') || mentioned.length === 0
        ? channel.memberIds
        : mentioned;
      const parent = replyToId ? channels.getMessage(replyToId) : null;

      for (const memberId of targets) {
        const agent = agents.get(memberId);
        if (!agent) continue;
        void (async () => {
          try {
            const result = await wakeAgent(
              agent,
              [
                `[Group #${channel.name}] User message: ${content.trim()}`,
                parent ? `This replies to: ${parent.content}` : '',
                `You are @${agent.name}, one member of this group. Respond for the shared outcome if you have a useful contribution. If you have nothing useful to add, reply exactly: (no response).`,
              ]
                .filter(Boolean)
                .join('\n\n'),
              loopDeps,
              { skipPersistUser: true, quietChat: true }
            );
            const normalized = result.trim().toLowerCase();
            if (!result.trim() || normalized === '(no response)' || normalized === 'no response') return;
            channels.postMessage(channel.id, result.trim(), agent.id, msg.id);
          } catch (e) {
            console.error(`[channels] agent @${agent.name} failed:`, e);
          }
        })();
      }
    }

    return reply.code(201).send(msg);
  });

  app.post<{ Params: { id: string; messageId: string }; Body: { emoji: string } }>(
    '/api/channels/:id/messages/:messageId/reaction',
    async (req, reply) => {
      const channel = channels.get(req.params.id);
      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      const existing = channels.getMessage(req.params.messageId);
      if (!existing || existing.channelId !== channel.id) {
        return reply.code(404).send({ error: 'Message not found' });
      }
      const emoji = String(req.body?.emoji || '').trim();
      if (!emoji || emoji.length > 16) return reply.code(400).send({ error: 'emoji required' });
      return channels.toggleReaction(existing.id, emoji);
    }
  );

  app.delete<{ Params: { id: string } }>('/api/channels/:id', async (req, reply) => {
    if (!channels.delete(req.params.id)) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    return { ok: true };
  });
}
