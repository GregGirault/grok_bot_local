import { useEffect, useState } from 'react';
import type { Agent, Routine, RoutineRun } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function RoutinesPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runs, setRuns] = useState<RoutineRun[]>([]);
  const [form, setForm] = useState({
    agentId: '',
    name: '',
    cron: '0 9 * * *',
    prompt: 'Give me a brief morning status of the workspace.',
    quietIfEmpty: true,
  });

  const refresh = async () => {
    const [a, r, runsList] = await Promise.all([
      api.listAgents(),
      api.listRoutines(),
      api.listRoutineRuns(),
    ]);
    setAgents(a);
    setRoutines(r);
    setRuns(runsList);
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
      <p className="text-sm mb-6" style={{ color: 'var(--gb-muted)' }}>
        Cron wakes · quiet-if-empty · webhooks · run history
      </p>

      <ul className="space-y-2 mb-8">
        {routines.length === 0 && (
          <li className="text-sm" style={{ color: 'var(--gb-muted)' }}>
            No routines yet.
          </li>
        )}
        {routines.map((r) => {
          const agent = agents.find((a) => a.id === r.agentId);
          return (
            <li
              key={r.id}
              className="rounded-xl border px-4 py-3"
              style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {r.name}{' '}
                    <span className="font-normal" style={{ color: 'var(--gb-muted)' }}>
                      · @{agent?.name || '?'}
                    </span>
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--gb-muted)' }}>
                    {r.cron} · {r.enabled ? 'running' : 'paused'}
                    {r.quietIfEmpty ? ' · quiet-if-empty' : ''}
                    {r.lastRunAt ? ` · last ${r.lastRunAt}` : ''}
                  </div>
                  <div className="text-xs mt-1 truncate">{r.prompt}</div>
                  {r.webhookToken && (
                    <div className="text-[10px] font-mono mt-1 text-cyan-400/80">
                      POST /api/hooks/{r.id} · token /api/hooks/token/{r.webhookToken}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => void api.runRoutine(r.id).then(() => setTimeout(refresh, 800))}
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
                    onClick={() =>
                      void api
                        .updateRoutine(r.id, { quietIfEmpty: !r.quietIfEmpty })
                        .then(refresh)
                    }
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                    title="Toggle quiet-if-empty"
                  >
                    Quiet
                  </button>
                  <button
                    onClick={() => void remove(r.id)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="rounded-xl border p-4 space-y-3 mb-8"
        style={{ borderColor: 'var(--gb-border)' }}
      >
        <div className="text-sm font-medium">New routine</div>
        <select
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
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
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="Cron"
          value={form.cron}
          onChange={(e) => setForm({ ...form, cron: e.target.value })}
        />
        <textarea
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          rows={3}
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.quietIfEmpty}
            onChange={(e) => setForm({ ...form, quietIfEmpty: e.target.checked })}
          />
          Quiet if empty
        </label>
        <button
          onClick={() => void add()}
          className="px-4 py-2 rounded-lg text-sm text-white"
          style={{ background: 'var(--gb-accent)' }}
        >
          Create
        </button>
      </div>

      <h2 className="text-sm font-semibold mb-2">Run history</h2>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--gb-border)' }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: 'var(--gb-border)' }}>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Routine</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Output</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4" style={{ color: 'var(--gb-muted)' }}>
                  No runs yet.
                </td>
              </tr>
            )}
            {runs.map((run) => {
              const r = routines.find((x) => x.id === run.routineId);
              return (
                <tr key={run.id} className="border-t" style={{ borderColor: 'var(--gb-border)' }}>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{run.createdAt}</td>
                  <td className="px-3 py-2">{r?.name || run.routineId.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        run.status === 'ok'
                          ? 'text-emerald-400'
                          : run.status === 'skipped'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">
                    {run.error || run.output || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
