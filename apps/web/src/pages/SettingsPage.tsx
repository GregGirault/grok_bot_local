import { useEffect, useState } from 'react';
import type { HealthStatus, Settings, BackgroundTask } from '@grok-bot/shared';
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
  const [status, setStatus] = useState('');
  const [mcp, setMcp] = useState<{ servers: string[]; tools: string[] } | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [taskForm, setTaskForm] = useState({ agentId: '', prompt: '' });

  useEffect(() => {
    void (async () => {
      const [s, a, t, m] = await Promise.all([
        api.getSettings(),
        api.listAgents(),
        api.listTasks(),
        api.getMcp().catch(() => ({ servers: [], tools: [] })),
      ]);
      setForm(s);
      setAgents(a.map((x) => ({ id: x.id, name: x.name })));
      setTasks(t);
      setMcp(m);
      setTaskForm((f) => ({ ...f, agentId: a[0]?.id ?? '' }));
      try {
        const mods = await api.listModels();
        setModels(mods.models);
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

  const enqueue = async () => {
    if (!taskForm.agentId || !taskForm.prompt.trim()) return;
    const task = await api.createTask({
      agentId: taskForm.agentId,
      prompt: taskForm.prompt.trim(),
    });
    setTasks((prev) => [task, ...prev]);
    setTaskForm((f) => ({ ...f, prompt: '' }));
  };

  if (!form) {
    return <div className="p-8 text-zinc-500">Loading settings…</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Ollama, workspace, MCP & background tasks</p>

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
              OK · {(health.ollama.models ?? []).length} model(s) · v{health.version}
            </span>
          ) : (
            <span className="text-amber-400">
              Unreachable — {health?.ollama?.error || 'start Ollama locally'}
            </span>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-medium text-zinc-200 mb-2">MCP connectors</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Configure servers in <code className="text-zinc-400">config/mcp.json</code> (see{' '}
          <code className="text-zinc-400">config/mcp.example.json</code>).
        </p>
        {mcp && mcp.servers.length === 0 ? (
          <p className="text-sm text-zinc-500">No MCP servers configured (default).</p>
        ) : (
          <div className="text-sm text-zinc-300">
            Servers: {mcp?.servers.join(', ')}
            <div className="text-xs text-zinc-500 mt-1 font-mono">
              Tools: {(mcp?.tools || []).join(', ') || '(none)'}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-medium text-zinc-200 mb-3">Background tasks</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            value={taskForm.agentId}
            onChange={(e) => setTaskForm({ ...taskForm, agentId: e.target.value })}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.name}
              </option>
            ))}
          </select>
          <input
            className="flex-1 min-w-[200px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            placeholder="Prompt for background agent run…"
            value={taskForm.prompt}
            onChange={(e) => setTaskForm({ ...taskForm, prompt: e.target.value })}
          />
          <button
            onClick={() => void enqueue()}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            Enqueue
          </button>
          <button
            onClick={() => void api.listTasks().then(setTasks)}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            Refresh
          </button>
        </div>
        <ul className="space-y-2">
          {tasks.length === 0 && (
            <li className="text-sm text-zinc-500">No tasks yet.</li>
          )}
          {tasks.map((t) => (
            <li
              key={t.id}
              className="text-xs rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <span
                className={
                  t.status === 'done'
                    ? 'text-emerald-400'
                    : t.status === 'error'
                      ? 'text-red-400'
                      : 'text-amber-400'
                }
              >
                [{t.status}]
              </span>{' '}
              <span className="text-zinc-400">{t.prompt.slice(0, 80)}</span>
              {t.result && (
                <pre className="mt-1 text-zinc-500 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {t.result.slice(0, 500)}
                </pre>
              )}
              {t.error && <div className="text-red-400 mt-1">{t.error}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
