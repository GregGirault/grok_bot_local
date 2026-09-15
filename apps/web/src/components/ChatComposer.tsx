import type { MutableRefObject, RefObject } from 'react';
import type { Agent, AttachmentInfo, Channel, ChatMessage, Routine } from '@grok-bot/shared';
import { displayName } from '@grok-bot/shared';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import { MicIcon, CameraIcon } from './Icons';

export function ChatComposer({
  lang,
  phone,
  first,
  input,
  busy,
  listening,
  mentionOpen,
  slashOpen,
  mentions,
  groups,
  routines,
  plugins,
  skills,
  replyTo,
  attachErr,
  pending,
  dropOver,
  fileRef,
  cameraRef,
  insertAt,
  insertSlash,
  setReplyTo,
  setDropOver,
  addFiles,
  onComposerChange,
  send,
  startDictate,
  abortRef,
  setBusy,
  setTyping,
}: {
  lang: Lang;
  phone: boolean;
  first: string;
  input: string;
  busy: boolean;
  listening: boolean;
  mentionOpen: boolean;
  slashOpen: boolean;
  mentions: Agent[];
  groups: Channel[];
  routines: Routine[];
  plugins: Array<{ slug: string; name: string; installed: boolean }>;
  skills: Array<{ name: string; description?: string }>;
  replyTo: ChatMessage | null;
  attachErr: string;
  pending: AttachmentInfo[];
  dropOver: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  insertAt: (name: string) => void;
  insertSlash: (name: string) => void;
  setReplyTo: (m: ChatMessage | null) => void;
  setDropOver: (v: boolean) => void;
  addFiles: (files: File[]) => Promise<void>;
  onComposerChange: (v: string) => void;
  send: () => void;
  startDictate: () => void;
  abortRef: MutableRefObject<AbortController | null>;
  setBusy: (v: boolean) => void;
  setTyping: (v: boolean) => void;
}) {
  return (
        <form
          className="shrink-0 px-4 pb-4 pt-1 relative gb-safe-bottom"
          style={{ background: 'var(--gb-bg)' }}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {mentionOpen && (
            <div className="absolute bottom-full left-8 mb-1 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl py-1 z-20 max-h-72 overflow-y-auto">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[12px]"
                onClick={() => insertAt('everyone')}
              >
                @everyone · {t(lang, 'everyone')}
              </button>
              {mentions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
                  onClick={() => insertAt(a.name)}
                >
                  <BotAvatar agent={a} size={20} />
                  <span className="text-[12px]">{displayName(a.name)}</span>
                  <span className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>{a.title}</span>
                </button>
              ))}
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[12px]"
                  onClick={() => insertAt(g.name.replace(/\s+/g, ''))}
                >
                  @{g.name} · {t(lang, 'groupChat')}
                </button>
              ))}
              {routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[12px]"
                  onClick={() => insertAt(r.name.replace(/\s+/g, ''))}
                >
                  @{r.name} · {t(lang, 'routines')}
                </button>
              ))}
              {plugins.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[12px]"
                  onClick={() => insertAt(p.slug)}
                >
                  @{p.slug} · {p.name}
                </button>
              ))}
            </div>
          )}
          {slashOpen && (
            <div className="absolute bottom-full left-8 mb-1 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl py-1 z-20">
              {skills.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800"
                  onClick={() => insertSlash(s.name)}
                >
                  <div className="text-[12px]">/{s.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--gb-muted)' }}>{s.description}</div>
                </button>
              ))}
            </div>
          )}
          {replyTo && (
            <div className="max-w-[640px] mx-auto mb-2 flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-[12px]">
              <span className="flex-1 truncate">
                {t(lang, 'replyTo')} · {replyTo.content.slice(0, 80)}
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                {t(lang, 'cancelReply')}
              </button>
            </div>
          )}
          {attachErr && (
            <div className="max-w-[640px] mx-auto mb-2 text-[11px] text-amber-300">{attachErr}</div>
          )}
          {pending.length > 0 && (
            <div className="max-w-[640px] mx-auto mb-2 flex gap-2 flex-wrap">
              {pending.map((f) => (
                <span key={f.id} className="text-[11px] px-2 py-1 rounded bg-zinc-800">
                  {f.name}
                </span>
              ))}
            </div>
          )}
          <div
            className="max-w-[640px] mx-auto flex items-center gap-2 rounded-2xl border px-2 py-1.5"
            style={{
              background: 'var(--gb-input)',
              borderColor: dropOver ? 'var(--gb-accent)' : 'var(--gb-border)',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropOver(true);
            }}
            onDragLeave={() => setDropOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropOver(false);
              void addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                const list = e.target.files;
                if (!list) return;
                void addFiles(Array.from(list));
                e.target.value = '';
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                if (!list) return;
                void addFiles(Array.from(list));
                e.target.value = '';
              }}
            />
            <button type="button" className="h-9 w-9 rounded-xl hover:bg-zinc-800 text-lg leading-none" onClick={() => fileRef.current?.click()} title={t(lang, 'attach')}>
              +
            </button>
            {phone && (
              <button type="button" className="h-9 w-9 rounded-xl hover:bg-zinc-800 flex items-center justify-center" onClick={() => cameraRef.current?.click()} title={t(lang, 'takePhoto')}>
                <CameraIcon />
              </button>
            )}
            <textarea
              rows={1}
              value={input}
              onChange={(e) => onComposerChange(e.target.value)}
              onPaste={(e) => {
                const items = Array.from(e.clipboardData.items);
                const files = items
                  .filter((it) => it.kind === 'file')
                  .map((it) => it.getAsFile())
                  .filter((f): f is File => Boolean(f));
                if (files.length) {
                  e.preventDefault();
                  void addFiles(files.map((f, i) => (f.name === 'image.png' ? new File([f], `${t(lang, 'pasteImage')}-${i + 1}.png`, { type: f.type }) : f)));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={dropOver ? t(lang, 'dropFiles') : `${t(lang, 'messagePlaceholder')} ${first}`}
              className="flex-1 resize-none bg-transparent px-1 py-1.5 text-[16px] md:text-[13px] focus:outline-none"
            />
            {phone && (
              <button
                type="button"
                className={`h-9 w-9 rounded-xl flex items-center justify-center ${listening ? 'bg-violet-700 text-white' : 'hover:bg-zinc-800'}`}
                onClick={startDictate}
                title={t(lang, 'dictate')}
              >
                <MicIcon />
              </button>
            )}
            {busy && (
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-lg bg-zinc-800"
                title={t(lang, 'stopNowHint')}
                onClick={() => {
                  abortRef.current?.abort();
                  setBusy(false);
                  setTyping(false);
                }}
              >
                {t(lang, 'stopNow')}
              </button>
            )}
          </div>
        </form>

  );
}
