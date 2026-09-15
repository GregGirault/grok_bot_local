import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { displayName } from '@grok-bot/shared';
import type {
  ActivityMeta,
  Agent,
  ChatMessage,
  ComputerState,
  EmailMeta,
  FileCardMeta,
  LinkMeta,
  SecretMeta,
  ToolCardMeta,
  WidgetMeta,
} from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang, formatTime } from '../lib/i18n';
import BotAvatar from './BotAvatar';

export type UiMsg = ChatMessage & { streaming?: boolean; open?: boolean };

export function TakeoverOverlay({
  agent,
  lang,
  comp,
  onHandBack,
}: {
  agent: Agent;
  lang: Lang;
  comp: ComputerState | null;
  onHandBack: () => void;
}) {
  const [url, setUrl] = useState(comp?.url || 'workspace://local');
  const [typed, setTyped] = useState('');
  const [files, setFiles] = useState<Array<{ name: string; type: 'dir' | 'file' }>>([]);
  useEffect(() => {
    void api.computerFiles().then((r) => setFiles(r.files));
  }, []);
  const wall = `wall-${comp?.wallpaper ?? 'night'}`;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#050508' }}>
      <div className="h-12 px-4 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BotAvatar agent={agent} size={24} />
          <span className="text-[13px] font-medium">
            {t(lang, 'screenOf')} {displayName(agent.name)}
          </span>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-[12px] text-white"
          style={{ background: 'var(--gb-accent)' }}
          onClick={onHandBack}
        >
          {t(lang, 'handBack')}
        </button>
      </div>
      <form
        className="h-10 px-4 flex items-center gap-2 border-b border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          void api.computerNavigate(agent.id, url).then(() => undefined);
        }}
      >
        <span className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>{t(lang, 'addressBar')}</span>
        <input
          className="flex-1 bg-transparent text-[12px] outline-none"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </form>
      <div className="flex-1 flex min-h-0">
        <div className={`flex-1 ${wall} relative`}>
          {comp?.url && /^https?:/.test(comp.url) ? (
            <iframe title="browser" src={comp.url} className="absolute inset-0 w-full h-full bg-white" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 px-8">
              <p className="text-[15px] font-medium mb-2">{t(lang, 'takeover')}</p>
              <p className="text-[13px] text-white/80 max-w-md text-center">{t(lang, 'takeoverHint')}</p>
              <div className="mt-8 w-full max-w-lg space-y-1 text-[12px] text-white/80">
                {(comp?.events ?? []).slice(0, 8).map((e) => (
                  <div key={e.id}>{e.detail}</div>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="w-64 border-l border-zinc-800 p-3 overflow-y-auto" style={{ background: 'var(--gb-panel)' }}>
          <div className="text-[12px] font-medium mb-2">{t(lang, 'workspaceFiles')}</div>
          {files.map((f) => (
            <button
              key={f.name}
              type="button"
              className="block w-full text-left text-[11px] py-1 truncate"
              onClick={() => void api.computerClick(agent.id, f.name)}
            >
              {f.type === 'dir' ? '▸ ' : ''}
              {f.name}
            </button>
          ))}
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!typed.trim()) return;
              void api.computerType(agent.id, typed).then(() => setTyped(''));
            }}
          >
            <input
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[12px]"
              placeholder={t(lang, 'typeHere')}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </form>
        </aside>
      </div>
    </div>
  );
}

export function Transcript({
  msgs,
  lang,
  busy,
  onSelect,
  onToggle,
  onReact,
  onRegenerate,
  onReply,
}: {
  msgs: UiMsg[];
  lang: Lang;
  busy: boolean;
  onSelect: (id: string, sel: string) => void;
  onToggle: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onRegenerate: (id: string) => void;
  onReply: (m: UiMsg) => void;
}) {
  const blocks: Array<{ type: 'single'; msg: UiMsg } | { type: 'tools'; msgs: UiMsg[] }> = [];
  for (const m of msgs) {
    const isTool = m.role === 'tool' || m.kind === 'tool_card';
    const last = blocks[blocks.length - 1];
    if (isTool && last?.type === 'tools') last.msgs.push(m);
    else if (isTool) blocks.push({ type: 'tools', msgs: [m] });
    else blocks.push({ type: 'single', msg: m });
  }
  return (
    <>
      {blocks.map((b) => {
        if (b.type === 'tools') {
          return <ActivitySteps key={`t-${b.msgs[0].id}`} msgs={b.msgs} lang={lang} onToggle={onToggle} />;
        }
        const m = b.msg;
        if (!m.content && !m.streaming && m.kind !== 'widget' && m.kind !== 'event' && m.kind !== 'tool_card' && !(m.meta as { type?: string } | undefined)?.type) {
          return null;
        }
        return (
          <Bubble
            key={m.id}
            msg={m}
            lang={lang}
            busy={busy}
            quoted={m.replyToId ? msgs.find((x) => x.id === m.replyToId) : undefined}
            onSelect={onSelect}
            onToggle={onToggle}
            onReact={onReact}
            onRegenerate={onRegenerate}
            onReply={onReply}
          />
        );
      })}
    </>
  );
}

