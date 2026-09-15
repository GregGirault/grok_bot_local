import { useState } from 'react';
import { displayName } from '@grok-bot/shared';
import type { Agent } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';

export default function NewChatModal({
  lang,
  agents,
  onClose,
  onCreated,
}: {
  lang: Lang;
  agents: Agent[];
  onClose: () => void;
  onCreated: (kind: 'bot' | 'group', id: string) => void;
}) {
  const [mode, setMode] = useState<'pick' | 'bot' | 'group'>('pick');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const createBot = async () => {
    const a = await api.createAgent({
      name: 'Nouvel agent',
      title: 'Nouvel agent',
      description: 'Décris le métier, la borne d’approbation, et ce que ce bot possède. Ne jamais envoyer de message externe sans accord.',
      avatarShape: 'blob',
    });
    onCreated('bot', a.id);
  };

  const createGroup = async () => {
    if (picked.length < 2 || picked.length > 6) return;
    const names = agents.filter((a) => picked.includes(a.id)).map((a) => displayName(a.name));
    const ch = await api.createChannel({
      name: name.trim() || names.slice(0, 3).join(', '),
      description: desc,
      memberIds: picked,
    });
    onCreated('group', ch.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl border border-zinc-800 bg-zinc-950 p-5 gb-safe-bottom" onClick={(e) => e.stopPropagation()}>
        {mode === 'pick' && (
          <div className="space-y-2">
            <h2 className="text-[15px] font-semibold mb-3">{t(lang, 'newChat')}</h2>
            <button
              type="button"
              className="w-full text-left rounded-xl border border-zinc-800 px-4 py-3 hover:bg-zinc-900"
              onClick={() => void createBot()}
            >
              {t(lang, 'createBot')}
            </button>
            <button type="button" className="w-full text-left rounded-xl border border-zinc-800 px-4 py-3 hover:bg-zinc-900" onClick={() => setMode('group')}>
              {t(lang, 'newGroup')}
            </button>
          </div>
        )}
        {mode === 'bot' && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-semibold">{t(lang, 'createBot')}</h2>
            <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2" placeholder={t(lang, 'name')} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2" placeholder={t(lang, 'jobTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2" rows={3} placeholder={t(lang, 'description')} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}>{t(lang, 'cancel')}</button>
              <button type="button" className="px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--gb-accent)' }} onClick={() => void createBot()}>
                {t(lang, 'createBot')}
              </button>
            </div>
          </div>
        )}
        {mode === 'group' && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-semibold">{t(lang, 'newGroup')}</h2>
            <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>{t(lang, 'groupHint')}</p>
            <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2" placeholder="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {agents.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${on ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
                    onClick={() =>
                      setPicked((p) => (on ? p.filter((x) => x !== a.id) : p.length >= 6 ? p : [...p, a.id]))
                    }
                  >
                    <BotAvatar agent={a} size={22} />
                    <span className="text-[12px]">{displayName(a.name)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}>{t(lang, 'cancel')}</button>
              <button
                type="button"
                disabled={picked.length < 2}
                className="px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                style={{ background: 'var(--gb-accent)' }}
                onClick={() => void createGroup()}
              >
                {t(lang, 'newGroup')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
