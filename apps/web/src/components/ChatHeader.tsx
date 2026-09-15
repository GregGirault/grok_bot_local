import type { Agent } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import { ComputerIcon, BackIcon, MoreIcon, ShareIcon } from './Icons';

export function ChatHeader({
  agent,
  lang,
  phone,
  first,
  action,
  busy,
  computerActive,
  headerMenu,
  hoverAction,
  onBack,
  onDelete,
  onAgentsChange,
  setProfileOpen,
  setPaneOpen,
  setHeaderMenu,
  setHoverAction,
}: {
  agent: Agent;
  lang: Lang;
  phone: boolean;
  first: string;
  action: string;
  busy: boolean;
  computerActive: boolean;
  headerMenu: boolean;
  hoverAction: boolean;
  onBack?: () => void;
  onDelete?: (agent: Agent) => void;
  onAgentsChange: () => void;
  setProfileOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setPaneOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setHeaderMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  setHoverAction: (v: boolean) => void;
}) {
  return (
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

  );
}
