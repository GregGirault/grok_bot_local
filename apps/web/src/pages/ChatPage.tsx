import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  Agent,
  ChatMessage,
  InboxMessage,
  MemoryEntry,
  ToolCardMeta,
  WidgetMeta,
  ApprovalRequest,
  ApprovalMeta,
  AttachmentInfo,
} from '@grok-bot/shared';
import { api, streamChat, streamWidgetSelect, streamRegenerate } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import AgentAvatar from '../components/AgentAvatar';
import AgentInfoPane from '../components/AgentInfoPane';

type UiMsg = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  kind?: string;
  meta?: WidgetMeta | ToolCardMeta | ApprovalMeta | Record<string, unknown>;
  toolName?: string;
  streaming?: boolean;
  open?: boolean;
  attachments?: AttachmentInfo[];
};

export default function ChatPage({
  onAgentsChange,
  lang = 'en',
}: {
  onAgentsChange?: () => void;
  lang?: Lang;
}) {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<AttachmentInfo[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listAgents(true);
        const a = list.find((x) => x.id === agentId) ?? null;
        if (cancelled) return;
        setAgents(list.filter((x) => !x.hidden));
        setAgent(a);
        const [history, mem, box, ap] = await Promise.all([
          api.listMessages(agentId),
          api.listMemory(agentId),
          api.listInbox(agentId),
          api.listApprovals(agentId),
        ]);
        if (cancelled) return;
        setMsgs(history.filter((m) => m.role !== 'system' || m.kind === 'system').map(toUi));
        setMemory(mem);
        setInbox(box);
        setApprovals(ap);
        setSendTo(list.find((x) => x.id !== agentId && !x.hidden)?.id ?? '');
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy, typing]);

  const handlersFor = (asstId: string) => ({
    onToken: (c: string) => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === asstId ? { ...m, content: m.content + c } : m))
      );
    },
    onToolCall: (data: { id: string; name: string; arguments: string }) => {
      setMsgs((prev) => [
        ...prev.filter((m) => m.id !== asstId || m.content),
        {
          id: `tc-${data.id}`,
          role: 'tool' as const,
          kind: 'tool_card',
          content: '',
          toolName: data.name,
          meta: {
            type: 'tool_card' as const,
            toolName: data.name,
            arguments: data.arguments,
            callId: data.id,
          },
          open: false,
        },
        { id: asstId, role: 'assistant' as const, content: '', streaming: true },
      ]);
    },
    onToolResult: (data: { id: string; name: string; result: string }) => {
      setMsgs((prev) =>
        prev.map((m) => {
          if (m.id !== `tc-${data.id}`) return m;
          const meta = {
            ...(m.meta as ToolCardMeta),
            type: 'tool_card' as const,
            toolName: data.name,
            result: data.result,
            callId: data.id,
          };
          return { ...m, meta, content: data.result };
        })
      );
    },
    onWidget: (data: { widgetId: string; question: string; options: string[] }) => {
      setMsgs((prev) => [
        ...prev,
        {
          id: `w-${data.widgetId}`,
          role: 'assistant',
          kind: 'widget',
          content: data.question,
          meta: {
            type: 'widget',
            widgetId: data.widgetId,
            question: data.question,
            options: data.options,
          },
        },
      ]);
    },
    onTyping: (active: boolean) => setTyping(active),
    onApproval: () => {
      if (agentId) void api.listApprovals(agentId).then(setApprovals);
    },
    onDone: (content: string) => {
      setTyping(false);
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === asstId ? { ...m, content: m.content || content, streaming: false } : m
        )
      );
      if (agentId) void api.listApprovals(agentId).then(setApprovals);
    },
    onError: (message: string) => {
      setTyping(false);
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: m.content || `Error: ${message}`, streaming: false }
            : m
        )
      );
    },
    onMemory: (entries: MemoryEntry[]) => setMemory(entries),
  });

  const send = async () => {
    if (!agentId || (!input.trim() && !pendingFiles.length) || busy) return;
    const text = input.trim() || '(see attachments)';
    setInput('');
    const files = [...pendingFiles];
    setPendingFiles([]);
    setBusy(true);
    setTyping(true);
    const userMsg: UiMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachments: files,
    };
    const asstId = `a-${Date.now()}`;
    setMsgs((prev) => [
      ...prev,
      userMsg,
      { id: asstId, role: 'assistant', content: '', streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    await streamChat(
      agentId,
      text,
      handlersFor(asstId),
      undefined,
      ac.signal,
      files.map((f) => f.id)
    );
    setBusy(false);
    setTyping(false);
    abortRef.current = null;
  };

  const onWidgetSelect = async (widgetId: string, selection: string) => {
    if (!agentId || busy) return;
    setBusy(true);
    setTyping(true);
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.kind === 'widget' && (m.meta as WidgetMeta)?.widgetId === widgetId) {
          return { ...m, meta: { ...(m.meta as WidgetMeta), selected: selection } };
        }
        return m;
      })
    );
    const asstId = `a-${Date.now()}`;
    setMsgs((prev) => [
      ...prev,
      { id: `u-w-${Date.now()}`, role: 'user', content: selection },
      { id: asstId, role: 'assistant', content: '', streaming: true },
    ]);
    const ac = new AbortController();
    abortRef.current = ac;
    await streamWidgetSelect(agentId, widgetId, selection, handlersFor(asstId), ac.signal);
    setBusy(false);
    setTyping(false);
    abortRef.current = null;
  };

  const clearChat = async () => {
    if (!agentId) return;
    await api.clearMessages(agentId);
    setMsgs([]);
  };

  const hideChat = async () => {
    if (!agentId) return;
    await api.hideAgent(agentId, true);
    onAgentsChange?.();
  };

  const onAttach = async (files: FileList | null) => {
    if (!files?.length || !agentId) return;
    const uploaded: AttachmentInfo[] = [];
    for (const f of Array.from(files)) {
      const att = await api.upload(f, agentId);
      uploaded.push(att);
    }
    setPendingFiles((p) => [...p, ...uploaded]);
  };

  const regenerate = async (messageId: string) => {
    if (!agentId || busy) return;
    setBusy(true);
    setTyping(true);
    const asstId = `a-${Date.now()}`;
    // Trim UI to before this message
    setMsgs((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      const base = idx >= 0 ? prev.slice(0, idx) : prev;
      return [...base, { id: asstId, role: 'assistant', content: '', streaming: true }];
    });
    const ac = new AbortController();
    abortRef.current = ac;
    await streamRegenerate(agentId, messageId, handlersFor(asstId), ac.signal);
    setBusy(false);
    setTyping(false);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await api.editMessage(editingId, editText.trim());
    setMsgs((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, content: editText.trim() } : m))
    );
    setEditingId(null);
  };

  const sendAgentMsg = async () => {
    if (!agentId || !sendTo || !sendBody.trim()) return;
    await api.sendInbox(agentId, { toAgentId: sendTo, message: sendBody.trim() });
    setSendBody('');
    setInbox(await api.listInbox(agentId));
  };

  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--gb-muted)' }}>
        Select an agent
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="shrink-0 border-b px-4 py-2.5 flex items-center justify-between backdrop-blur"
          style={{ borderColor: 'var(--gb-border)', background: 'color-mix(in srgb, var(--gb-panel) 80%, transparent)' }}
        >
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="flex items-center gap-2.5 min-w-0 rounded-lg hover:bg-zinc-900/80 px-1.5 py-1 -ml-1.5 text-left transition"
            title="Agent details"
          >
            <AgentAvatar agent={agent} size={32} />
            <div className="min-w-0">
              <h1 className="font-semibold text-[13px] truncate">{agent.title}</h1>
              <p className="text-[11px] truncate max-w-xl" style={{ color: 'var(--gb-muted)' }}>
                {agent.description}
                {typing || busy ? (
                  <span className="ml-2 text-violet-400">· {t(lang, 'typing')}…</span>
                ) : null}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInbox((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
            >
              {t(lang, 'inbox')} ({inbox.filter((i) => !i.read).length})
            </button>
            <span className="text-xs" style={{ color: 'var(--gb-muted)' }}>
              Mem {memory.length}
            </span>
            <button
              onClick={() => void hideChat()}
              className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
            >
              {t(lang, 'hide')}
            </button>
            <button
              onClick={() => void clearChat()}
              className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
            >
              {t(lang, 'clear')}
            </button>
          </div>
        </header>

        {approvals.length > 0 && (
          <div className="border-b border-amber-800/50 bg-amber-950/40 px-4 py-2 space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-amber-100">
                <span className="flex-1 font-mono truncate">
                  Approve {a.toolName}: {a.command}
                </span>
                <button
                  className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
                  onClick={() =>
                    void api.resolveApproval(a.id, 'approved').then(() =>
                      api.listApprovals(agentId!).then(setApprovals)
                    )
                  }
                >
                  Approve
                </button>
                <button
                  className="px-2 py-1 rounded bg-red-800 hover:bg-red-700"
                  onClick={() =>
                    void api.resolveApproval(a.id, 'denied').then(() =>
                      api.listApprovals(agentId!).then(setApprovals)
                    )
                  }
                >
                  Deny
                </button>
              </div>
            ))}
          </div>
        )}

        {showInbox && (
          <div className="border-b px-5 py-3 text-sm space-y-3" style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}>
            <div className="font-medium">Agent inbox</div>
            {inbox.length === 0 ? (
              <div className="text-xs" style={{ color: 'var(--gb-muted)' }}>No messages.</div>
            ) : (
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {inbox.map((m) => (
                  <li key={m.id} className="text-xs font-mono">
                    <span className="text-cyan-400">@{m.fromAgentName || m.fromAgentId}</span>:{' '}
                    {m.content}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 items-center">
              <select
                className="rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
              >
                {agents
                  .filter((a) => a.id !== agentId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.name}
                    </option>
                  ))}
              </select>
              <input
                className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs"
                placeholder="Message another agent…"
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
              />
              <button
                onClick={() => void sendAgentMsg()}
                className="text-xs px-2 py-1 rounded text-white"
                style={{ background: 'var(--gb-accent)' }}
              >
                Send
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          {msgs.length === 0 && (
            <div className="text-center mt-20" style={{ color: 'var(--gb-muted)' }}>
              <div className="flex justify-center mb-3">
                <AgentAvatar agent={agent} size={56} />
              </div>
              <p>
                Chat with <strong>{agent.title}</strong>
              </p>
              <p className="text-sm mt-1">Tools, memory, widgets & skills are ready.</p>
            </div>
          )}
          {msgs.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              busy={busy}
              editingId={editingId}
              editText={editText}
              onEditStart={(id, content) => {
                setEditingId(id);
                setEditText(content);
              }}
              onEditChange={setEditText}
              onEditSave={() => void saveEdit()}
              onEditCancel={() => setEditingId(null)}
              onRegenerate={(id) => void regenerate(id)}
              onSelect={(wid, sel) => void onWidgetSelect(wid, sel)}
              onToggle={(id) =>
                setMsgs((prev) =>
                  prev.map((x) => (x.id === id ? { ...x, open: !x.open } : x))
                )
              }
            />
          ))}
          {(busy || typing) && (
            <div className="flex gap-1.5 px-1 max-w-3xl mx-auto items-center">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
              <span className="text-[10px] ml-2" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'typing')}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="shrink-0 border-t p-4"
          style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {pendingFiles.length > 0 && (
            <div className="max-w-4xl mx-auto mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((f) => (
                <span
                  key={f.id}
                  className="text-[11px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
                >
                  📎 {f.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => void onAttach(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="self-end px-3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm"
              title="Attach"
            >
              📎
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Message… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'var(--gb-input)',
                borderColor: 'var(--gb-border)',
                // @ts-expect-error css var
                '--tw-ring-color': 'var(--gb-accent)',
              }}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || (!input.trim() && !pendingFiles.length)}
              className="self-end px-5 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm text-white"
              style={{ background: 'var(--gb-accent)' }}
            >
              {t(lang, 'send')}
            </button>
          </div>
        </form>
      </div>
      {showInfo && (
        <AgentInfoPane
          agent={agent}
          onClose={() => setShowInfo(false)}
          onUpdated={() => {
            void api.listAgents(true).then((list) => {
              const a = list.find((x) => x.id === agentId);
              if (a) setAgent(a);
              setAgents(list.filter((x) => !x.hidden));
            });
            onAgentsChange?.();
          }}
        />
      )}
    </div>
  );
}

function toUi(m: ChatMessage): UiMsg {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    kind: m.kind,
    meta: m.meta,
    toolName: m.toolName,
    attachments: m.attachments,
    open: false,
  };
}

