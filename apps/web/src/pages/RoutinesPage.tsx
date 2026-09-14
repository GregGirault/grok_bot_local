import { useEffect, useState } from 'react';
import type { Agent, Routine } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function RoutinesPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [form, setForm] = useState({
    agentId: '',
    name: '',
    cron: '0 9 * * *',
    prompt: 'Give me a brief morning status of the workspace.',
  });

  const refresh = async () => {
    const [a, r] = await Promise.all([api.listAgents(), api.listRoutines()]);
    setAgents(a);
    setRoutines(r);
    setForm((f) => ({ ...f, agentId: f.agentId || a[0]?.id || '' }));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const add = async () => {
    if (!form.agentId || !form.name.trim()) return;
    await api.createRoutine(form);
    setForm((f) => ({ ...f, name: '' }));
    await refresh();
  };

  const toggle = async (r: Routine) => {
    await api.updateRoutine(r.id, { enabled: !r.enabled });
    await refresh();
  };

  const remove = async (id: string) => {
    await api.deleteRoutine(id);
    await refresh();
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Routines</h1>
      <p className="text-sm text-zinc-500 mb-6">Cron wakes · pause / resume / delete</p>

      <ul className="space-y-2 mb-8">
        {routines.length === 0 && (
          <li className="text-sm text-zinc-500">No routines yet.</li>
        )}
        {routines.map((r) => {
          const agent = agents.find((a) => a.id === r.agentId);
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {r.name}{' '}
                  <span className="text-zinc-500 font-normal">
                    · @{agent?.name || '?'}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">
                  {r.cron} · {r.enabled ? 'running' : 'paused'}
                  {r.lastRunAt ? ` · last ${r.lastRunAt}` : ''}
                </div>
                <div className="text-xs text-zinc-400 mt-1 truncate">{r.prompt}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void api.runRoutine(r.id)}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  Run
                </button>
                <button
                  onClick={() => void toggle(r)}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  {r.enabled ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => void remove(r.id)}
                  className="text-xs px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <h2 className="font-medium text-zinc-200">Create routine</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={form.agentId}
            onChange={(e) => setForm({ ...form, agentId: e.target.value })}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Name"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Cron"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
            value={form.cron}
            onChange={(e) => setForm({ ...form, cron: e.target.value })}
          />
          <input
            placeholder="Wake prompt"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          />
        </div>
        <button
          onClick={() => void add()}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm"
        >
          Create
        </button>
      </section>
    </div>
  );
}
