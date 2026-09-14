import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import type { Agent, HealthStatus } from '@grok-bot/shared';
import { api } from './lib/api';
import { initChromePrefs, t, type Lang, applyTheme, applyAccent, saveLang } from './lib/i18n';
import AgentAvatar from './components/AgentAvatar';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import NewAgentPage from './pages/NewAgentPage';
import MemoryPage from './pages/MemoryPage';
import RoutinesPage from './pages/RoutinesPage';
import SkillsPage from './pages/SkillsPage';
import ChannelsPage from './pages/ChannelsPage';
import ProjectsPage from './pages/ProjectsPage';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hidden, setHidden] = useState<Agent[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; agent: Agent } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [approvals, setApprovals] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();

  const refresh = useCallback(async () => {
    try {
      const [a, h, hid, ap] = await Promise.all([
        api.listAgents(),
        api.health(),
        api.listHiddenAgents().catch(() => [] as Agent[]),
        api.listApprovals().catch(() => []),
      ]);
      setAgents(a);
      setHealth(h);
      setHidden(hid);
      setApprovals(ap.length);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const prefs = initChromePrefs();
    setLang(prefs.lang);
    void refresh();
    const tmr = setInterval(() => {
      api.health().then(setHealth).catch(() => undefined);
      api.listApprovals().then((a) => setApprovals(a.length)).catch(() => undefined);
    }, 15000);
    return () => clearInterval(tmr);
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

  // Sync settings from server once
  useEffect(() => {
    void api.getSettings().then((s) => {
      if (s.theme) applyTheme(s.theme);
      if (s.accentColor) applyAccent(s.accentColor);
      if (s.language) {
        saveLang(s.language);
        setLang(s.language);
      }
    }).catch(() => undefined);
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

  const NAV = [
    { to: '/channels', label: t(lang, 'channels'), icon: '#' },
    { to: '/projects', label: t(lang, 'projects'), icon: '◫' },
    { to: '/memory', label: t(lang, 'memory'), icon: '◈' },
    { to: '/routines', label: t(lang, 'routines'), icon: '⏱' },
    { to: '/skills', label: t(lang, 'skills'), icon: '✦' },
  ];

  return (
    <div className="flex h-full gb-dense" onContextMenu={(e) => e.preventDefault()}>
      <aside
        className="w-[240px] shrink-0 border-r flex flex-col"
        style={{ background: 'var(--gb-panel)', borderColor: 'var(--gb-border)' }}
      >
        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--gb-border)' }}>
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm"
              style={{ background: 'var(--gb-accent)' }}
              aria-hidden
            >
              G
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] tracking-tight truncate">Grok Bot Local</div>
              <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--gb-muted)' }}>
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    health?.ollama?.reachable ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {health?.ollama?.reachable ? t(lang, 'online') : t(lang, 'ollamaOffline')}
              </div>
            </div>
          </div>
        </div>

        <nav className="px-1.5 py-1.5 space-y-0.5 border-b" style={{ borderColor: 'var(--gb-border)' }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition ${
                  isActive ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900'
                }`
              }
              style={({ isActive }) => ({ color: isActive ? undefined : 'var(--gb-muted)' })}
            >
              <span className="w-3.5 text-center opacity-70 text-[11px]">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2.5 py-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'agents')}
          </span>
          <button
            onClick={() => navigate('/agents/new')}
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            {t(lang, 'newAgent')}
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
                  isActive ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900'
                }`
              }
            >
              <AgentAvatar agent={a} size={26} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[12px] truncate leading-tight">{a.title}</div>
                <div className="text-[10px] truncate leading-tight" style={{ color: 'var(--gb-muted)' }}>
                  @{a.name}
                </div>
              </div>
            </NavLink>
          ))}

          <div className="pt-3 px-2">
            <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'hiddenChats')}
            </div>
            {hidden.length === 0 ? (
              <div className="text-[11px] italic" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'none')}
              </div>
            ) : (
              <div className="space-y-0.5">
                {hidden.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] opacity-70 hover:opacity-100"
                  >
                    <AgentAvatar agent={a} size={20} />
                    <span className="truncate flex-1">@{a.name}</span>
                    <button
                      className="text-[10px] px-1 rounded bg-zinc-800 hover:bg-zinc-700"
                      onClick={() => void api.hideAgent(a.id, false).then(refresh)}
                    >
                      {t(lang, 'unhide')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {approvals > 0 && (
          <div className="mx-2 mb-1 rounded-md bg-amber-950/60 border border-amber-700/50 px-2 py-1.5 text-[11px] text-amber-200">
            {approvals} pending approval{approvals > 1 ? 's' : ''}
          </div>
        )}

        <div className="border-t p-1.5" style={{ borderColor: 'var(--gb-border)' }}>
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition ${
              location.pathname.startsWith('/settings')
                ? 'bg-zinc-800 text-white'
                : 'hover:bg-zinc-900'
            }`}
            style={{ color: location.pathname.startsWith('/settings') ? undefined : 'var(--gb-muted)' }}
            title="Settings (Ctrl/,)"
          >
            <span className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px]">
              You
            </span>
            <span className="truncate">{t(lang, 'account')}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0" style={{ background: 'var(--gb-bg)' }}>
        <Routes>
          <Route path="/" element={<Home agents={agents} />} />
          <Route path="/chat/:agentId" element={<ChatPage onAgentsChange={refresh} lang={lang} />} />
          <Route path="/agents/new" element={<NewAgentPage onCreated={refresh} />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/channels/:id" element={<ChannelsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route
            path="/settings/*"
            element={
              <SettingsPage
                health={health}
                onSaved={refresh}
                lang={lang}
                onLangChange={(l) => {
                  saveLang(l);
                  setLang(l);
                }}
              />
            }
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
            {t(lang, 'openChat')}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800"
            onClick={() => {
              void api.hideAgent(ctxMenu.agent.id, true).then(refresh);
              setCtxMenu(null);
            }}
          >
            {t(lang, 'hide')}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-red-400"
            onClick={() => {
              setConfirmDelete(ctxMenu.agent);
              setCtxMenu(null);
            }}
          >
            {t(lang, 'delete')}
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
    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--gb-muted)' }}>
      Loading…
    </div>
  );
}