function MessageBubble({
  msg,
  busy,
  editingId,
  editText,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRegenerate,
  onSelect,
  onToggle,
}: {
  msg: UiMsg;
  busy: boolean;
  editingId: string | null;
  editText: string;
  onEditStart: (id: string, content: string) => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRegenerate: (id: string) => void;
  onSelect: (widgetId: string, selection: string) => void;
  onToggle: (id: string) => void;
}) {
  if (msg.kind === 'widget' && msg.meta && (msg.meta as WidgetMeta).type === 'widget') {
    const w = msg.meta as WidgetMeta;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-violet-700/50 bg-violet-950/40 px-4 py-3">
          <div className="text-sm font-medium text-violet-100 mb-3 whitespace-pre-wrap">
            {w.question}
          </div>
          <div className="flex flex-wrap gap-2">
            {w.options.map((opt) => {
              const selected = w.selected === opt;
              return (
                <button
                  key={opt}
                  disabled={busy || Boolean(w.selected)}
                  onClick={() => onSelect(w.widgetId, opt)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                    selected
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 hover:border-violet-500 text-zinc-200 disabled:opacity-50'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (msg.role === 'tool' || msg.kind === 'tool_card') {
    const meta = msg.meta as ToolCardMeta | undefined;
    const name = meta?.toolName || msg.toolName || 'tool';
    const result = meta?.result || msg.content;
    return (
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => onToggle(msg.id)}
          className="w-full text-left rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 hover:bg-amber-950/50 transition"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-amber-200/90">
              🔧 {name}
              {meta?.arguments ? `(${truncate(meta.arguments, 60)})` : ''}
            </span>
            <span className="text-[10px] text-zinc-500">{msg.open ? '▼' : '▶'}</span>
          </div>
          {msg.open && result && (
            <pre className="mt-2 text-xs font-mono text-amber-100/70 whitespace-pre-wrap overflow-x-auto max-h-48">
              {truncate(result, 4000)}
            </pre>
          )}
          {!msg.open && result && (
            <div className="mt-1 text-[11px] text-zinc-500 truncate">{truncate(result, 100)}</div>
          )}
        </button>
      </div>
    );
  }

  if (msg.role === 'system') {
    return (
      <div className="max-w-3xl mx-auto text-center text-xs italic px-4" style={{ color: 'var(--gb-muted)' }}>
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  const isEditing = editingId === msg.id;

  return (
    <div className={`max-w-3xl mx-auto flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="group relative max-w-full">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'text-white rounded-br-md'
              : 'rounded-bl-md border border-zinc-700/50'
          }`}
          style={{
            background: isUser ? 'var(--gb-accent)' : 'var(--gb-card)',
          }}
        >
          {isEditing ? (
            <div className="space-y-2 min-w-[240px]">
              <textarea
                className="w-full rounded bg-black/20 border border-white/20 px-2 py-1 text-sm"
                rows={3}
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 rounded bg-white/20"
                  onClick={onEditSave}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 rounded bg-white/10"
                  onClick={onEditCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content || (msg.streaming ? '…' : '')}
              </ReactMarkdown>
            </div>
          )}
          {msg.attachments?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {msg.attachments.map((a) => (
                <span key={a.id} className="text-[10px] opacity-80">
                  📎 {a.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {!isEditing && !msg.streaming && (
          <div
            className={`absolute -bottom-5 ${isUser ? 'right-0' : 'left-0'} hidden group-hover:flex gap-1`}
          >
            {isUser && !msg.id.startsWith('u-') && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
                onClick={() => onEditStart(msg.id, msg.content)}
              >
                Edit
              </button>
            )}
            {!isUser && !msg.id.startsWith('a-') && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
                onClick={() => onRegenerate(msg.id)}
                disabled={busy}
              >
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}
