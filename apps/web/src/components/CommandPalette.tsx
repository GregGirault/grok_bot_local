import { useEffect, useMemo, useState } from 'react';
import { displayName } from '@grok-bot/shared';
import type { Agent, AttachmentInfo, Channel, ChatMessage, Routine } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';

export default function CommandPalette({
  lang,
  agents,
  groups,
  onClose,
  onBot,
  onGroup,
  onSettings,
}: {
  lang: Lang;
  agents: Agent[];
  groups: Channel[];
  onClose: () => void;
  onBot: (id: string) => void;
  onGroup: (id: string) => void;
  onSettings: () => void;
}) {
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<{
    agents: Agent[];
    messages: ChatMessage[];
    routines: Routine[];
    files: AttachmentInfo[];
    channels: Channel[];
  }>({ agents: [], messages: [], routines: [], files: [], channels: [] });

  useEffect(() => {
    const tmr = setTimeout(() => {
      if (!q.trim()) {
        setRemote({ agents: [], messages: [], routines: [], files: [], channels: [] });
        return;
      }
      void api.search(q).then(setRemote).catch(() => undefined);
    }, 120);
    return () => clearTimeout(tmr);
  }, [q]);

  const local = useMemo(() => {
    const n = q.toLowerCase();
    const bots = agents.filter((a) => `${a.title} ${a.name}`.toLowerCase().includes(n));
    const gs = groups.filter((g) => g.name.toLowerCase().includes(n));
    return { bots, gs };
  }, [q, agents, groups]);

  const bots = (remote.agents.length ? remote.agents : local.bots).slice(0, 8);
  const chans = (remote.channels.length ? remote.channels : local.gs).slice(0, 6);
  const empty =
    Boolean(q.trim()) &&
    !bots.length &&
    !chans.length &&
    !remote.messages.length &&
    !remote.routines.length &&
    !remote.files.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="w-full bg-transparent px-4 py-3 text-[14px] outline-none border-b border-zinc-800"
          placeholder={t(lang, 'commandHint')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-96 overflow-y-auto py-1">
          <button type="button" className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-[13px]" onClick={onSettings}>
            {t(lang, 'settings')}
          </button>
          {bots.map((a) => (
            <button key={a.id} type="button" className="w-full flex items-center gap-2 px-4 py-2 hover:bg-zinc-900" onClick={() => onBot(a.id)}>
              <BotAvatar agent={a} size={22} />
              <span className="text-[13px]">{displayName(a.name)}</span>
              <span className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>
                {a.title || a.lastPreview}
              </span>
            </button>
          ))}
          {chans.map((g) => (
            <button key={g.id} type="button" className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-[13px]" onClick={() => onGroup(g.id)}>
              # {g.name}
            </button>
          ))}
          {remote.messages.slice(0, 8).map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-zinc-900"
              onClick={() => onBot(m.agentId)}
            >
              <div className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'jumpToMessage')}
              </div>
              <div className="text-[13px] truncate">{m.content}</div>
            </button>
          ))}
          {remote.files.slice(0, 6).map((f) => (
            <a key={f.id} href={f.url || '#'} className="block px-4 py-2 hover:bg-zinc-900 text-[13px] truncate" onClick={onClose}>
              {t(lang, 'filesLabel')} · {f.name}
            </a>
          ))}
          {remote.routines.slice(0, 6).map((r) => (
            <button key={r.id} type="button" className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-[13px]" onClick={() => onBot(r.agentId)}>
              {t(lang, 'routines')} · {r.name}
            </button>
          ))}
          {empty && (
            <div className="px-4 py-6 text-[12px]" style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
