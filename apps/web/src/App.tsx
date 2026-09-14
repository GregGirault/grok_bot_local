import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  { to: '/', label: 'Agents', icon: '◎', end: true },
  { to: '/channels', label: 'Channels', icon: '#' },
  { to: '/memory', label: 'Memory', icon: '◈' },
  { to: '/routines', label: 'Routines', icon: '⏱' },
  { to: '/skills', label: 'Skills', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      const [a, h] = await Promise.all([api.listAgents(), api.health()]);
      setAgents(a);
      setHealth(h);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      api.health().then(setHealth).catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <div>
              <div className="font-semibold tracking-tight">Grok Bot Local</div>
              <div className="text-xs text-zinc-500">Phase 1 · Ollama</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                health?.ollama?.reachable ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-zinc-400">
              {health?.ollama?.reachable ? 'Ollama online' : 'Ollama offline'}
            </span>
          </div>
        </div>

        <nav className="px-2 py-2 space-y-0.5 border-b border-zinc-800">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`
              }
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Agents
          </span>
          <button
            onClick={() => navigate('/agents/new')}
            className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {agents.map((a) => (
            <NavLink
              key={a.id}
              to={`/chat/${a.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`
              }
            >
              <AgentAvatar agent={a} size={28} />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{a.title}</div>
                <div className="text-xs text-zinc-500 truncate">@{a.name}</div>
              </div>
            </NavLink>
          ))}
          <div className="pt-3 px-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
              Hidden chats
            </div>
            <div className="text-xs text-zinc-600 italic">None yet</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-zinc-900/40">
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
            path="/settings"
            element={<SettingsPage health={health} onSaved={refresh} />}
          />
        </Routes>
      </main>
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
    <div className="h-full flex items-center justify-center text-zinc-500">
      Loading agents…
    </div>
  );
}
