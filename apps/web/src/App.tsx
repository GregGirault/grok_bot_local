import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation, Routes, Route } from 'react-router-dom';
import { displayName } from '@grok-bot/shared';
import type { Agent, Channel, ChannelMessage, HealthStatus, SharePayload, TeamMember } from '@grok-bot/shared';
import { api } from './lib/api';
import { reportClientHost } from './lib/host';
import { initChromePrefs, t, type Lang, formatTime, presenceLabel, applyTheme, applyAccent, saveLang } from './lib/i18n';
import { useIsPhone } from './lib/mobile';
import BotAvatar from './components/BotAvatar';
import ChatView from './components/ChatView';
import SettingsModal from './components/SettingsModal';
import NewChatModal from './components/NewChatModal';
import CommandPalette from './components/CommandPalette';
import Onboarding from './components/Onboarding';
import { HideIcon, PinIcon, PluginsIcon, BackIcon } from './components/Icons';

type RosterItem =
  | { kind: 'bot'; id: string; at: string; pinned: boolean; agent: Agent }
  | { kind: 'group'; id: string; at: string; pinned: boolean; channel: Channel };

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hidden, setHidden] = useState<Agent[]>([]);
  const [groups, setGroups] = useState<Channel[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [account, setAccount] = useState<TeamMember | null>(null);
  const [lang, setLang] = useState<Lang>('fr');
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'plugins' | 'usage' | 'team' | 'beta'>('general');
  const [newOpen, setNewOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number; agent: Agent } | null>(null);
  const [confirm, setConfirm] = useState<Agent | null>(null);
  const [deleteErr, setDeleteErr] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [usage, setUsage] = useState({ messages: 0, tools: 0, weekStart: '' });
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('gb-onboarded') === '1');
  const [shortcuts, setShortcuts] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const phone = useIsPhone();
  const onHome = location.pathname === '/';
  const showRoster = !phone || onHome;
  const showMain = !phone || !onHome;

  const refresh = useCallback(async () => {
    try {
      const [a, h, hid, ch, members, u, net] = await Promise.all([
        api.listAgents(),
        api.health(),
        api.listHiddenAgents().catch(() => [] as Agent[]),
        api.listChannels().catch(() => [] as Channel[]),
        api.listMembers().catch(() => [] as TeamMember[]),
        api.usage().catch(() => ({ messages: 0, tools: 0, weekStart: '' })),
        api.network().catch(() => ({ urls: [] as string[], apiPort: 48732, webPort: 48731 })),
      ]);
      setAgents(a);
      setHealth(h);
      setHidden(hid);
      setGroups(ch);
      setAccount(members[0] ?? null);
      setUsage(u);
      setLanUrls(net.urls);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const prefs = initChromePrefs();
    setLang(prefs.lang);
    void refresh();
    reportClientHost();
    void api.getSettings().then((s) => {
      if (s.theme) applyTheme(s.theme);
      if (s.accentColor) applyAccent(s.accentColor);
      if (s.language) {
        saveLang(s.language);
        setLang(s.language);
      }
    });
    const tmr = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(tmr);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsTab('general');
        setSettingsOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcuts((v) => !v);
      }
      if (e.key === 'Escape') {
        setShortcuts(false);
        setPalette(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const ignoreUntil = Date.now() + 650;
    const close = (e: Event) => {
      if (Date.now() < ignoreUntil) return;
      const node = e.target as HTMLElement | null;
      if (node?.closest?.('[data-ctx-menu]')) return;
      setCtx(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctx]);

  const roster = useMemo(() => {
    const q = query.toLowerCase();
    const bots: RosterItem[] = agents
      .filter((a) => !q || `${displayName(a.name)} ${a.title} ${a.lastPreview}`.toLowerCase().includes(q))
      .map((a) => ({ kind: 'bot' as const, id: a.id, at: a.lastActivityAt, pinned: a.pinned, agent: a }));
    const chans: RosterItem[] = groups
      .filter((g) => !q || `${g.name} ${g.lastPreview}`.toLowerCase().includes(q))
      .map((g) => ({ kind: 'group' as const, id: g.id, at: g.lastActivityAt, pinned: false, channel: g }));
    const mixed = [...bots, ...chans];
    mixed.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
    return mixed;
  }, [agents, groups, query]);

  const openSettings = (tab: typeof settingsTab = 'general') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="flex h-full gb-shell" onContextMenu={(e) => e.preventDefault()}>
      <aside
        className={`${showRoster ? 'flex' : 'hidden'} ${phone ? 'w-full' : 'w-[268px]'} shrink-0 flex-col`}
        style={{ background: 'var(--gb-panel)' }}
      >
        <div className="p-2.5 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (!query && !phone) setPalette(true);
            }}
            placeholder={t(lang, 'search')}
            className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
            style={{ background: 'var(--gb-input)', border: '1px solid var(--gb-border)' }}
          />
          <button
            type="button"
            className="h-8 w-8 rounded-lg text-[16px] leading-none text-white"
            style={{ background: 'var(--gb-accent)' }}
            onClick={() => setNewOpen(true)}
            title={t(lang, 'new')}
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          {roster.map((item) =>
            item.kind === 'bot' ? (
              <BotRow
                key={item.id}
                agent={item.agent}
                lang={lang}
                onContext={(e) => setCtx({ x: e.clientX, y: e.clientY, agent: item.agent })}
                onPin={() => void api.pinAgent(item.agent.id, !item.agent.pinned).then(refresh)}
                onHide={() => void api.hideAgent(item.agent.id, true).then(refresh)}
              />
            ) : (
              <GroupRow key={item.id} channel={item.channel} lang={lang} agents={agents} />
            )
          )}
          <button
            type="button"
            className="mt-3 w-full text-left px-2 text-[11px]"
            style={{ color: 'var(--gb-muted)' }}
            onClick={() => setShowHidden((v) => !v)}
          >
            {showHidden ? t(lang, 'hideHidden') : t(lang, 'showHidden')}
          </button>
          {showHidden &&
            hidden.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1 opacity-70">
                <BotAvatar agent={a} size={20} />
                <span className="flex-1 text-[12px] truncate">{displayName(a.name)}</span>
                <button className="text-[10px]" onClick={() => void api.hideAgent(a.id, false).then(refresh)}>
                  {t(lang, 'unhide')}
                </button>
              </div>
            ))}
        </div>

        <div className="p-2 relative" style={{ borderTop: '1px solid var(--gb-border)' }}>
          <button
            type="button"
            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-900"
            onClick={() => openSettings('plugins')}
          >
            <PluginsIcon />
            <span className="text-[12px]">{t(lang, 'plugins')}</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-900"
            onClick={() => setAccountOpen((v) => !v)}
          >
            <span className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">
              {(account?.name || t(lang, 'you'))[0]}
            </span>
            <span className="text-[12px]">{account?.name || t(lang, 'you')}</span>
          </button>
          {accountOpen && (
            <div className="absolute bottom-16 left-2 right-2 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 z-20">
              <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'weeklyUsageGlance')} · {usage.messages} msg · {usage.tools} outils
              </div>
              {lanUrls[0] && !phone && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-zinc-900"
                  onClick={() => {
                    void navigator.clipboard.writeText(lanUrls[0]);
                    setAccountOpen(false);
                  }}
                >
                  <div>{t(lang, 'openOnPhone')}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>
                    {lanUrls[0]}
                  </div>
                </button>
              )}
              {phone && (
                <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                  {t(lang, 'phoneHint')}
                </div>
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-zinc-900"
                onClick={() => {
                  openSettings('usage');
                  setAccountOpen(false);
                }}
              >
                {t(lang, 'usageBilling')}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-zinc-900"
                onClick={() => {
                  openSettings('general');
                  setAccountOpen(false);
                }}
              >
                {t(lang, 'settings')}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-zinc-900"
                onClick={() => {
                  openSettings('beta');
                  setAccountOpen(false);
                }}
              >
                {t(lang, 'aboutApp')}
              </button>
              <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'version')} {health?.version ?? '0.13.0'}
              </div>
              <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'mobileApps')}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className={`${showMain ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`} style={{ background: 'var(--gb-bg)' }}>
        <Routes>
          <Route path="/" element={<Home agents={agents} phone={phone} />} />
          <Route
            path="/chat/:agentId"
            element={
              <ChatGate
                agents={agents}
                lang={lang}
                onAgentsChange={refresh}
                phone={phone}
                onDelete={(a) => {
                  setDeleteErr('');
                  setConfirm(a);
                }}
              />
            }
          />
          <Route path="/group/:id" element={<GroupView lang={lang} agents={agents} phone={phone} />} />
          <Route path="/add/:token" element={<ImportShare lang={lang} onDone={refresh} />} />
        </Routes>
      </main>

      {settingsOpen && (
        <SettingsModal
          lang={lang}
          health={health}
          initialTab={settingsTab}
          phone={phone}
          account={account}
          usage={usage}
          onClose={() => setSettingsOpen(false)}
          onLang={setLang}
        />
      )}
      {newOpen && (
        <NewChatModal
          lang={lang}
          agents={agents}
          onClose={() => setNewOpen(false)}
          onCreated={(kind, id) => {
            setNewOpen(false);
            void refresh();
            navigate(kind === 'bot' ? `/chat/${id}` : `/group/${id}`);
          }}
        />
      )}
      {!onboarded && (
        <Onboarding
          lang={lang}
          agents={agents}
          onDone={(id) => {
            setOnboarded(true);
            void refresh();
            if (id) navigate(`/chat/${id}`);
          }}
        />
      )}
      {shortcuts && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setShortcuts(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold mb-3">{t(lang, 'keyboardShortcuts')}</h2>
            <ul className="text-[13px] space-y-2">
              <li className="flex justify-between"><span>{t(lang, 'search')}</span><kbd className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800">⌘K</kbd></li>
              <li className="flex justify-between"><span>{t(lang, 'new')}</span><kbd className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800">⌘N</kbd></li>
              <li className="flex justify-between"><span>{t(lang, 'settings')}</span><kbd className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800">⌘,</kbd></li>
              <li className="flex justify-between"><span>{t(lang, 'shortcuts')}</span><kbd className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800">⌘/</kbd></li>
            </ul>
            <button type="button" className="mt-4 text-[12px]" style={{ color: 'var(--gb-muted)' }} onClick={() => setShortcuts(false)}>
              {t(lang, 'close')}
            </button>
          </div>
        </div>
      )}
      {palette && (
        <CommandPalette
          lang={lang}
          agents={agents}
          groups={groups}
          onClose={() => setPalette(false)}
          onBot={(id) => {
            setPalette(false);
            navigate(`/chat/${id}`);
          }}
          onGroup={(id) => {
            setPalette(false);
            navigate(`/group/${id}`);
          }}
          onSettings={() => {
            setPalette(false);
            openSettings('general');
          }}
        />
      )}
      {ctx && (
        <div
          data-ctx-menu
          className={
            phone
              ? 'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-xl py-2 text-[13px] gb-safe-bottom'
              : 'fixed z-50 min-w-[180px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 text-[12px]'
          }
          style={phone ? undefined : { left: Math.min(ctx.x, window.innerWidth - 200), top: Math.min(ctx.y, window.innerHeight - 280) }}
          onClick={(e) => e.stopPropagation()}
        >
          <Item onClick={() => { navigate(`/chat/${ctx.agent.id}`); setCtx(null); }}>{t(lang, 'open')}</Item>
          <Item onClick={() => { navigate(`/chat/${ctx.agent.id}`); setCtx(null); }}>{t(lang, 'editProfile')}</Item>
          <Item onClick={() => { navigate(`/chat/${ctx.agent.id}`); setCtx(null); }}>{t(lang, 'conversationDetails')}</Item>
          <Item onClick={() => { void api.pinAgent(ctx.agent.id, !ctx.agent.pinned).then(refresh); setCtx(null); }}>
            {ctx.agent.pinned ? t(lang, 'unpin') : t(lang, 'pin')}
          </Item>
          <Item onClick={() => { void api.hideAgent(ctx.agent.id, true).then(refresh); setCtx(null); }}>{t(lang, 'hide')}</Item>
          <Item
            onClick={() => {
              if (ctx.agent.unread) void api.markRead(ctx.agent.id).then(refresh);
              else void api.updateAgent(ctx.agent.id, { unread: true }).then(refresh);
              setCtx(null);
            }}
          >
            {ctx.agent.unread ? t(lang, 'markRead') : t(lang, 'markUnread')}
          </Item>
          <Item onClick={() => { void api.shareAgent(ctx.agent.id).then((r) => void navigator.clipboard.writeText(`${window.location.origin}${r.url}`)); setCtx(null); }}>
            {t(lang, 'shareBot')}
          </Item>
          <Item onClick={() => { void api.duplicateAgent(ctx.agent.id).then((c) => { void refresh(); navigate(`/chat/${c.id}`); }); setCtx(null); }}>
            {t(lang, 'duplicate')}
          </Item>
          <Item
            danger
            onClick={() => {
              setDeleteErr('');
              setConfirm(ctx.agent);
              setCtx(null);
            }}
          >
            {t(lang, 'delete')}
          </Item>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !deleting && setConfirm(null)}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] mb-4">{t(lang, 'deleteConfirm')}</p>
            {deleteErr ? <p className="text-[12px] text-red-400 mb-3">{deleteErr}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={deleting}>{t(lang, 'cancel')}</button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-[12px] disabled:opacity-50"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  setDeleteErr('');
                  void api
                    .deleteAgent(confirm.id)
                    .then(() => {
                      setConfirm(null);
                      void refresh();
                      navigate('/');
                    })
                    .catch((e: unknown) => {
                      setDeleteErr(e instanceof Error ? e.message : t(lang, 'deleteFailed'));
                    })
                    .finally(() => setDeleting(false));
                }}
              >
                {t(lang, 'delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotRow({
  agent,
  lang,
  onContext,
  onPin,
  onHide,
}: {
  agent: Agent;
  lang: Lang;
  onContext: (e: MouseEvent) => void;
  onPin: () => void;
  onHide: () => void;
}) {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const active = agentId === agent.id;
  const pressRef = useRef(0);
  const skipClick = useRef(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        if (skipClick.current) {
          e.preventDefault();
          e.stopPropagation();
          skipClick.current = false;
          return;
        }
        navigate(`/chat/${agent.id}`);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext(e);
      }}
      onTouchStart={() => {
        pressRef.current = window.setTimeout(() => {
          skipClick.current = true;
          onContext({ clientX: 16, clientY: 96, preventDefault() {}, stopPropagation() {} } as MouseEvent);
        }, 480);
      }}
      onTouchEnd={() => window.clearTimeout(pressRef.current)}
      onTouchMove={() => window.clearTimeout(pressRef.current)}
      className={`gb-roster-row w-full flex items-start gap-2.5 rounded-xl px-2 py-2.5 text-left ${active ? 'bg-zinc-800/80' : 'hover:bg-zinc-900'}`}
    >
      <div className="relative mt-0.5">
        <BotAvatar agent={agent} size={34} />
        {agent.attention === 'needs_attention' && (
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-violet-400 ring-2 ring-zinc-950" />
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2">
          <span className={`text-[13px] truncate ${agent.unread ? 'font-semibold' : 'font-medium'}`}>
            {displayName(agent.name)}
          </span>
          <span className="text-[11px] shrink-0" style={{ color: 'var(--gb-muted)' }}>
            {formatTime(agent.lastActivityAt, lang)}
          </span>
        </span>
        <span className="block text-[12px] truncate mt-0.5" style={{ color: 'var(--gb-muted)' }}>
          {agent.presence !== 'idle' && agent.presence !== 'done' ? presenceLabel(lang, agent.presence) : agent.title || agent.lastPreview}
        </span>
      </span>
      <span className="gb-row-actions opacity-0 flex flex-col gap-0.5 shrink-0" style={{ color: 'var(--gb-muted)' }}>
        <span
          role="button"
          title={agent.pinned ? t(lang, 'unpin') : t(lang, 'pin')}
          className="p-0.5 hover:text-zinc-200"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
        >
          <PinIcon />
        </span>
        <span
          role="button"
          title={t(lang, 'hide')}
          className="p-0.5 hover:text-zinc-200"
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
        >
          <HideIcon />
        </span>
      </span>
    </button>
  );
}

