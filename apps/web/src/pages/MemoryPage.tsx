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
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const refresh = async (aid?: string, q?: string) => {
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
    await api.addMemory({ agentId, key: key.trim(), value, tier });
    setKey('');
    setValue('');
    setStatus('Added.');
    await refresh(agentId || undefined, query);
    setTimeout(() => setStatus(''), 1500);
  };

  const forget = async (id: string) => {
    await api.forgetMemory(id);
    await refresh(agentId || undefined, query);
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Memory</h1>
      <p className="text-sm text-zinc-500 mb-6">List, add, and forget persistent facts</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={agentId}
          onChange={(e) => {
            setAgentId(e.target.value);
            void refresh(e.target.value || undefined, query);
          }}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.name}
            </option>
          ))}
        </select>
        <input
          className="flex-1 min-w-[160px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void refresh(agentId || undefined, query);
          }}
        />
        <button
          onClick={() => void refresh(agentId || undefined, query)}
          className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          Search
        </button>
      </div>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
        <div className="text-sm font-medium text-zinc-300">Add fact</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
            placeholder="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option value="note">note</option>
            <option value="profile">profile</option>
            <option value="log">log</option>
          </select>
          <input
            className="sm:col-span-2 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void add()}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm"
          >
            Add
          </button>
          {status && <span className="text-sm text-emerald-400">{status}</span>}
        </div>
      </section>

      <ul className="space-y-2">
        {entries.length === 0 && (
          <li className="text-sm text-zinc-500">No memory entries.</li>
        )}
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm">
                <span className="text-violet-400 font-mono">{e.key}</span>
                <span className="text-zinc-500 text-xs ml-2">
                  [{e.tier}/{e.scope}]
                </span>
              </div>
              <div className="text-sm text-zinc-300 mt-0.5 break-words">{e.value}</div>
            </div>
            <button
              onClick={() => void forget(e.id)}
              className="text-xs px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-300 shrink-0"
            >
              Forget
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