function ActivitySteps({
  msgs,
  lang,
  onToggle,
}: {
  msgs: UiMsg[];
  lang: Lang;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="text-[12px]" style={{ color: 'var(--gb-muted)' }} onClick={() => setOpen((v) => !v)}>
        {open ? t(lang, 'hideSteps') : `${t(lang, 'viewSteps')} · ${msgs.length}`}
      </button>
      {open && (
        <div className="mt-2 space-y-1 border-l border-zinc-800 pl-3">
          {msgs.map((m) => {
            const meta = m.meta as ToolCardMeta | undefined;
            const name = meta?.toolName || m.toolName || 'outil';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onToggle(m.id)}
                className="block w-full text-left text-[12px]"
                style={{ color: 'var(--gb-muted)' }}
              >
                {name}
                {m.open && <pre className="mt-1 text-[11px] whitespace-pre-wrap max-h-32 overflow-auto">{(meta?.result || m.content).slice(0, 2000)}</pre>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bubble({
  msg,
  lang,
  busy,
  quoted,
  onSelect,
  onToggle,
  onReact,
  onRegenerate,
  onReply,
}: {
  msg: UiMsg;
  lang: Lang;
  busy: boolean;
  quoted?: UiMsg;
  onSelect: (id: string, sel: string) => void;
  onToggle: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onRegenerate: (id: string) => void;
  onReply: (m: UiMsg) => void;
}) {
  const meta = msg.meta as Record<string, unknown> | undefined;
  if (meta?.type === 'file') {
    return <FileCard meta={meta as unknown as FileCardMeta} lang={lang} />;
  }
  if (meta?.type === 'link') {
    const l = meta as unknown as LinkMeta;
    return (
      <a href={l.url} className="block rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-[13px]" target="_blank" rel="noreferrer">
        <div className="font-medium truncate">{l.title || l.url}</div>
        <div className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>{l.url}</div>
      </a>
    );
  }
  if (meta?.type === 'secret') {
    return <SecretCard meta={meta as unknown as SecretMeta} lang={lang} />;
  }
  if (meta?.type === 'calendar') {
    const c = meta as unknown as { title: string; at: string; where?: string };
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-[12px]">
        <div className="font-medium">{c.title}</div>
        <div style={{ color: 'var(--gb-muted)' }}>{c.at}{c.where ? ` · ${c.where}` : ''}</div>
      </div>
    );
  }
  if (meta?.type === 'board') {
    const b = meta as unknown as { title: string; columns: Array<{ name: string; items: string[] }> };
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="text-[12px] font-medium mb-2">{b.title}</div>
        <div className="grid grid-cols-3 gap-2">
          {b.columns.map((col) => (
            <div key={col.name}>
              <div className="text-[10px] mb-1" style={{ color: 'var(--gb-muted)' }}>{col.name}</div>
              {col.items.map((it) => (
                <div key={it} className="text-[11px] rounded-lg bg-zinc-950 px-2 py-1 mb-1">{it}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (meta?.type === 'email') {
    return <EmailCard meta={meta as unknown as EmailMeta} lang={lang} />;
  }
  if (meta?.type === 'activity') {
    return <ActivityCard meta={meta as unknown as ActivityMeta} lang={lang} />;
  }
  if (msg.kind === 'event' || meta?.type === 'event' || meta?.type === 'routine_created' || meta?.type === 'handoff') {
    return <EventCard msg={msg} lang={lang} />;
  }
  if (msg.kind === 'widget' && msg.meta && (msg.meta as WidgetMeta).type === 'widget') {
    const w = msg.meta as WidgetMeta;
    return (
      <div className="rounded-2xl border border-violet-700/40 bg-violet-950/20 px-4 py-3">
        <div className="text-[13px] mb-3 whitespace-pre-wrap">{w.question}</div>
        <div className="flex flex-wrap gap-2">
          {w.options.map((opt) => (
            <button
              key={opt}
              disabled={busy || Boolean(w.selected)}
              onClick={() => onSelect(w.widgetId, opt)}
              className={`text-[12px] px-3 py-1.5 rounded-lg border ${
                w.selected === opt ? 'bg-violet-600 border-violet-500' : 'bg-zinc-900 border-zinc-700 hover:border-violet-500'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (msg.role === 'tool' || msg.kind === 'tool_card') {
    const tm = msg.meta as ToolCardMeta | undefined;
    const name = tm?.toolName || msg.toolName || 'outil';
    return (
      <button
        type="button"
        onClick={() => onToggle(msg.id)}
        className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
      >
        <div className="flex justify-between text-[11px] font-mono" style={{ color: 'var(--gb-muted)' }}>
          <span>{name}</span>
          <span>{msg.open ? '▾' : '▸'}</span>
        </div>
        {msg.open && <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-40 overflow-auto">{(tm?.result || msg.content).slice(0, 3000)}</pre>}
      </button>
    );
  }
  if (msg.role === 'system') {
    return (
      <div className="text-center text-[11px] italic" style={{ color: 'var(--gb-muted)' }}>
        {msg.content}
      </div>
    );
  }
  const isUser = msg.role === 'user';
  const urls = [...msg.content.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]);
  return (
    <div className={`group ${isUser ? '' : ''}`}>
      {quoted && (
        <div className="mb-1 pl-3 border-l-2 border-zinc-700 text-[12px] truncate" style={{ color: 'var(--gb-muted)' }}>
          {quoted.content.slice(0, 120)}
        </div>
      )}
      {isUser ? (
        <div className="text-[14px] leading-relaxed text-zinc-200">{msg.content}</div>
      ) : (
        <div className="md-body text-[14px] leading-relaxed text-zinc-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || (msg.streaming ? '…' : '')}</ReactMarkdown>
        </div>
      )}
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {msg.attachments.map((f) => (
            <FileCard
              key={f.id}
              meta={{
                type: 'file',
                name: f.name,
                mime: f.mime,
                size: f.size,
                url: f.url || (f.path ? `/uploads/${f.path.split(/[/\\]/).pop()}` : undefined),
              }}
              lang={lang}
            />
          ))}
        </div>
      )}
      {urls.map((url) => (
        <a key={url} href={url} className="mt-2 block rounded-xl border border-zinc-800 px-3 py-2 text-[12px] truncate" target="_blank" rel="noreferrer">
          {url}
        </a>
      ))}
      <div className="mt-1 flex items-center gap-2 text-[10px]" style={{ color: 'var(--gb-muted)' }}>
        <span>{formatTime(msg.createdAt, lang)}</span>
        {!msg.id.startsWith('u-') && !msg.id.startsWith('a-') && (
          <button className="hidden group-hover:inline hover:text-zinc-200" onClick={() => onReply(msg)}>
            {t(lang, 'reply')}
          </button>
        )}
        {!isUser && !msg.streaming && !msg.id.startsWith('a-') && (
          <button className="hidden group-hover:inline hover:text-zinc-200" onClick={() => onRegenerate(msg.id)} disabled={busy}>
            {t(lang, 'regenerate')}
          </button>
        )}
        {!msg.id.startsWith('u-') && !msg.id.startsWith('a-') && (
          <>
            {['👍', '👀', '✅'].map((emoji) => (
              <button key={emoji} className="hidden group-hover:inline" onClick={() => onReact(msg.id, emoji)}>
                {emoji}
              </button>
            ))}
          </>
        )}
        {msg.reactions?.map((r) => (
          <span key={r.emoji}>
            {r.emoji} {r.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function FileCard({ meta, lang }: { meta: FileCardMeta; lang: Lang }) {
  const isImage = (meta.mime || '').startsWith('image/');
  const isVideo = (meta.mime || '').startsWith('video/');
  return (
    <a
      href={meta.url || '#'}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden max-w-xs"
    >
      {isImage && meta.url ? (
        <img src={meta.url} alt={meta.name} className="w-full max-h-48 object-cover" />
      ) : null}
      {isVideo && meta.url ? (
        <video src={meta.url} className="w-full max-h-48" controls />
      ) : null}
      <div className="px-3 py-2 text-[12px]">
        <div className="truncate font-medium">{meta.name}</div>
        <div style={{ color: 'var(--gb-muted)' }}>
          {isImage ? t(lang, 'imageAttachment') : isVideo ? t(lang, 'videoAttachment') : t(lang, 'filesLabel')}
          {meta.size ? ` · ${Math.round(meta.size / 1024)} Ko` : ''}
        </div>
      </div>
    </a>
  );
}

function EmailCard({ meta, lang }: { meta: EmailMeta; lang: Lang }) {
  const [status, setStatus] = useState(meta.status);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-zinc-800">
        <span className="text-[12px] font-medium">{t(lang, 'newEmail')}</span>
        <span className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
          {status === 'ready' || status === 'draft' ? t(lang, 'readyToSend') : status === 'sent' ? t(lang, 'sendEmail') : t(lang, 'discard')}
        </span>
      </div>
      <div className="px-4 py-3 text-[12px] space-y-1">
        <div>
          <span style={{ color: 'var(--gb-muted)' }}>{t(lang, 'from')} </span>
          {meta.from}
          <span style={{ color: 'var(--gb-muted)' }}> {t(lang, 'to')} </span>
          {meta.to}
        </div>
        <div>
          <span style={{ color: 'var(--gb-muted)' }}>{t(lang, 'subject')} </span>
          {meta.subject}
        </div>
        <p className="pt-2 text-[13px] leading-relaxed whitespace-pre-wrap">{meta.body}</p>
      </div>
      {status === 'ready' || status === 'draft' ? (
        <div className="px-4 py-2.5 flex gap-2 border-t border-zinc-800">
          <button type="button" className="px-3 py-1.5 rounded-lg text-[12px] text-white" style={{ background: 'var(--gb-accent)' }} onClick={() => setStatus('sent')}>
            {t(lang, 'sendEmail')}
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-[12px]" onClick={() => setStatus('discarded')}>
            {t(lang, 'discard')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SecretCard({ meta, lang }: { meta: SecretMeta; lang: Lang }) {
  const [val, setVal] = useState('');
  const [done, setDone] = useState(Boolean(meta.filled));
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="text-[13px] mb-2">{meta.prompt}</div>
      {done ? (
        <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>{t(lang, 'secretSaved')}</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!val) return;
            void api.putSecret({ plugin: meta.plugin, keyName: meta.keyName, value: val }).then(() => {
              setDone(true);
              setVal('');
            });
          }}
        >
          <input type="password" className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-[13px]" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t(lang, 'secretPrompt')} />
          <button type="submit" className="px-3 py-1.5 rounded-lg text-white text-[12px]" style={{ background: 'var(--gb-accent)' }}>
            {t(lang, 'submitSecret')}
          </button>
        </form>
      )}
    </div>
  );
}

function EventCard({ msg, lang }: { msg: UiMsg; lang: Lang }) {
  const meta = (msg.meta || {}) as Record<string, unknown>;
  const event = String(meta.event ?? meta.type ?? '');
  const bots = Array.isArray(meta.bots) ? meta.bots.map((b) => displayName(String(b))) : [];
  const count = typeof meta.count === 'number' ? meta.count : bots.length;
  const name = String(meta.name ?? meta.label ?? '');
  const schedule = typeof meta.schedule === 'string' ? meta.schedule : '';
  if (event === 'routine_created') {
    return (
      <div className="rounded-xl border border-zinc-800 px-3 py-2.5 text-[12px]">
        <div className="font-medium">{t(lang, 'createdRoutine')} {name}</div>
        {schedule && <div style={{ color: 'var(--gb-muted)' }}>{schedule}</div>}
      </div>
    );
  }
  if (event === 'handoff') {
    return (
      <div className="rounded-xl border border-zinc-800 px-3 py-2.5 text-[12px]">
        <div className="font-medium">
          {count} messages avec {bots.join(', ')}
        </div>
        {msg.content && <div className="mt-1" style={{ color: 'var(--gb-muted)' }}>{msg.content}</div>}
      </div>
    );
  }
  return (
    <div className="text-center text-[11px] italic" style={{ color: 'var(--gb-muted)' }}>
      {name || msg.content}
    </div>
  );
}

function ActivityCard({ meta, lang }: { meta: ActivityMeta; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="text-[12px]" style={{ color: 'var(--gb-muted)' }} onClick={() => setOpen((v) => !v)}>
        {meta.title} · {open ? t(lang, 'hideSteps') : t(lang, 'viewSteps')}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 border-l border-zinc-800 pl-3">
          {meta.steps.map((s: { label: string; detail?: string }) => (
            <li key={s.label} className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
              {s.label}
              {s.detail ? ` · ${s.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
