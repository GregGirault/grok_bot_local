import { useEffect, useState } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import type { HealthStatus, Settings, BackgroundTask } from '@grok-bot/shared';
import { api } from '../lib/api';

const TABS = [
  { to: '/settings/general', label: 'General' },
  { to: '/settings/computer', label: 'Computer' },
  { to: '/settings/connection', label: 'Connection' },
  { to: '/settings/tasks', label: 'Tasks' },
  { to: '/settings/updates', label: 'Updates' },
];

export default function SettingsPage({
  health,
  onSaved,
}: {
  health: HealthStatus | null;
  onSaved: () => void;
}) {
  return (
    <div className="h-full flex">
      <div className="w-44 shrink-0 border-r border-zinc-800 bg-zinc-950 p-3">
        <h1 className="text-[13px] font-semibold px-2 mb-3">Settings</h1>
        <nav className="space-y-0.5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `block rounded-md px-2.5 py-1.5 text-[12px] ${
                  isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <p className="text-[10px] text-zinc-600 px-2 mt-4">Ctrl/, to open</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<GeneralPane />} />
          <Route path="computer" element={<ComputerPane />} />
          <Route path="connection" element={<ConnectionPane health={health} onSaved={onSaved} />} />
          <Route path="tasks" element={<TasksPane />} />
          <Route path="updates" element={<UpdatesPane health={health} />} />
        </Routes>
      </div>
    </div>
  );
}

function GeneralPane() {
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('en');
  const [accent, setAccent] = useState('#8b5cf6');
  return (
    <div className="p-6 max-w-xl space-y-5">
      <h2 className="text-base font-semibold">General</h2>
      <label className="block text-[12px] text-zinc-400">
        Theme
        <select
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="dark">Dark</option>
          <option value="light">Light (coming soon)</option>
          <option value="system">System (coming soon)</option>
        </select>
      </label>
      <label className="block text-[12px] text-zinc-400">
        Language
        <select
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </label>
      <div>
        <div className="text-[12px] text-zinc-400 mb-1.5">Accent color</div>
        <div className="flex gap-2">
          {['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setAccent(c);
                document.documentElement.style.setProperty('--gb-accent', c);
              }}
              className={`h-7 w-7 rounded-full border-2 ${
                accent === c ? 'border-white' : 'border-transparent'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">
        Preferences are local to this browser for now. Theme light/system — coming soon.
      </p>
    </div>
  );
}

function ComputerPane() {
  const machines = [
    { id: 'local', name: 'This machine', status: 'online', os: navigator.platform || 'local' },
  ];
  return (
    <div className="p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Computer</h2>
      <p className="text-[12px] text-zinc-500">
        Registered machines for computer use / browser automation.
      </p>
      <ul className="space-y-2">
        {machines.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
          >
            <div>
              <div className="text-[13px] font-medium">{m.name}</div>
              <div className="text-[11px] text-zinc-500">{m.os}</div>
            </div>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {m.status}
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-[12px] text-zinc-500">
        Add remote machine — coming soon
      </div>
    </div>
  );
}

function ConnectionPane({
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

  useEffect(() => {
    void (async () => {
      const [s, m] = await Promise.all([
        api.getSettings(),
        api.getMcp().catch(() => ({ servers: [] as string[], tools: [] as string[] })),
      ]);
      setForm(s);
      setMcp(m);
      try {
        setModels((await api.listModels()).models);
      } catch {
        setModels([]);
      }
    })();
  }, []);

  if (!form) return <div className="p-6 text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Connection</h2>
      <label className="block text-[12px] text-zinc-400">
        Ollama base URL
        <input
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={form.ollamaBaseUrl}
          onChange={(e) => setForm({ ...form, ollamaBaseUrl: e.target.value })}
        />
      </label>
      <label className="block text-[12px] text-zinc-400">
        Default model
        <input
          list="models"
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={form.defaultModel}
          onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
        />
        <datalist id="models">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label className="block text-[12px] text-zinc-400">
        Workspace root
        <input
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono text-xs"
          value={form.workspaceRoot}
          onChange={(e) => setForm({ ...form, workspaceRoot: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={async () => {
            await api.putSettings(form);
            setStatus('Saved');
            onSaved();
            setTimeout(() => setStatus(''), 1500);
          }}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-[12px] font-medium"
        >
          Save
        </button>
        {status && <span className="text-[12px] text-emerald-400">{status}</span>}
      </div>
      <div className="text-[11px] text-zinc-500">
        Health:{' '}
        {health?.ollama?.reachable ? (
          <span className="text-emerald-400">OK · v{health.version}</span>
        ) : (
          <span className="text-amber-400">{health?.ollama?.error || 'unreachable'}</span>
        )}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-[12px] font-medium mb-1">MCP connectors</div>
        <p className="text-[11px] text-zinc-500 mb-2">
          Edit <code className="text-zinc-400">config/mcp.json</code>
        </p>
        {mcp && mcp.servers.length === 0 ? (
          <p className="text-[12px] text-zinc-500">No servers configured.</p>
        ) : (
          <p className="text-[12px] text-zinc-300">
            {mcp?.servers.join(', ')} · tools: {(mcp?.tools || []).join(', ') || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

function TasksPane() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({ agentId: '', prompt: '' });

  const refresh = async () => {
    const [t, a] = await Promise.all([api.listTasks(), api.listAgents()]);
    setTasks(t);
    setAgents(a.map((x) => ({ id: x.id, name: x.name })));
    setForm((f) => ({ ...f, agentId: f.agentId || a[0]?.id || '' }));
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Background tasks</h2>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-[12px]"
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
          className="flex-1 min-w-[160px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-[12px]"
          placeholder="Prompt…"
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
        <button
          onClick={async () => {
            if (!form.agentId || !form.prompt.trim()) return;
            await api.createTask({ agentId: form.agentId, prompt: form.prompt.trim() });
            setForm((f) => ({ ...f, prompt: '' }));
            await refresh();
          }}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[12px]"
        >
          Enqueue
        </button>
      </div>
      <ul className="space-y-2">
        {tasks.length === 0 && <li className="text-[12px] text-zinc-500">No tasks.</li>}
        {tasks.map((t) => (
          <li key={t.id} className="text-[11px] rounded-lg border border-zinc-800 px-3 py-2">
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
            {t.prompt.slice(0, 100)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpdatesPane({ health }: { health: HealthStatus | null }) {
  return (
    <div className="p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Updates</h2>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-5">
        <div className="text-[13px] font-medium">Grok Bot Local</div>
        <div className="text-[12px] text-zinc-500 mt-1">
          Version {health?.version || '0.2.0'} · You&apos;re up to date (local build)
        </div>
        <button
          className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[12px]"
          onClick={() => alert('Auto-update channel — coming soon')}
        >
          Check for updates
        </button>
      </div>
      <p className="text-[11px] text-zinc-600">
        Pull from GitHub: <code className="text-zinc-400">git pull origin main && npm i && npm run build</code>
      </p>
    </div>
  );
}
