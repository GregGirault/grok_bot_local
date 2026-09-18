import { useEffect, useState } from 'react';
import type { Agent, MemoryEntry } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function MemoryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [agentId, setAgentId] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tier, setTier] = useState('note');
  const [scope, setScope] = useState('agent');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [userOnly, setUserOnly] = useState(false);

  const refresh = async (aid?: string, q?: string, user?: boolean) => {
    if (user) {
      setEntries(await api.listUserMemory());
      return;
    }
    const list = await (q?.trim()
      ? api.searchMemory(q.trim(), aid || undefined)
      : api.listMemory(aid || undefined));
    setEntries(list);
  };

  useEffect(() => {
    void (async () => {
      const a = await api.listAgents();
      setAgents(a);
      setAgentId(a[0]?.id ?? '');
      await refresh();
    })();
  }, []);

  const add = async () => {
    if (!agentId || !key.trim()) return;
    await api.addMemory({ agentId, key: key.trim(), value, tier, scope });
    setKey('');
    setValue('');
    setStatus('Added.');
    await refresh(agentId || undefined, query, userOnly);
    setTimeout(() => setStatus(''), 1500);
  };

  const forget = async (id: string) => {
    await api.forgetMemory(id);
    await refresh(agentId || undefined, query, userOnly);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Memory</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--gb-muted)' }}>
        Tiers · pin→profile · user-global · auto note→log after 7 days
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={agentId}
          onChange={(e) => {
            setAgentId(e.target.value);
            setUserOnly(false);
            void refresh(e.target.value || undefined, query, false);
          }}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.name}
            </option>
          ))}
        </select>
        <button
          className={`px-3 py-2 rounded-lg text-sm ${userOnly ? 'bg-violet-700' : 'bg-zinc-800'}`}
          onClick={() => {
            setUserOnly(true);
            void refresh(undefined, undefined, true);
          }}
        >
          User-global
        </button>
        <button
          className="px-3 py-2 rounded-lg bg-zinc-800 text-sm"
          onClick={() => void fetch('/api/memory/promote', { method: 'POST' }).then(() => refresh(agentId || undefined, query, userOnly))}
        >
          Promote stale
        </button>
        <input
          className="flex-1 min-w-[160px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void refresh(agentId || undefined, query, userOnly);
          }}
        />
        <button
          onClick={() => void refresh(agentId || undefined, query, userOnly)}
          className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          Search
        </button>
      </div>

      <div
        className="rounded-xl border p-4 mb-6 space-y-2"
        style={{ borderColor: 'var(--gb-border)' }}
      >
        <div className="text-sm font-medium">Add memory</div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
            placeholder="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <input
            className="flex-1 min-w-[160px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-2 text-sm"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option value="note">note</option>
            <option value="log">log</option>
            <option value="profile">profile</option>
          </select>
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="agent">agent</option>
            <option value="user">user</option>
            <option value="project">project</option>
          </select>
          <button
            onClick={() => void add()}
            className="px-4 py-2 rounded-lg text-sm text-white"
            style={{ background: 'var(--gb-accent)' }}
          >
            Add
          </button>
        </div>
        {status && <p className="text-xs text-emerald-400">{status}</p>}
      </div>

      <ul className="space-y-2">
        {entries.length === 0 && (
          <li className="text-sm" style={{ color: 'var(--gb-muted)' }}>
            No memory entries.
          </li>
        )}
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--gb-border)' }}
          >
            <div className="min-w-0">
              <div className="font-mono text-sm">
                <span className="text-violet-300">{e.key}</span>
                <span className="text-[10px] ml-2" style={{ color: 'var(--gb-muted)' }}>
                  [{e.tier}/{e.scope}{e.pinned ? '/pin' : ''}]
                </span>
              </div>
              <div className="text-sm mt-1 whitespace-pre-wrap">{e.value}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() =>
                  void api.pinMemory(e.id, !e.pinned).then(() =>
                    refresh(agentId || undefined, query, userOnly)
                  )
                }
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
              >
                {e.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={() => void forget(e.id)}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-red-400"
              >
                Forget
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
