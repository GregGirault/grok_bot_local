import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Agent, Channel, ChannelMessage } from '@grok-bot/shared';
import { api } from '../lib/api';
import AgentAvatar from '../components/AgentAvatar';

export default function ChannelsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [fromAgentId, setFromAgentId] = useState('');

  const refresh = async () => {
    const [a, c] = await Promise.all([api.listAgents(), api.listChannels()]);
    setAgents(a);
    setChannels(c);
    if (!fromAgentId && a[0]) setFromAgentId(a[0].id);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!id) {
      setMessages([]);
      return;
    }
    void api.listChannelMessages(id).then(setMessages).catch(console.error);
  }, [id]);

  const create = async () => {
    if (!name.trim() || memberIds.length < 1) return;
    const ch = await api.createChannel({ name: name.trim(), memberIds });
    setName('');
    setMemberIds([]);
    await refresh();
    navigate(`/channels/${ch.id}`);
  };

  const post = async () => {
    if (!id || !content.trim()) return;
    await api.postChannelMessage(id, {
      content: content.trim(),
      fromAgentId: fromAgentId || undefined,
    });
    setContent('');
    setMessages(await api.listChannelMessages(id));
  };

  const toggleMember = (aid: string) => {
    setMemberIds((prev) =>
      prev.includes(aid) ? prev.filter((x) => x !== aid) : [...prev, aid]
    );
  };

  const active = channels.find((c) => c.id === id);

  return (
    <div className="h-full flex">
      <div className="w-64 border-r border-zinc-800 bg-zinc-950 p-3 flex flex-col">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 px-1">
          Channels
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/channels/${c.id}`)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                c.id === id ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              #{c.name}
              <div className="text-[10px] text-zinc-500">{c.memberIds.length} members</div>
            </button>
          ))}
        </div>
        <div className="border-t border-zinc-800 pt-3 mt-2 space-y-2">
          <input
            className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs"
            placeholder="New channel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="max-h-28 overflow-y-auto space-y-1">
            {agents.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={memberIds.includes(a.id)}
                  onChange={() => toggleMember(a.id)}
                />
                <AgentAvatar agent={a} size={18} />
                @{a.name}
              </label>
            ))}
          </div>
          <button
            onClick={() => void create()}
            className="w-full text-xs px-2 py-1.5 rounded-md bg-violet-700 hover:bg-violet-600"
          >
            Create channel
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Select or create a channel
          </div>
        ) : (
          <>
            <header className="border-b border-zinc-800 px-5 py-3">
              <h1 className="font-semibold">#{active.name}</h1>
              <p className="text-xs text-zinc-500">
                {active.memberIds
                  .map((mid) => '@' + (agents.find((a) => a.id === mid)?.name || mid.slice(0, 6)))
                  .join(', ')}
              </p>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((m) => {
                const from = agents.find((a) => a.id === m.fromAgentId);
                return (
                  <div key={m.id} className="text-sm">
                    <span className="text-cyan-400 font-mono text-xs">
                      {from ? `@${from.name}` : 'user'}
                    </span>
                    <span className="text-zinc-300 ml-2">{m.content}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-zinc-800 p-3 flex gap-2">
              <select
                className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-2 text-xs"
                value={fromAgentId}
                onChange={(e) => setFromAgentId(e.target.value)}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.name}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                placeholder="Post to channel (fans out to members)…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void post();
                }}
              />
              <button
                onClick={() => void post()}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm"
              >
                Post
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
