import type { ReactNode } from 'react';
import type { Settings } from '@grok-bot/shared';
import { t, type Lang } from '../lib/i18n';
import { ChevronIcon, CloseIcon, PluginsIcon } from './Icons';

type Tab = 'general' | 'plugins' | 'usage' | 'team' | 'beta';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p && p !== '.');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const compact = name.replace(/[^A-Za-z0-9]/g, '');
  return (compact.slice(0, 2) || 'GB').toUpperCase();
}

export function IosToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`gb-toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
  );
}

export function IosRow({
  title,
  hint,
  value,
  toggle,
  onClick,
  last,
}: {
  title: string;
  hint?: string;
  value?: ReactNode;
  toggle?: { on: boolean; onChange: (v: boolean) => void };
  onClick?: () => void;
  last?: boolean;
}) {
  const inner = (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-white/10'}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] leading-tight">{title}</div>
        {hint ? (
          <div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--gb-muted)' }}>
            {hint}
          </div>
        ) : null}
      </div>
      {toggle ? <IosToggle on={toggle.on} onChange={toggle.onChange} /> : null}
      {value ? (
        <div className="text-[15px] shrink-0" style={{ color: 'var(--gb-muted)' }}>
          {value}
        </div>
      ) : null}
      {onClick && !toggle ? (
        <span className="shrink-0" style={{ color: 'var(--gb-muted)' }}>
          <ChevronIcon />
        </span>
      ) : null}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className="w-full text-left" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return inner;
}

export function IosSettingsHome({
  lang,
  s,
  ownerName,
  ownerEmail,
  usagePct,
  onClose,
  onOpen,
  onSave,
}: {
  lang: Lang;
  s: Settings;
  ownerName: string;
  ownerEmail: string;
  usagePct: number;
  onClose: () => void;
  onOpen: (tab: Tab) => void;
  onSave: (patch: Partial<Settings>) => void;
}) {
  const rules = s.autoReviewRules ?? [];
  return (
    <div className="flex-1 overflow-y-auto px-4 pb-10 gb-safe-top gb-safe-bottom">
      <div className="pt-3 pb-4">
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-[#2c2c2e] flex items-center justify-center"
          onClick={onClose}
          aria-label={t(lang, 'close')}
        >
          <CloseIcon />
        </button>
      </div>

      <button
        type="button"
        className="w-full rounded-2xl bg-[#1c1c1e] px-4 py-3 flex items-center gap-3 mb-3"
        onClick={() => onOpen('general')}
      >
        <span className="h-11 w-11 rounded-full bg-zinc-600 flex items-center justify-center text-[13px] font-semibold">
          {initials(ownerName)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[16px] font-medium truncate">{ownerName}</span>
          <span className="block text-[13px] truncate" style={{ color: 'var(--gb-muted)' }}>
            {ownerEmail}
          </span>
        </span>
        <span style={{ color: 'var(--gb-muted)' }}>
          <ChevronIcon />
        </span>
      </button>

      <button
        type="button"
        className="w-full rounded-2xl bg-[#1c1c1e] px-4 py-3.5 flex items-center justify-between mb-3"
        onClick={() => onOpen('usage')}
      >
        <span className="text-[16px]">{t(lang, 'usageLabel')}</span>
        <span className="flex items-center gap-1" style={{ color: 'var(--gb-muted)' }}>
          <span>{usagePct}%</span>
          <ChevronIcon />
        </span>
      </button>

      <button
        type="button"
        className="w-full rounded-2xl bg-[#1c1c1e] px-4 py-3.5 flex items-center gap-3 mb-6"
        onClick={() => onOpen('plugins')}
      >
        <span className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center" style={{ color: 'var(--gb-muted)' }}>
          <PluginsIcon />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[16px]">{t(lang, 'plugins')}</span>
          <span className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'pluginsForGrok')}
          </span>
        </span>
        <span style={{ color: 'var(--gb-muted)' }}>
          <ChevronIcon />
        </span>
      </button>

      <div className="text-[12px] px-1 mb-2" style={{ color: 'var(--gb-muted)' }}>
        {t(lang, 'botSection')}
      </div>
      <div className="rounded-2xl bg-[#1c1c1e] overflow-hidden mb-6">
        <IosRow
          title={t(lang, 'autoReview')}
          hint={t(lang, 'autoReviewRequire')}
          toggle={{
            on: s.autoReviewEnforced !== false,
            onChange: (v) => onSave({ autoReviewEnforced: v }),
          }}
        />
        <IosRow
          title={t(lang, 'autoReviewRules')}
          value={String(rules.length)}
          onClick={() => onOpen('general')}
        />
        <IosRow
          title={t(lang, 'timezoneAuto')}
          hint={t(lang, 'timezoneAutoHint')}
          toggle={{
            on: s.timezoneAuto !== false,
            onChange: (v) =>
              onSave({
                timezoneAuto: v,
                timezone: v ? Intl.DateTimeFormat().resolvedOptions().timeZone : s.timezone,
              }),
          }}
        />
        <IosRow title={t(lang, 'timezone')} value={s.timezone || 'Europe/Paris'} onClick={() => onOpen('general')} />
        <IosRow title={t(lang, 'botComputer')} onClick={() => onOpen('beta')} last />
      </div>

      <div className="rounded-2xl bg-[#1c1c1e] overflow-hidden">
        <IosRow
          title={t(lang, 'notifications')}
          toggle={{
            on: s.notificationsEnabled !== false,
            onChange: (v) => onSave({ notificationsEnabled: v }),
          }}
          last
        />
      </div>
    </div>
  );
}
