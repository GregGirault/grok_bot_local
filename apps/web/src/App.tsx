import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import type { Agent, HealthStatus } from '@grok-bot/shared';
import { api } from './lib/api';
import AgentAvatar from './components/AgentAvatar';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import NewAgentPage from './pages/NewAgentPage';
import MemoryPage from './pages/MemoryPage';
import RoutinesPage from './pages/RoutinesPage';
import SkillsPage from './pages/SkillsPage';
import ChannelsPage from './pages/ChannelsPage';

const NAV = [
  { to: '/channels', label: 'Channels', icon: '#' },
  { to: '/memory', label: 'Memory', icon: '◈' },
  { to: '/routines', label: 'Routines', icon: '⏱' },
  { to: '/skills', label: 'Skills', icon: '✦' },
];

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; agent: Agent } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const refresh = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([api.listAgents(), api.health()]);
      setAgents(a);
      setHealth(h);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      api.health().then(setHealth).catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteAgent(confirmDelete.id);
      setConfirmDelete(null);
      await refresh();
      navigate('/');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex h-full gb-dense" onContextMenu={(e) => e.preventDefault()}>
      <aside className="w-[240px] shrink-0 border-r border-zinc-800 bg-[var(--gb-panel)] flex flex-col">
        <div className="px-3 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 rounded-lg bg-violet-600/90 flex items-center justify-center text-sm font-bold shadow-sm shadow-violet-900/40"
              aria-hidden
            >
              G
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] tracking-tight truncate">Grok Bot Local</div>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    health?.ollama?.reachable ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {health?.ollama?.reachable ? 'Online' : 'Ollama offline'}
              </div>
            </div>
          </div>
        </div>

        <nav className="px-1.5 py-1.5 space-y-0.5 border-b border-zinc-800">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`
              }
            >
              <span className="w-3.5 text-center opacity-70 text-[11px]">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2.5 py-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Agents
          </span>
          <button
            onClick={() => navigate('/agents/new')}
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
          {agents.map((a) => (
            <NavLink
              key={a.id}
              to={`/chat/${a.id}`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCtxMenu({ x: e.clientX, y: e.clientY, agent: a });
              }}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-1.5 transition ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`
              }
            >
              <AgentAvatar agent={a} size={26} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[12px] truncate leading-tight">{a.title}</div>
                <div className="text-[10px] text-zinc-500 truncate leading-tight">@{a.name}</div>
              </div>
            </NavLink>
          ))}

          <div className="pt-3 px-2">
            <div className="text-[9px] uppercase tracking-wider text-zinc-700 mb-1">Hidden chats</div>
            <div className="text-[11px] text-zinc-700 italic">None</div>
          </div>
        </div>

        <div className="border-t border-zinc-800 p-1.5">
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition ${
              location.pathname.startsWith('/settings')
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Settings (Ctrl/,)"
          >
            <span className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px]">
              You
            </span>
            <span className="truncate">Account · Settings</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-zinc-950/40">
        <Routes>
          <Route path="/" element={<Home agents={agents} />} />
          <Route path="/chat/:agentId" element={<ChatPage onAgentsChange={refresh} />} />
          <Route path="/agents/new" element={<NewAgentPage onCreated={refresh} />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/channels/:id" element={<ChannelsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route
            path="/settings/*"
            element={<SettingsPage health={health} onSaved={refresh} />}
          />
        </Routes>
      </main>

      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1 text-[12px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800"
            onClick={() => {
              navigate(`/chat/${ctxMenu.agent.id}`);
              setCtxMenu(null);
            }}
          >
            Open chat
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-red-400"
            onClick={() => {
              setConfirmDelete(ctxMenu.agent);
              setCtxMenu(null);
            }}
          >
            Delete…
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-sm mb-1">Delete agent?</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Permanently delete <strong className="text-zinc-200">@{confirmDelete.name}</strong> and
              its chat history. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => void doDelete()}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Home({ agents }: { agents: Agent[] }) {
  const navigate = useNavigate();
  const dev = agents.find((a) => a.name === 'dev') ?? agents[0];
  useEffect(() => {
    if (dev) navigate(`/chat/${dev.id}`, { replace: true });
  }, [dev, navigate]);
  return (
    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
      Loading…
    </div>
  );
}
