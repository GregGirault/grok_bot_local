import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Agent, ChatMessage, MemoryEntry } from '@grok-bot/shared';
import { api, streamChat } from '../lib/api';

type UiMsg = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  streaming?: boolean;
};

export default function ChatPage(_props: { onAgentsChange?: () => void }) {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    (async () => {
      try {
        const agents = await api.listAgents();
        const a = agents.find((x) => x.id === agentId) ?? null;
        if (cancelled) return;
        setAgent(a);
        const [history, mem] = await Promise.all([
          api.listMessages(agentId),
          api.listMemory(agentId),
        ]);
        if (cancelled) return;
        setMsgs(
          history
            .filter((m) => m.role !== 'system')
            .map((m: ChatMessage) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              toolName: m.toolName,
            }))
        );
        setMemory(mem);
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

    await streamChat(
      agentId,
      text,
      {
        onToken: (c) => {
          setMsgs((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: m.content + c } : m
            )
          );
        },
        onToolCall: (data) => {
          setMsgs((prev) => [
            ...prev.filter((m) => m.id !== asstId || m.content),
            {
              id: `tc-${data.id}`,
              role: 'tool',
              content: `→ ${data.name}(${truncate(data.arguments, 120)})`,
              toolName: data.name,
            },
            { id: asstId, role: 'assistant', content: '', streaming: true },
          ]);
        },
        onToolResult: (data) => {
          setMsgs((prev) => [
            ...prev,
            {
              id: `tr-${data.id}`,
              role: 'tool',
              content: `← ${data.name}: ${truncate(data.result, 400)}`,
              toolName: data.name,
            },
          ]);
        },
        onDone: (content) => {
          setMsgs((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, content: m.content || content, streaming: false }
                : m
            )
          );
        },
        onError: (message) => {
          setMsgs((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, content: m.content || `Error: ${message}`, streaming: false }
                : m
            )
          );
        },
        onMemory: (entries) => setMemory(entries),
      },
      undefined,
      ac.signal
    );

    setBusy(false);
    abortRef.current = null;
  };

  const clearChat = async () => {
    if (!agentId) return;
    await api.clearMessages(agentId);
    setMsgs([]);
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
        <div>
          <h1 className="font-semibold">{agent.title}</h1>
          <p className="text-xs text-zinc-500 truncate max-w-xl">{agent.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemory((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
          >
            Memory ({memory.length})
          </button>
          <button
            onClick={() => void clearChat()}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
          >
            Clear
          </button>
        </div>
      </header>

      {showMemory && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-5 py-3 text-sm max-h-40 overflow-y-auto">
          {memory.length === 0 ? (
            <div className="text-zinc-500">No memory entries yet.</div>
          ) : (
            <ul className="space-y-1">
              {memory.map((m) => (
                <li key={m.id} className="font-mono text-xs text-zinc-300">
                  <span className="text-violet-400">{m.key}</span>: {m.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center text-zinc-500 mt-20">
            <div className="text-4xl mb-3">⚡</div>
            <p>Chat with <strong className="text-zinc-300">{agent.title}</strong></p>
            <p className="text-sm mt-1">Tools, memory & skills are ready.</p>
          </div>
        )}
        {msgs.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {busy && (
          <div className="flex gap-1.5 px-1">
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

function MessageBubble({ msg }: { msg: UiMsg }) {
  if (msg.role === 'tool') {
    return (
      <div className="max-w-3xl mx-auto">
        <pre className="text-xs font-mono text-amber-200/80 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 whitespace-pre-wrap overflow-x-auto">
          {msg.content}
        </pre>
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
