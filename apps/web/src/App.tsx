import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Agent, HealthStatus } from '@grok-bot/shared';
import { api } from './lib/api';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import NewAgentPage from './pages/NewAgentPage';

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
              <div className="text-xs text-zinc-500">MVP · Ollama</div>
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

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {agents.map((a) => (
            <NavLink
              key={a.id}
              to={`/chat/${a.id}`}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 transition ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`
              }
            >
              <div className="font-medium text-sm truncate">{a.title}</div>
              <div className="text-xs text-zinc-500 truncate">@{a.name}</div>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 p-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm ${
                isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
              }`
            }
          >
            ⚙ Settings
          </NavLink>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-zinc-900/40">
        <Routes>
          <Route path="/" element={<Home agents={agents} />} />
          <Route path="/chat/:agentId" element={<ChatPage onAgentsChange={refresh} />} />
          <Route path="/agents/new" element={<NewAgentPage onCreated={refresh} />} />
          <Route path="/settings" element={<SettingsPage health={health} onSaved={refresh} />} />
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
