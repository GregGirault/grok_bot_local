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
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    const [a, c] = await Promise.all([api.listAgents(), api.listChannels()]);
    setAgents(a);
    setChannels(c);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!id) {
      setMessages([]);
      return;
    }
    setContent(localStorage.getItem(`gb-channel-draft:${id}`) || '');
    setReplyTo(null);
    let cancelled = false;
    const load = () =>
      void api
        .listChannelMessages(id)
        .then((m) => {
          if (!cancelled) setMessages(m);
        })
        .catch(console.error);
    load();
    const timer = window.setInterval(load, 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  const create = async () => {
    setError('');
    if (!name.trim() || memberIds.length < 2 || memberIds.length > 6) {
      setError('Choose a name and 2–6 Bots.');
      return;
    }
    try {
      const ch = await api.createChannel({ name: name.trim(), memberIds });
      setName('');
      setMemberIds([]);
      await refresh();
      navigate(`/channels/${ch.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const post = async () => {
    if (!id || !content.trim()) return;
    await api.postChannelMessage(id, {
      content: content.trim(),
      fromAgentId: fromAgentId || undefined,
      replyToId: replyTo?.id,
    });
    setContent('');
    localStorage.removeItem(`gb-channel-draft:${id}`);
    setReplyTo(null);
    setMessages(await api.listChannelMessages(id));
  };

  const toggleMember = (aid: string) => {
    setMemberIds((prev) => {
      if (prev.includes(aid)) return prev.filter((x) => x !== aid);
      return prev.length >= 6 ? prev : [...prev, aid];
    });
  };

  const active = channels.find((c) => c.id === id);

  return (
    <div className="h-full flex flex-col sm:flex-row">
      <div className="w-full max-h-[42%] sm:max-h-none sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-800 bg-zinc-950 p-3 flex flex-col">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 px-1">
          Channels
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/channels/${c.id}`)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                c.id === id ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {c.pinned ? '★ ' : ''}#{c.name}
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
            disabled={memberIds.length < 2 || memberIds.length > 6 || !name.trim()}
            className="w-full text-xs px-2 py-1.5 rounded-md bg-violet-700 hover:bg-violet-600 disabled:opacity-40"
          >
            Create group ({memberIds.length}/6)
          </button>
          {error && <div className="text-[10px] text-red-400">{error}</div>}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Select or create a channel
          </div>
        ) : (
          <>
            <header className="border-b border-zinc-800 px-3 sm:px-5 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
              <h1 className="font-semibold">{active.pinned ? '★ ' : ''}#{active.name}</h1>
              <p className="text-xs text-zinc-500">
                {active.memberIds
                  .map((mid) => '@' + (agents.find((a) => a.id === mid)?.name || mid.slice(0, 6)))
                  .join(', ')}
              </p>
              </div>
              <button
                type="button"
                onClick={() => void api.updateChannel(active.id, { pinned: !active.pinned }).then(refresh)}
                className="rounded-md bg-zinc-800 px-2 py-1 text-[11px]"
              >
                {active.pinned ? 'Unpin' : 'Pin'}
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2">
              {messages.map((m) => {
                const from = agents.find((a) => a.id === m.fromAgentId);
                const parent = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
                return (
                  <div key={m.id} className="group rounded-lg px-2 py-1.5 hover:bg-zinc-900/50 text-sm">
                    {parent && (
                      <div className="mb-1 border-l-2 border-zinc-700 pl-2 text-[10px] text-zinc-500 truncate">
                        {parent.content}
                      </div>
                    )}
                    <span className={`font-mono text-xs ${from ? 'text-cyan-400' : 'text-violet-300'}`}>
                      {from ? `@${from.name}` : 'user'}
                    </span>
                    <span className="text-zinc-300 ml-2">{m.content}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition">
                      <button type="button" onClick={() => setReplyTo(m)} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]">Reply</button>
                      {['👍', '❤️', '👀'].map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          onClick={() => void api.reactChannelMessage(active.id, m.id, emoji).then((updated) => setMessages((prev) => prev.map((x) => x.id === updated.id ? updated : x)))}
                          className="rounded bg-zinc-800 px-1 py-0.5 text-[10px]"
                        >
                          {emoji}
                        </button>
                      ))}
                      {m.reactions && Object.entries(m.reactions).map(([emoji, count]) => (
                        <span key={emoji} className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">{emoji} {count}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {replyTo && (
              <div className="border-t border-zinc-800 px-3 py-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="text-violet-300">Replying</span>
                <span className="truncate flex-1">{replyTo.content}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="rounded bg-zinc-800 px-1.5">×</button>
              </div>
            )}
            <div className="border-t border-zinc-800 p-2 sm:p-3 flex gap-1.5 sm:gap-2">
              <select
                className="max-w-[96px] sm:max-w-none rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-2 text-xs"
                value={fromAgentId}
                onChange={(e) => setFromAgentId(e.target.value)}
              >
                <option value="">You</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.name}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                placeholder="Message group · @bot or @everyone…"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (id) localStorage.setItem(`gb-channel-draft:${id}`, e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void post();
                }}
              />
              <button
                onClick={() => void post()}
                className="px-3 sm:px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm"
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
