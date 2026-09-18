import { useEffect, useState } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import type { HealthStatus, Settings, BackgroundTask, Machine } from '@grok-bot/shared';
import { api } from '../lib/api';
import { applyTheme, applyAccent, saveLang, t, type Lang } from '../lib/i18n';

export default function SettingsPage({
  health,
  onSaved,
  lang,
  onLangChange,
}: {
  health: HealthStatus | null;
  onSaved: () => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
}) {
  const TABS = [
    { to: '/settings/general', label: t(lang, 'general') },
    { to: '/settings/computer', label: t(lang, 'computer') },
    { to: '/settings/connection', label: t(lang, 'connection') },
    { to: '/settings/connectors', label: t(lang, 'connectors') },
    { to: '/settings/tasks', label: t(lang, 'tasks') },
    { to: '/settings/updates', label: t(lang, 'updates') },
  ];

  return (
    <div className="h-full flex flex-col sm:flex-row">
      <div
        className="w-full shrink-0 border-b p-2 sm:w-44 sm:border-b-0 sm:border-r sm:p-3"
        style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}
      >
        <h1 className="hidden sm:block text-[13px] font-semibold px-2 mb-3">{t(lang, 'settings')}</h1>
        <nav className="flex gap-1 overflow-x-auto sm:block sm:space-y-0.5">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `block shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] ${
                  isActive ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900'
                }`
              }
              style={({ isActive }) => ({ color: isActive ? undefined : 'var(--gb-muted)' })}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <p className="hidden sm:block text-[10px] px-2 mt-4" style={{ color: 'var(--gb-muted)' }}>
          Ctrl/, to open
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="general" replace />} />
          <Route
            path="general"
            element={<GeneralPane lang={lang} onLangChange={onLangChange} />}
          />
          <Route path="computer" element={<ComputerPane />} />
          <Route path="connection" element={<ConnectionPane health={health} onSaved={onSaved} />} />
          <Route path="connectors" element={<ConnectorsPane />} />
          <Route path="tasks" element={<TasksPane />} />
          <Route path="updates" element={<UpdatesPane health={health} />} />
        </Routes>
      </div>
    </div>
  );
}

