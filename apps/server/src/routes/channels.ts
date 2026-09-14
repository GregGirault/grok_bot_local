import type { FastifyInstance } from 'fastify';
import type { AgentRepo, ChannelRepo, InboxRepo, MessageRepo } from '../db/repos';

export function registerChannelRoutes(
  app: FastifyInstance,
  channels: ChannelRepo,
  agents: AgentRepo,
  inbox: InboxRepo,
  messages: MessageRepo
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
    if (!name?.trim() || !Array.isArray(memberIds) || memberIds.length < 1) {
      return reply.code(400).send({ error: 'name and memberIds (min 1) required' });
    }
    for (const id of memberIds) {
      if (!agents.get(id)) {
        return reply.code(400).send({ error: `Unknown agent id: ${id}` });
      }
    }
    const created = channels.create(name.trim(), description ?? '', memberIds);
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/api/channels/:id/messages', async (req, reply) => {
    if (!channels.get(req.params.id)) return reply.code(404).send({ error: 'Channel not found' });
    return channels.listMessages(req.params.id);
  });

  app.post<{
    Params: { id: string };
    Body: { content: string; fromAgentId?: string };
  }>('/api/channels/:id/messages', async (req, reply) => {
    const channel = channels.get(req.params.id);
    if (!channel) return reply.code(404).send({ error: 'Channel not found' });
    const { content, fromAgentId } = req.body ?? {};
    if (!content?.trim()) return reply.code(400).send({ error: 'content required' });

    const msg = channels.postMessage(channel.id, content.trim(), fromAgentId);
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

    return reply.code(201).send(msg);
  });

  app.delete<{ Params: { id: string } }>('/api/channels/:id', async (req, reply) => {
    if (!channels.delete(req.params.id)) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    return { ok: true };
  });
}
