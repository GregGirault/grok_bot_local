import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { displayName } from '@grok-bot/shared';
import type {
  ActivityMeta,
  Agent,
  AttachmentInfo,
  Channel,
  ChatMessage,
  ComputerState,
  EmailMeta,
  FileCardMeta,
  LinkMeta,
  Notice,
  Routine,
  SecretMeta,
  ToolCardMeta,
  WidgetMeta,
  ApprovalRequest,
} from '@grok-bot/shared';
import { api, streamChat, streamWidgetSelect, streamRegenerate } from '../lib/api';
import { t, type Lang, formatTime } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import DetailsPane from './DetailsPane';
import ProfileEditor from './ProfileEditor';
import { ComputerIcon, BackIcon, MicIcon, CameraIcon, MoreIcon, ShareIcon } from './Icons';

type UiMsg = ChatMessage & { streaming?: boolean; open?: boolean };

export default function ChatView({
  agent,
  agents,
  lang,
  onAgentsChange,
  phone = false,
  onBack,
  onDelete,
}: {
  agent: Agent;
  agents: Agent[];
  lang: Lang;
  onAgentsChange: () => void;
  phone?: boolean;
  onBack?: () => void;
  onDelete?: (agent: Agent) => void;
}) {
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [paneOpen, setPaneOpen] = useState(!phone);
  const [profileOpen, setProfileOpen] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const [comp, setComp] = useState<ComputerState | null>(null);
  const [pending, setPending] = useState<AttachmentInfo[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [skills, setSkills] = useState<Array<{ name: string; description?: string }>>([]);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [hoverAction, setHoverAction] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [plugins, setPlugins] = useState<Array<{ slug: string; name: string; installed: boolean }>>([]);
  const [groups, setGroups] = useState<Channel[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [attachErr, setAttachErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  const first = displayName(agent.name);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [history, ap, sk, c, n, pl, botSk] = await Promise.all([
        api.listMessages(agent.id),
        api.listApprovals(agent.id),
        api.listSkills().catch(() => []),
        api.computer(agent.id).catch(() => null),
        api.listNotices(agent.id).catch(() => [] as Notice[]),
        api.listPlugins().catch(() => []),
        api.agentSkills(agent.id).catch(() => [] as Array<{ name: string; description?: string; enabled: boolean }>),
      ]);
      if (cancelled) return;
      setMsgs(history.filter((m) => m.role !== 'system' || m.kind === 'event' || m.kind === 'system'));
      setApprovals(ap);
      const enabled = (botSk as Array<{ name: string; description?: string; enabled?: boolean }>).filter((s) => s.enabled !== false);
      setSkills(enabled.length ? enabled : sk);
      setComp(c);
      setNotices(n);
      setPlugins(pl.filter((p) => p.installed).map((p) => ({ slug: p.slug, name: p.name, installed: p.installed })));
      void api.listChannels().then(setGroups).catch(() => undefined);
      void api.listRoutines(agent.id).then(setRoutines).catch(() => undefined);
      const draft = localStorage.getItem(`gb-draft-${agent.id}`);
      if (draft) setInput(draft);
      else setInput('');
      setReplyTo(null);
      setPending([]);
      void api.markRead(agent.id);
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    })();
    setPaneOpen(!phone);
    setProfileOpen(false);
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [agent.id, phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  useEffect(() => {
    const tmr = setInterval(() => void api.computer(agent.id).then(setComp), 2500);
    return () => clearInterval(tmr);
  }, [agent.id]);

  const handlersFor = (asstId: string) => ({
    onToken: (c: string) => {
      setMsgs((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: m.content + c } : m)));
    },
    onToolCall: (data: { id: string; name: string; arguments: string }) => {
      setPaneOpen(true);
      setMsgs((prev) => [
        ...prev.filter((m) => m.id !== asstId || m.content),
        {
          id: `tc-${data.id}`,
          agentId: agent.id,
          role: 'tool' as const,
          kind: 'tool_card' as const,
          content: '',
          toolName: data.name,
          meta: { type: 'tool_card' as const, toolName: data.name, arguments: data.arguments, callId: data.id },
          createdAt: new Date().toISOString(),
          open: false,
        },
        { id: asstId, agentId: agent.id, role: 'assistant' as const, content: '', streaming: true, createdAt: new Date().toISOString() },
      ]);
    },
    onToolResult: (data: { id: string; name: string; result: string }) => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === `tc-${data.id}`
            ? { ...m, content: data.result, meta: { ...(m.meta as ToolCardMeta), result: data.result } }
            : m
        )
      );
    },
    onWidget: (data: { widgetId: string; question: string; options: string[] }) => {
      setMsgs((prev) => [
        ...prev,
        {
          id: `w-${data.widgetId}`,
          agentId: agent.id,
          role: 'assistant',
          kind: 'widget',
          content: data.question,
          meta: { type: 'widget', ...data },
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    onTyping: setTyping,
    onApproval: () => {
      void api.listApprovals(agent.id).then(setApprovals);
    },
    onDone: (content: string) => {
      setTyping(false);
      setMsgs((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: m.content || content, streaming: false } : m)));
      void api.listApprovals(agent.id).then(setApprovals);
      onAgentsChange();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification(`${displayName(agent.name)}`, { body: (content || 'Travail terminé').slice(0, 80) });
      }
    },
    onError: (message: string) => {
      setTyping(false);
      setMsgs((prev) =>
        prev.map((m) => (m.id === asstId ? { ...m, content: m.content || `Erreur : ${message}`, streaming: false } : m))
      );
    },
  });

  const addFiles = async (files: File[]) => {
    setAttachErr('');
    const next: AttachmentInfo[] = [...pending];
    for (const f of files) {
      if (next.length >= 6) {
        setAttachErr(t(lang, 'tooManyFiles'));
        break;
      }
      const isVideo = f.type.startsWith('video/');
      const max = isVideo ? 200 * 1024 * 1024 : 25 * 1024 * 1024;
      if (f.size > max) {
        setAttachErr(t(lang, 'fileTooLarge'));
        continue;
      }
      next.push(await api.upload(f, agent.id));
    }
    setPending(next.slice(0, 6));
  };

  const send = async (text?: string) => {
    const body = (text ?? input).trim() || (pending.length ? '(voir pièces jointes)' : '');
    if (!body) return;
    if (busy) {
      abortRef.current?.abort();
    }
    setInput('');
    localStorage.removeItem(`gb-draft-${agent.id}`);
    const files = [...pending];
    const quoted = replyTo;
    setPending([]);
    setReplyTo(null);
    setBusy(true);
    setTyping(true);
    const asstId = `a-${Date.now()}`;
    setMsgs((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        agentId: agent.id,
        role: 'user',
        content: body,
        attachments: files,
        replyToId: quoted?.id,
        createdAt: new Date().toISOString(),
      },
      { id: asstId, agentId: agent.id, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() },
    ]);
    const ac = new AbortController();
    abortRef.current = ac;
    await streamChat(agent.id, body, handlersFor(asstId), ac.signal, files.map((f) => f.id), quoted?.id);
    setBusy(false);
    setTyping(false);
  };

  const onComposerChange = (v: string) => {
    setInput(v);
    localStorage.setItem(`gb-draft-${agent.id}`, v);
    const at = /(^|\s)@(\w*)$/.exec(v);
    const sl = /(^|\s)\/(\w*)$/.exec(v);
    setMentionOpen(Boolean(at));
    setSlashOpen(Boolean(sl));
  };

  const insertAt = (name: string) => {
    setInput((v) => v.replace(/(^|\s)@\w*$/, `$1@${name} `));
    setMentionOpen(false);
  };
  const insertSlash = (name: string) => {
    setInput((v) => v.replace(/(^|\s)\/\w*$/, `$1/${name} `));
    setSlashOpen(false);
  };

  const startDictate = () => {
    const Speech = (window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
      };
    }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => {
      lang: string;
      start: () => void;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    } }).webkitSpeechRecognition;
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? '';
      if (text) onComposerChange(input ? `${input} ${text}` : text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const computerActive = Boolean(comp?.active) || busy || agent.presence === 'working';
  const action = agent.currentAction || (busy ? t(lang, 'working') : '');

  const mentions = useMemo(
    () => agents.filter((a) => a.id !== agent.id && !a.hidden).slice(0, 8),
    [agents, agent.id]
  );

  const openTakeover = () => {
    setTakeover(true);
    void api.takeover(true, agent.id).then(setComp);
  };
  const closeTakeover = () => {
    setTakeover(false);
    void api.takeover(false, agent.id).then(setComp);
  };

  return (
    <div className="h-full flex min-w-0 relative">
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="shrink-0 h-12 px-2 flex items-center justify-between gb-safe-top"
          style={{ background: 'var(--gb-bg)' }}
        >
          <div className="flex items-center gap-0.5 min-w-0">
            {onBack && (
              <button
                type="button"
                className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-zinc-800 shrink-0"
                onClick={onBack}
                aria-label={t(lang, 'back')}
              >
                <BackIcon />
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-2.5 min-w-0 rounded-lg px-1.5 py-1 hover:bg-zinc-800/60 text-left relative"
              onClick={() => setProfileOpen((v) => !v)}
              onMouseEnter={() => setHoverAction(true)}
              onMouseLeave={() => setHoverAction(false)}
            >
              <BotAvatar agent={agent} size={28} presence={busy ? 'working' : agent.presence} />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{first}</div>
                {phone && action ? (
                  <div className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'currentAction')} {action}
                  </div>
                ) : null}
              </div>
              {!phone && hoverAction && action && (
                <div className="absolute left-10 top-9 z-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] shadow-xl whitespace-nowrap">
                  {t(lang, 'currentAction')} {action}
                </div>
              )}
            </button>
          </div>
          <div className="flex items-center gap-0.5 relative">
            <button
              type="button"
              title={t(lang, 'computer')}
              onClick={() => setPaneOpen((v) => !v)}
              className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-zinc-800"
              style={{ color: computerActive ? '#8b5cf6' : 'var(--gb-muted)' }}
            >
              <ComputerIcon active={computerActive} />
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800"
              style={{ color: 'var(--gb-muted)' }}
              onClick={() => {
                void api.shareAgent(agent.id).then((r) => void navigator.clipboard.writeText(`${window.location.origin}${r.url}`));
              }}
              aria-label={t(lang, 'shareBot')}
            >
              <ShareIcon />
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800"
              style={{ color: 'var(--gb-muted)' }}
              onClick={() => setHeaderMenu((v) => !v)}
              aria-label={t(lang, 'editProfile')}
            >
              <MoreIcon />
            </button>
            {headerMenu && (
              <div className="absolute right-0 top-10 z-30 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 text-[13px]">
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-zinc-900" onClick={() => { setHeaderMenu(false); setProfileOpen(true); }}>
                  {t(lang, 'editProfile')}
                </button>
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-zinc-900" onClick={() => { setHeaderMenu(false); setPaneOpen(true); }}>
                  {t(lang, 'conversationDetails')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-zinc-900"
                  onClick={() => {
                    setHeaderMenu(false);
                    void api.pinAgent(agent.id, !agent.pinned).then(onAgentsChange);
                  }}
                >
                  {agent.pinned ? t(lang, 'unpin') : t(lang, 'pin')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-zinc-900"
                  onClick={() => {
                    setHeaderMenu(false);
                    void api.hideAgent(agent.id, true).then(onAgentsChange);
                  }}
                >
                  {t(lang, 'hide')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-zinc-900 text-red-400"
                  onClick={() => {
                    setHeaderMenu(false);
                    onDelete?.(agent);
                  }}
                >
                  {t(lang, 'delete')}
                </button>
              </div>
            )}
          </div>
        </header>

        {profileOpen && (
          <ProfileEditor
            agent={agent}
            lang={lang}
            phone={phone}
            onClose={() => setProfileOpen(false)}
            onUpdated={onAgentsChange}
            onDelete={() => onDelete?.(agent)}
          />
        )}

        {comp?.setupPhase === 'starting' || comp?.setupPhase === 'updating' ? (
          <div className="px-4 py-2 text-[12px] border-b border-zinc-800" style={{ color: 'var(--gb-muted)' }}>
            {comp.setupPhase === 'starting' ? t(lang, 'computerStarting') : t(lang, 'computerUpdating')}
          </div>
        ) : null}
        {notices.length > 0 && (
          <div className="px-4 py-2 border-b border-zinc-800 space-y-1">
            <div className="flex justify-between text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              <span>{t(lang, 'notices')}</span>
              <button type="button" onClick={() => void api.clearNotices().then(() => setNotices([]))}>
                {t(lang, 'clearNotices')}
              </button>
            </div>
            {notices.map((n) => (
