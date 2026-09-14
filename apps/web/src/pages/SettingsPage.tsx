import { useEffect, useState } from 'react';
import type { HealthStatus, Settings, Routine } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function SettingsPage({
  health,
  onSaved,
}: {
  health: HealthStatus | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Settings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [skills, setSkills] = useState<Array<{ name: string; preview: string }>>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [status, setStatus] = useState('');
  const [newRoutine, setNewRoutine] = useState({
    agentId: '',
    name: '',
    cron: '0 9 * * *',
    prompt: 'Give me a brief morning status of the workspace.',
  });

  useEffect(() => {
    void (async () => {
      const [s, sk, r, a] = await Promise.all([
        api.getSettings(),
        api.listSkills(),
        api.listRoutines(),
        api.listAgents(),
      ]);
      setForm(s);
      setSkills(sk);
      setRoutines(r);
      setAgents(a.map((x) => ({ id: x.id, name: x.name })));
      setNewRoutine((nr) => ({ ...nr, agentId: a[0]?.id ?? '' }));
      try {
        const m = await api.listModels();
        setModels(m.models);
      } catch {
        setModels([]);
      }
    })();
  }, []);

  const save = async () => {
    if (!form) return;
    await api.putSettings(form);
    setStatus('Saved.');
    onSaved();
    setTimeout(() => setStatus(''), 2000);
  };

  const addRoutine = async () => {
    if (!newRoutine.agentId || !newRoutine.name) return;
    const created = await api.createRoutine(newRoutine);
    setRoutines((prev) => [...prev, created]);
    setNewRoutine((nr) => ({ ...nr, name: '' }));
  };

  const removeRoutine = async (id: string) => {
    await api.deleteRoutine(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  if (!form) {
    return <div className="p-8 text-zinc-500">Loading settings…</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Ollama, workspace, skills & routines</p>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-medium text-zinc-200">Connection</h2>
        <label className="block text-sm">
          <span className="text-zinc-400">Ollama base URL</span>
          <input
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={form.ollamaBaseUrl}
            onChange={(e) => setForm({ ...form, ollamaBaseUrl: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Default model</span>
          <input
            list="models"
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={form.defaultModel}
            onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
          />
          <datalist id="models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Workspace root</span>
          <input
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 font-mono text-xs"
            value={form.workspaceRoot}
            onChange={(e) => setForm({ ...form, workspaceRoot: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void save()}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
          >
            Save
          </button>
          {status && <span className="text-sm text-emerald-400">{status}</span>}
        </div>
        <div className="text-xs text-zinc-500">
          Health:{' '}
          {health?.ollama?.reachable ? (
            <span className="text-emerald-400">
              OK · {(health.ollama.models ?? []).length} model(s)
            </span>
          ) : (
            <span className="text-amber-400">
              Unreachable — {health?.ollama?.error || 'start Ollama locally'}
            </span>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-medium text-zinc-200 mb-3">Skills</h2>
        {skills.length === 0 ? (
          <p className="text-sm text-zinc-500">No skills in skills/ folder.</p>
        ) : (
          <ul className="space-y-2">
            {skills.map((s) => (
              <li key={s.name} className="text-sm">
                <span className="text-violet-400 font-mono">{s.name}</span>
                <p className="text-zinc-500 text-xs mt-0.5">{s.preview}…</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-medium text-zinc-200 mb-3">Routines</h2>
        <ul className="space-y-2 mb-4">
          {routines.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between text-sm bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-zinc-500 font-mono">
                  {r.cron} · {r.enabled ? 'on' : 'off'}
                  {r.lastRunAt ? ` · last ${r.lastRunAt}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void api.runRoutine(r.id)}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  Run
                </button>
                <button
                  onClick={() => void removeRoutine(r.id)}
                  className="text-xs px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={newRoutine.agentId}
            onChange={(e) => setNewRoutine({ ...newRoutine, agentId: e.target.value })}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Routine name"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={newRoutine.name}
            onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
          />
          <input
            placeholder="Cron (e.g. 0 9 * * *)"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
            value={newRoutine.cron}
            onChange={(e) => setNewRoutine({ ...newRoutine, cron: e.target.value })}
          />
          <input
            placeholder="Wake prompt"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={newRoutine.prompt}
            onChange={(e) => setNewRoutine({ ...newRoutine, prompt: e.target.value })}
          />
        </div>
        <button
          onClick={() => void addRoutine()}
          className="mt-3 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          Add routine
        </button>
      </section>
    </div>
  );
}
