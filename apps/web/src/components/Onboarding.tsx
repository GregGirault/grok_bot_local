import { useState } from 'react';
import { displayName } from '@grok-bot/shared';
import type { Agent } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';

export default function Onboarding({
  lang,
  agents,
  onDone,
}: {
  lang: Lang;
  agents: Agent[];
  onDone: (agentId?: string) => void;
}) {
  const [step, setStep] = useState<'sign' | 'meet' | 'create' | 'boot'>('sign');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const lead =
    agents.find((a) => a.name.toLowerCase() === 'oracle') ?? agents.find((a) => a.pinned) ?? agents[0];

  const finish = (id?: string) => {
    localStorage.setItem('gb-onboarded', '1');
    onDone(id);
  };

  if (step === 'boot') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'var(--gb-bg)' }}>
        <div className="text-center px-6">
          <div className="mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center text-white text-[22px]" style={{ background: 'var(--gb-accent)' }}>
            GB
          </div>
          <p className="text-[15px] font-medium">{t(lang, 'computerStarting')}</p>
          <p className="text-[12px] mt-2" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'computerSharedHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4 gb-safe-bottom" style={{ background: 'var(--gb-bg)' }}>
      <div className="w-full max-w-md">
        {step === 'sign' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="h-12 w-12 rounded-2xl mb-4 flex items-center justify-center text-white text-[16px] font-semibold" style={{ background: 'var(--gb-accent)' }}>
              GB
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight">{t(lang, 'onboardWelcome')}</h1>
            <p className="text-[13px] mt-2 leading-relaxed" style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'onboardSubtitle')}
            </p>
            <p className="text-[12px] mt-3" style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'onboardAccount')}
            </p>
            <button
              type="button"
              className="mt-6 w-full py-2.5 rounded-xl text-white text-[13px] font-medium"
              style={{ background: 'var(--gb-accent)' }}
              onClick={() => setStep('meet')}
            >
              {t(lang, 'continueLocal')}
            </button>
            <button type="button" className="mt-2 w-full py-2 text-[12px]" style={{ color: 'var(--gb-muted)' }} onClick={() => finish(lead?.id)}>
              {t(lang, 'skipOnboard')}
            </button>
          </div>
        )}
        {step === 'meet' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-[16px] font-semibold mb-4">{t(lang, 'meetTeammate')}</h2>
            {lead && (
              <button
                type="button"
                className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 px-3 py-3 hover:bg-zinc-900 text-left mb-3"
                onClick={() => {
                  setStep('boot');
                  window.setTimeout(() => finish(lead.id), 1400);
                }}
              >
                <BotAvatar agent={lead} size={44} />
                <span>
                  <span className="block text-[14px] font-medium">{displayName(lead.name)}</span>
                  <span className="block text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                    {lead.title}
                  </span>
                  <span className="block text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'onboardMeetHint')}
                  </span>
                </span>
              </button>
            )}
            <button
              type="button"
              className="w-full rounded-xl border border-zinc-800 px-4 py-3 text-left hover:bg-zinc-900"
              onClick={() => setStep('create')}
            >
              <div className="text-[13px] font-medium">{t(lang, 'createOwn')}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--gb-muted)' }}>
                {t(lang, 'onboardCreateHint')}
              </div>
            </button>
          </div>
        )}
        {step === 'create' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
            <h2 className="text-[16px] font-semibold">{t(lang, 'createOwn')}</h2>
            <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-[13px]" placeholder={t(lang, 'name')} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-[13px]" placeholder={t(lang, 'jobTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-[13px]" rows={3} placeholder={t(lang, 'description')} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep('meet')}>
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-white text-[13px]"
                style={{ background: 'var(--gb-accent)' }}
                onClick={() => {
                  void api
                    .createAgent({
                      name: name.trim() || 'Nouvel agent',
                      title: title.trim() || 'Nouvel agent',
                      description: desc.trim(),
                      avatarShape: 'blob',
                    })
                    .then((a) => {
                      setStep('boot');
                      window.setTimeout(() => finish(a.id), 1400);
                    });
                }}
              >
                {t(lang, 'createBot')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