function GroupRow({ channel, lang, agents }: { channel: Channel; lang: Lang; agents: Agent[] }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const active = id === channel.id;
  const members = channel.memberIds.map((mid) => agents.find((a) => a.id === mid)).filter((a): a is Agent => Boolean(a));
  return (
    <button
      type="button"
      onClick={() => navigate(`/group/${channel.id}`)}
      className={`w-full flex items-start gap-2.5 rounded-xl px-2 py-2 text-left ${active ? 'bg-zinc-800/80' : 'hover:bg-zinc-900'}`}
    >
      <span className="relative h-[34px] w-[42px] shrink-0 mt-0.5">
        {members.slice(0, 3).map((a, i) => (
          <span key={a.id} className="absolute top-0" style={{ left: i * 10 }}>
            <BotAvatar agent={a} size={24} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2">
          <span className="text-[13px] font-medium truncate">{channel.name}</span>
          <span className="text-[11px] shrink-0" style={{ color: 'var(--gb-muted)' }}>
            {formatTime(channel.lastActivityAt, lang)}
          </span>
        </span>
        <span className="block text-[12px] truncate mt-0.5" style={{ color: 'var(--gb-muted)' }}>
          {channel.lastPreview}
        </span>
      </span>
    </button>
  );
}

function Item({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`w-full text-left px-3 py-1.5 hover:bg-zinc-900 ${danger ? 'text-red-400' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Home({ agents, phone }: { agents: Agent[]; phone: boolean }) {
  const navigate = useNavigate();
  const first = agents.find((a) => a.pinned) ?? agents[0];
  useEffect(() => {
    if (!phone && first) navigate(`/chat/${first.id}`, { replace: true });
  }, [first, navigate, phone]);
  if (phone) return null;
  return (
    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--gb-muted)' }}>
      {first ? 'Chargement…' : 'Aucun bot — crée-en un avec +'}
    </div>
  );
}

function ImportShare({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState('');
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    void api.getShare(token).then(setPayload).catch((e: Error) => setErr(e.message));
  }, [token]);
  if (err) return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--gb-muted)' }}>{err}</div>;
  if (!payload) return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--gb-muted)' }}>…</div>;
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center gap-3 mb-3">
          <BotAvatar
            agent={{
              name: payload.name,
              title: payload.title,
              avatarColor: payload.avatarColor,
              avatarShape: payload.avatarShape,
              accessory: payload.accessory,
            }}
            size={48}
          />
          <div>
            <div className="text-[16px] font-semibold">{displayName(payload.name)}</div>
            <div className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>{payload.title}</div>
          </div>
        </div>
        <p className="text-[13px] mb-3">{payload.description}</p>
        {payload.routines.length > 0 && (
          <ul className="text-[12px] mb-3" style={{ color: 'var(--gb-muted)' }}>
            {payload.routines.map((r) => (
              <li key={r.name}>{r.name}</li>
            ))}
          </ul>
        )}
        <p className="text-[11px] mb-3" style={{ color: 'var(--gb-muted)' }}>{t(lang, 'sharePreviewHint')}</p>
        <p className="text-[11px] mb-4" style={{ color: 'var(--gb-muted)' }}>{t(lang, 'shareWarning')}</p>
        <button
          type="button"
          disabled={busy}
          className="w-full py-2 rounded-lg text-white text-[13px]"
          style={{ background: 'var(--gb-accent)' }}
          onClick={() => {
            if (!token) return;
            setBusy(true);
            void api.importShare(token).then((a) => {
              onDone();
              navigate(`/chat/${a.id}`);
            }).catch((e: Error) => setErr(e.message));
          }}
        >
          {t(lang, 'addToGrokBot')}
        </button>
      </div>
    </div>
  );
}

function ChatGate({
  agents,
  lang,
  onAgentsChange,
  phone,
  onDelete,
}: {
  agents: Agent[];
  lang: Lang;
  onAgentsChange: () => void;
  phone: boolean;
  onDelete: (agent: Agent) => void;
}) {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const agent = agents.find((a) => a.id === agentId) ?? null;
  if (!agent) return <div className="h-full flex items-center justify-center" style={{ color: 'var(--gb-muted)' }}>Choisis un bot</div>;
  return (
    <ChatView
      agent={agent}
      agents={agents}
      lang={lang}
      onAgentsChange={onAgentsChange}
      phone={phone}
      onBack={phone ? () => navigate('/') : undefined}
      onDelete={onDelete}
    />
  );
}

function GroupView({ lang, agents, phone }: { lang: Lang; agents: Agent[]; phone: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ch, setCh] = useState<Channel | null>(null);
  const [msgs, setMsgs] = useState<ChannelMessage[]>([]);
  const [input, setInput] = useState('');
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  useEffect(() => {
    if (!id) return;
    void api.listChannels().then((list) => {
      const found = list.find((c) => c.id === id) ?? null;
      setCh(found);
      if (found) {
        setName(found.name);
        setPicked(found.memberIds);
      }
    });
    void api.listChannelMessages(id).then(setMsgs);
    const tmr = setInterval(() => void api.listChannelMessages(id).then(setMsgs), 4000);
    return () => clearInterval(tmr);
  }, [id]);
  if (!ch) return null;
  const members = ch.memberIds.map((mid) => agents.find((a) => a.id === mid)).filter((a): a is Agent => Boolean(a));
  const at = /(^|\s)@(\w*)$/.exec(input);
  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-3 flex items-center justify-between gb-safe-top" style={{ background: 'var(--gb-bg)' }}>
        <div className="flex items-center gap-1 min-w-0">
          {phone && (
            <button type="button" className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-zinc-800" onClick={() => navigate('/')} aria-label={t(lang, 'back')}>
              <BackIcon />
            </button>
          )}
          <button type="button" className="text-left min-w-0" onClick={() => setEdit(true)}>
            <div className="text-[14px] font-semibold truncate">{ch.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              {ch.memberIds.length} {t(lang, 'groupMembers')} · {t(lang, 'editGroup')}
            </div>
          </button>
        </div>
        <span className="flex -space-x-2">
          {members.slice(0, 6).map((a) => (
            <BotAvatar key={a.id} agent={a} size={22} />
          ))}
        </span>
      </header>
      {edit && (
        <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
          <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {agents.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`text-[11px] px-2 py-1 rounded-lg ${on ? 'bg-zinc-800' : 'bg-zinc-950 border border-zinc-800'}`}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : p.length >= 6 ? p : [...p, a.id]))}
                >
                  {displayName(a.name)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" className="text-[12px]" onClick={() => setEdit(false)}>{t(lang, 'cancel')}</button>
            <button
              type="button"
              className="text-[12px] px-2 py-1 rounded-lg text-white"
              style={{ background: 'var(--gb-accent)' }}
              disabled={picked.length < 2}
              onClick={() => {
                if (!id) return;
                void api.updateChannel(id, { name, memberIds: picked }).then((next) => {
                  setCh(next);
                  setEdit(false);
                });
              }}
            >
              {t(lang, 'save')}
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-[640px] mx-auto space-y-4">
          {msgs.length === 0 && (
            <p className="text-[13px] text-center" style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'groupEveryoneHint')}
            </p>
          )}
          {msgs.map((m) => {
            const from = agents.find((a) => a.id === m.fromAgentId);
            return (
              <div key={m.id} className="flex gap-2">
                {from ? <BotAvatar agent={from} size={24} /> : <span className="h-6 w-6 rounded-full bg-zinc-800" />}
                <div>
                  <div className="text-[11px] font-medium">{from ? displayName(from.name) : t(lang, 'you')}</div>
                  <div className="text-[14px] leading-relaxed">{m.content}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <form
        className="px-4 pb-4 relative gb-safe-bottom"
        onSubmit={(e) => {
          e.preventDefault();
          if (!id || !input.trim()) return;
          void api.postChannelMessage(id, { content: input.trim() }).then(() => {
            void api.listChannelMessages(id).then(setMsgs);
            setInput('');
          });
        }}
      >
        {mentionOpen && at && (
          <div className="absolute bottom-full left-8 mb-1 w-64 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl py-1 z-20">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[12px]"
              onClick={() => {
                setInput((v) => v.replace(/(^|\s)@\w*$/, `$1@everyone `));
                setMentionOpen(false);
              }}
            >
              @everyone · {t(lang, 'everyone')}
            </button>
            {members.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
                onClick={() => {
                  setInput((v) => v.replace(/(^|\s)@\w*$/, `$1@${a.name} `));
                  setMentionOpen(false);
                }}
              >
                <BotAvatar agent={a} size={18} />
                <span className="text-[12px]">{displayName(a.name)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="max-w-[640px] mx-auto">
          <input
            className="w-full rounded-2xl px-4 py-2.5 text-[13px] outline-none"
            style={{ background: 'var(--gb-input)', border: '1px solid var(--gb-border)' }}
            placeholder={`${t(lang, 'messagePlaceholder')} ${ch.name}`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setMentionOpen(Boolean(/(^|\s)@(\w*)$/.exec(e.target.value)));
            }}
          />
        </div>
      </form>
    </div>
  );
}
