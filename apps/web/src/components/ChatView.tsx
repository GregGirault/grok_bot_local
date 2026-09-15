import { useEffect, useMemo, useRef, useState } from 'react';
import { displayName } from '@grok-bot/shared';
import type {
  Agent,
  AttachmentInfo,
  Channel,
  ChatMessage,
  ComputerState,
  Notice,
  Routine,
  ToolCardMeta,
  WidgetMeta,
  ApprovalRequest,
} from '@grok-bot/shared';
import { api, streamChat, streamWidgetSelect, streamRegenerate } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import DetailsPane from './DetailsPane';
import ProfileEditor from './ProfileEditor';
import { ChatHeader } from './ChatHeader';
import { ChatComposer } from './ChatComposer';
import { TakeoverOverlay, Transcript, type UiMsg } from './ChatViewChrome';

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
        <ChatHeader
          agent={agent}
          lang={lang}
          phone={Boolean(phone)}
          first={first}
          action={action}
          busy={busy}
          computerActive={computerActive}
          headerMenu={headerMenu}
          hoverAction={hoverAction}
          onBack={onBack}
          onDelete={onDelete}
          onAgentsChange={onAgentsChange}
          setProfileOpen={setProfileOpen}
          setPaneOpen={setPaneOpen}
          setHeaderMenu={setHeaderMenu}
          setHoverAction={setHoverAction}
        />

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
              <div key={n.id} className="flex items-start gap-2 text-[12px]">
                <span className="flex-1">
                  <span className="font-medium">{n.title}</span> — {n.body}
                  {n.requestId && (
                    <button
                      type="button"
                      className="ml-2 text-[10px] underline"
                      onClick={() => void navigator.clipboard.writeText(n.requestId || '')}
                    >
                      {t(lang, 'copyRequestId')}
                    </button>
                  )}
                </span>
                <button type="button" className="text-[11px]" onClick={() => void api.dismissNotice(n.id).then(() => api.listNotices(agent.id).then(setNotices))}>
                  {t(lang, 'dismiss')}
                </button>
              </div>
            ))}
          </div>
        )}
        {approvals.length > 0 && (
          <div className="px-4 py-2 border-b border-amber-800/40 bg-amber-950/30 space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-amber-100">
                <span className="flex-1 font-mono truncate">{a.toolName} {a.command}</span>
                <button
                  className="px-2 py-1 rounded bg-emerald-700"
                  onClick={() => void api.resolveApproval(a.id, 'approved').then(() => api.listApprovals(agent.id).then(setApprovals))}
                >
                  {phone ? t(lang, 'approveOnce') : t(lang, 'approve')}
                </button>
                <button
                  className="px-2 py-1 rounded bg-violet-700"
                  onClick={() => void api.resolveApproval(a.id, 'always').then(() => api.listApprovals(agent.id).then(setApprovals))}
                >
                  {t(lang, 'alwaysAllowAction')}
                </button>
                <button
                  className="px-2 py-1 rounded bg-red-800"
                  onClick={() => void api.resolveApproval(a.id, 'denied').then(() => api.listApprovals(agent.id).then(setApprovals))}
                >
                  {t(lang, 'deny')}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[640px] mx-auto space-y-5">
            {msgs.length === 0 && (
              <div className="text-center mt-20" style={{ color: 'var(--gb-muted)' }}>
                <div className="flex justify-center mb-3">
                  <BotAvatar agent={agent} size={72} />
                </div>
                <p className="font-medium text-[16px] text-zinc-200">{first}</p>
                <p className="text-[13px] mt-1">{agent.title}</p>
                {agent.model ? (
                  <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--gb-muted)' }}>
                    {agent.modelProvider === 'huggingface' && agent.hfModel ? agent.hfModel : agent.model}
                  </p>
                ) : null}
                <p className="text-[13px] mt-3 max-w-md mx-auto">{t(lang, 'emptyChat')}</p>
              </div>
            )}
            <Transcript
              msgs={msgs}
              lang={lang}
              busy={busy}
              onSelect={(wid, sel) => {
                void (async () => {
                  setBusy(true);
                  const asstId = `a-${Date.now()}`;
                  setMsgs((prev) => [
                    ...prev.map((x) =>
                      x.kind === 'widget' && (x.meta as WidgetMeta)?.widgetId === wid
                        ? { ...x, meta: { ...(x.meta as WidgetMeta), selected: sel } }
                        : x
                    ),
                    { id: `u-${Date.now()}`, agentId: agent.id, role: 'user', content: sel, createdAt: new Date().toISOString() },
                    { id: asstId, agentId: agent.id, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() },
                  ]);
                  const ac = new AbortController();
                  abortRef.current = ac;
                  await streamWidgetSelect(agent.id, wid, sel, handlersFor(asstId), ac.signal);
                  setBusy(false);
                })();
              }}
              onToggle={(id) => setMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, open: !x.open } : x)))}
              onReact={(id, emoji) => void api.react(id, emoji).then((nm) => setMsgs((prev) => prev.map((x) => (x.id === id ? nm : x))))}
              onRegenerate={(id) => {
                void (async () => {
                  setBusy(true);
                  const asstId = `a-${Date.now()}`;
                  setMsgs((prev) => {
                    const idx = prev.findIndex((x) => x.id === id);
                    const base = idx >= 0 ? prev.slice(0, idx) : prev;
                    return [...base, { id: asstId, agentId: agent.id, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() }];
                  });
                  const ac = new AbortController();
                  abortRef.current = ac;
                  await streamRegenerate(agent.id, id, handlersFor(asstId), ac.signal);
                  setBusy(false);
                })();
              }}
              onReply={(m) => setReplyTo(m)}
            />
            {(busy || typing) && (
              <div className="flex gap-1.5 items-center px-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <ChatComposer
          lang={lang}
          phone={Boolean(phone)}
          first={first}
          input={input}
          busy={busy}
          listening={listening}
          mentionOpen={mentionOpen}
          slashOpen={slashOpen}
          mentions={mentions}
          groups={groups}
          routines={routines}
          plugins={plugins}
          skills={skills}
          replyTo={replyTo}
          attachErr={attachErr}
          pending={pending}
          dropOver={dropOver}
          fileRef={fileRef}
          cameraRef={cameraRef}
          insertAt={insertAt}
          insertSlash={insertSlash}
          setReplyTo={setReplyTo}
          setDropOver={setDropOver}
          addFiles={addFiles}
          onComposerChange={onComposerChange}
          send={send}
          startDictate={startDictate}
          abortRef={abortRef}
          setBusy={setBusy}
          setTyping={setTyping}
        />
      </div>
      {paneOpen && (
        phone ? (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPaneOpen(false)}>
            <div className="absolute inset-x-0 bottom-0 top-10 rounded-t-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <DetailsPane agent={agent} lang={lang} onClose={() => setPaneOpen(false)} onTakeover={openTakeover} full />
            </div>
          </div>
        ) : (
          <DetailsPane agent={agent} lang={lang} onClose={() => setPaneOpen(false)} onTakeover={openTakeover} />
        )
      )}
      {takeover && (
        <TakeoverOverlay agent={agent} lang={lang} comp={comp} onHandBack={closeTakeover} />
      )}
    </div>
  );
}
