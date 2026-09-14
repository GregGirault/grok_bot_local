import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  Agent,
  ChatMessage,
  InboxMessage,
  MemoryEntry,
  ToolCardMeta,
  WidgetMeta,
} from '@grok-bot/shared';
import { api, streamChat, streamWidgetSelect } from '../lib/api';
import AgentAvatar from '../components/AgentAvatar';

type UiMsg = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  kind?: string;
  meta?: WidgetMeta | ToolCardMeta | Record<string, unknown>;
  toolName?: string;
  streaming?: boolean;
  open?: boolean;
};

export default function ChatPage(_props: { onAgentsChange?: () => void }) {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendBody, setSendBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listAgents();
        const a = list.find((x) => x.id === agentId) ?? null;
        if (cancelled) return;
        setAgents(list);
        setAgent(a);
        const [history, mem, box] = await Promise.all([
          api.listMessages(agentId),
          api.listMemory(agentId),
          api.listInbox(agentId),
        ]);
        if (cancelled) return;
        setMsgs(
          history
            .filter((m) => m.role !== 'system' || m.kind === 'system')
            .map(toUi)
        );
        setMemory(mem);
        setInbox(box);
        setSendTo(list.find((x) => x.id !== agentId)?.id ?? '');
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
  }, [msgs, busy]);

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
    onDone: (content: string) => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: m.content || content, streaming: false }
            : m
        )
      );
    },
    onError: (message: string) => {
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
    if (!agentId || !input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    const userMsg: UiMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    const asstId = `a-${Date.now()}`;
    setMsgs((prev) => [
      ...prev,
      userMsg,
      { id: asstId, role: 'assistant', content: '', streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    await streamChat(agentId, text, handlersFor(asstId), undefined, ac.signal);
    setBusy(false);
    abortRef.current = null;
  };

  const onWidgetSelect = async (widgetId: string, selection: string) => {
    if (!agentId || busy) return;
    setBusy(true);
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.kind === 'widget' && (m.meta as WidgetMeta)?.widgetId === widgetId) {
          return {
            ...m,
            meta: { ...(m.meta as WidgetMeta), selected: selection },
          };
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
    abortRef.current = null;
  };

  const clearChat = async () => {
    if (!agentId) return;
    await api.clearMessages(agentId);
    setMsgs([]);
  };

  const sendAgentMsg = async () => {
    if (!agentId || !sendTo || !sendBody.trim()) return;
    await api.sendInbox(agentId, { toAgentId: sendTo, message: sendBody.trim() });
    setSendBody('');
    setInbox(await api.listInbox(agentId));
  };

  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        Select an agent
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center justify-between bg-zinc-950/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <AgentAvatar agent={agent} size={36} />
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{agent.title}</h1>
            <p className="text-xs text-zinc-500 truncate max-w-xl">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInbox((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
          >
            Inbox ({inbox.filter((i) => !i.read).length})
          </button>
          <span className="text-xs text-zinc-500">Mem {memory.length}</span>
          <button
            onClick={() => void clearChat()}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
          >
            Clear
          </button>
        </div>
      </header>

      {showInbox && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-5 py-3 text-sm space-y-3">
          <div className="font-medium text-zinc-300">Agent inbox</div>
          {inbox.length === 0 ? (
            <div className="text-zinc-500 text-xs">No messages.</div>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {inbox.map((m) => (
                <li key={m.id} className="text-xs font-mono text-zinc-300">
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
              className="text-xs px-2 py-1 rounded bg-violet-700 hover:bg-violet-600"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center text-zinc-500 mt-20">
            <div className="flex justify-center mb-3">
              <AgentAvatar agent={agent} size={56} />
            </div>
            <p>
              Chat with <strong className="text-zinc-300">{agent.title}</strong>
            </p>
            <p className="text-sm mt-1">Tools, memory, widgets & skills are ready.</p>
          </div>
        )}
        {msgs.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            busy={busy}
            onSelect={(wid, sel) => void onWidgetSelect(wid, sel)}
            onToggle={(id) =>
              setMsgs((prev) =>
                prev.map((x) => (x.id === id ? { ...x, open: !x.open } : x))
              )
            }
          />
        ))}
        {busy && (
          <div className="flex gap-1.5 px-1 max-w-3xl mx-auto">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 border-t border-zinc-800 p-4 bg-zinc-950"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex gap-2 max-w-4xl mx-auto">
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
            className="flex-1 resize-none rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="self-end px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
          >
            Send
          </button>
        </div>
      </form>
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
    open: false,
  };
}

function MessageBubble({
  msg,
  busy,
  onSelect,
  onToggle,
}: {
  msg: UiMsg;
  busy: boolean;
  onSelect: (widgetId: string, selection: string) => void;
  onToggle: (id: string) => void;
}) {
  if (msg.kind === 'widget' && msg.meta && (msg.meta as WidgetMeta).type === 'widget') {
    const w = msg.meta as WidgetMeta;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-violet-700/50 bg-violet-950/40 px-4 py-3">
          <div className="text-sm font-medium text-violet-100 mb-3">{w.question}</div>
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
      <div className="max-w-3xl mx-auto text-center text-xs text-zinc-500 italic px-4">
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div className={`max-w-3xl mx-auto flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-violet-600 text-white rounded-br-md'
            : 'bg-zinc-800 text-zinc-100 rounded-bl-md border border-zinc-700/50'
        }`}
      >
        {msg.content || (msg.streaming ? '…' : '')}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}