function GeneralPane({
  lang,
  onLangChange,
}: {
  lang: Lang;
  onLangChange: (l: Lang) => void;
}) {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [accent, setAccent] = useState('#8b5cf6');
  const [status, setStatus] = useState('');

  useEffect(() => {
    void api.getSettings().then((s) => {
      if (s.theme) setTheme(s.theme);
      if (s.accentColor) setAccent(s.accentColor);
    });
  }, []);

  const persist = async (patch: Partial<Settings>) => {
    await api.putSettings(patch);
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1200);
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl space-y-5">
      <h2 className="text-base font-semibold">{t(lang, 'general')}</h2>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        {t(lang, 'theme')}
        <select
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={theme}
          onChange={(e) => {
            const v = e.target.value as 'dark' | 'light' | 'system';
            setTheme(v);
            applyTheme(v);
            void persist({ theme: v });
          }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        {t(lang, 'language')}
        <select
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={lang}
          onChange={(e) => {
            const v = e.target.value as Lang;
            onLangChange(v);
            saveLang(v);
            void persist({ language: v });
          }}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </label>
      <div>
        <div className="text-[12px] mb-1.5" style={{ color: 'var(--gb-muted)' }}>
          {t(lang, 'accent')}
        </div>
        <div className="flex gap-2">
          {['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setAccent(c);
                applyAccent(c);
                void persist({ accentColor: c });
              }}
              className={`h-7 w-7 rounded-full border-2 ${
                accent === c ? 'border-white' : 'border-transparent'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {status && <p className="text-[11px] text-emerald-400">{status}</p>}
    </div>
  );
}

function ComputerPane() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [form, setForm] = useState({ name: '', host: 'localhost', path: '' });

  const refresh = () => void api.listMachines().then(setMachines);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Computer</h2>
      <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Registered machines for computer use / copy_to_workspace tools.
      </p>
      <ul className="space-y-2">
        {machines.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-card)' }}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{m.name}</div>
              <div className="text-[11px] font-mono truncate" style={{ color: 'var(--gb-muted)' }}>
                {m.host} · {m.path || '(no path)'}
              </div>
            </div>
            <button
              className="text-[11px] text-red-400 px-2"
              onClick={() => void api.deleteMachine(m.id).then(refresh)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed p-4 space-y-2" style={{ borderColor: 'var(--gb-border)' }}>
        <div className="text-[12px] font-medium">Add machine</div>
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-[12px]"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-[12px]"
          placeholder="Host"
          value={form.host}
          onChange={(e) => setForm({ ...form, host: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-[12px] font-mono"
          placeholder="Path"
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
        />
        <button
          className="px-3 py-1.5 rounded-lg text-[12px] text-white"
          style={{ background: 'var(--gb-accent)' }}
          onClick={async () => {
            if (!form.name.trim()) return;
            await api.createMachine(form);
            setForm({ name: '', host: 'localhost', path: '' });
            refresh();
          }}
        >
          Add
        </button>
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
  const [network, setNetwork] = useState<Awaited<ReturnType<typeof api.networkInfo>> | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await api.getSettings();
      setForm(s);
      try {
        setModels((await api.listModels()).models);
      } catch {
        setModels([]);
      }
      setNetwork(await api.networkInfo().catch(() => null));
    })();
  }, []);

  if (!form) return <div className="p-6 text-sm" style={{ color: 'var(--gb-muted)' }}>Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Connection</h2>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Ollama base URL
        <input
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={form.ollamaBaseUrl}
          onChange={(e) => setForm({ ...form, ollamaBaseUrl: e.target.value })}
        />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
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
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Workspace root
        <input
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono text-xs"
          value={form.workspaceRoot}
          onChange={(e) => setForm({ ...form, workspaceRoot: e.target.value })}
        />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Task concurrency
        <input
          type="number"
          min={1}
          max={8}
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={form.taskConcurrency ?? 2}
          onChange={(e) =>
            setForm({ ...form, taskConcurrency: Number(e.target.value) || 2 })
          }
        />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Default timezone
        <input
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          value={form.timezone || ''}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          placeholder="Europe/Paris"
        />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Local shell execution
        <select
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          value={form.localExecutionPolicy || 'ask'}
          onChange={(e) =>
            setForm({
              ...form,
              localExecutionPolicy: e.target.value as Settings['localExecutionPolicy'],
            })
          }
        >
          <option value="ask">Ask every time</option>
          <option value="always">Always allow</option>
          <option value="never">Never allow</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={form.autoReviewEnabled !== false}
          onChange={(e) => setForm({ ...form, autoReviewEnabled: e.target.checked })}
        />
        Auto Review dangerous shell commands
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Always ask rules · one regex or substring per line
        <textarea
          rows={3}
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono"
          value={(form.autoReviewAskPatterns || []).join('\n')}
          onChange={(e) =>
            setForm({
              ...form,
              autoReviewAskPatterns: e.target.value
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Always allow rules · one regex or substring per line
        <textarea
          rows={3}
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono"
          value={(form.autoReviewAllowPatterns || []).join('\n')}
          onChange={(e) =>
            setForm({
              ...form,
              autoReviewAllowPatterns: e.target.value
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
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
          className="px-4 py-2 rounded-lg text-[12px] font-medium text-white"
          style={{ background: 'var(--gb-accent)' }}
        >
          Save
        </button>
        {status && <span className="text-[12px] text-emerald-400">{status}</span>}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
        Health:{' '}
        {health?.ollama?.reachable ? (
          <span className="text-emerald-400">OK · v{health.version}</span>
        ) : (
          <span className="text-amber-400">{health?.ollama?.error || 'unreachable'}</span>
        )}
      </div>
      <div className="rounded-xl border p-3 text-[11px] space-y-1" style={{ borderColor: 'var(--gb-border)' }}>
        <div className="font-medium text-xs text-zinc-200">Mobile access</div>
        {network?.lanEnabled ? (
          <>
            <div>Server is listening on the LAN.</div>
            {network.urls.map((url) => (
              <div key={url} className="font-mono break-all text-cyan-400">{url}</div>
            ))}
          </>
        ) : (
          <div>
            Start with <code className="text-zinc-200">npm run start:lan</code> after building to expose this UI to phones on the same network.
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorsPane() {
  const [mcp, setMcp] = useState<Awaited<ReturnType<typeof api.getMcp>> | null>(null);
  const [raw, setRaw] = useState('[]');
  const [status, setStatus] = useState('');

  const refresh = async () => {
    const [m, cfg] = await Promise.all([api.getMcp(), api.getMcpConfig()]);
    setMcp(m);
    setRaw(JSON.stringify(cfg.servers, null, 2));
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <h2 className="text-base font-semibold">MCP Connectors</h2>
      <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        Enable/disable servers and edit <code>config/mcp.json</code> via the UI.
      </p>
      <ul className="space-y-2">
        {(mcp?.all || []).map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--gb-border)' }}
          >
            <div>
              <div className="text-[13px] font-medium">{s.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                {s.command || 'url'} · tools: {(s.tools || []).join(', ') || '—'}
              </div>
            </div>
            <label className="text-[11px] flex items-center gap-2">
              <input
                type="checkbox"
                checked={!s.disabled}
                onChange={(e) =>
                  void api.toggleMcpServer(s.name, !e.target.checked).then(refresh)
                }
              />
              Enabled
            </label>
          </li>
        ))}
      </ul>
      <label className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
        mcp.json servers array
        <textarea
          className="mt-1 w-full h-48 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-[11px] font-mono"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </label>
      <button
        className="px-3 py-1.5 rounded-lg text-[12px] text-white"
        style={{ background: 'var(--gb-accent)' }}
        onClick={async () => {
          try {
            const servers = JSON.parse(raw) as unknown[];
            await api.putMcpConfig(servers);
            setStatus('Saved & reloaded');
            await refresh();
          } catch (e) {
            setStatus(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Save config
      </button>
      {status && <span className="text-[12px] ml-2 text-emerald-400">{status}</span>}
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
    <div className="p-4 sm:p-6 max-w-xl space-y-4">
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
        {tasks.length === 0 && (
          <li className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
            No tasks.
          </li>
        )}
        {tasks.map((task) => (
          <li
            key={task.id}
            className="text-[11px] rounded-lg border px-3 py-2"
            style={{ borderColor: 'var(--gb-border)' }}
          >
            <span
              className={
                task.status === 'done'
                  ? 'text-emerald-400'
                  : task.status === 'error'
                    ? 'text-red-400'
                    : 'text-amber-400'
              }
            >
              [{task.status}]
            </span>{' '}
            {task.prompt.slice(0, 100)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpdatesPane({ health }: { health: HealthStatus | null }) {
  const [result, setResult] = useState<string>('');
  const [checking, setChecking] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-xl space-y-4">
      <h2 className="text-base font-semibold">Updates</h2>
      <div
        className="rounded-xl border px-4 py-5"
        style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-card)' }}
      >
        <div className="text-[13px] font-medium">Grok Bot Local</div>
        <div className="text-[12px] mt-1" style={{ color: 'var(--gb-muted)' }}>
          Version {health?.version || '0.3.0'}
        </div>
        <button
          className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[12px]"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try {
              const r = await api.checkUpdates();
              if (r.ok) {
                setResult(
                  `Latest (${r.source}): ${r.latest || 'n/a'}${r.url ? ` — ${r.url}` : ''}`
                );
              } else {
                setResult(`Check failed (graceful): ${r.error || 'unknown'} · current ${r.current}`);
              }
            } catch (e) {
              setResult(e instanceof Error ? e.message : String(e));
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {result && <p className="text-[11px] mt-3 whitespace-pre-wrap">{result}</p>}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
        Pull from GitHub:{' '}
        <code>git pull origin main && npm i && npm run build</code>
      </p>
    </div>
  );
}
