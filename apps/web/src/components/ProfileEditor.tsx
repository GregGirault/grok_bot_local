import { useEffect, useState } from 'react';
import type { Agent, AvatarShape, ModelProvider, Routine } from '@grok-bot/shared';
import { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_SHAPE, displayName, normalizeAvatarShape, normalizeModelProvider } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import CharacterPicker from './CharacterPicker';
import { BackIcon, ChevronIcon, InstructionsIcon, MoreIcon, ShareIcon } from './Icons';

export default function ProfileEditor({
  agent,
  lang,
  phone,
  onClose,
  onUpdated,
  onDelete,
}: {
  agent: Agent;
  lang: Lang;
  phone: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDelete: () => void;
}) {
  const [page, setPage] = useState<'main' | 'instructions'>('main');
  const [name, setName] = useState(agent.name);
  const [title, setTitle] = useState(agent.title);
  const [color, setColor] = useState(agent.avatarColor);
  const [shape, setShape] = useState<AvatarShape>(normalizeAvatarShape(agent.avatarShape));
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [model, setModel] = useState(agent.model);
  const [hfModel, setHfModel] = useState(agent.hfModel);
  const [provider, setProvider] = useState<ModelProvider>(normalizeModelProvider(agent.modelProvider));
  const [models, setModels] = useState<string[]>([]);
  const [hfModels, setHfModels] = useState<string[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [menu, setMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setName(agent.name);
    setTitle(agent.title);
    setColor(agent.avatarColor);
    setShape(normalizeAvatarShape(agent.avatarShape));
    setPrompt(agent.systemPrompt);
    setModel(agent.model);
    setHfModel(agent.hfModel);
    setProvider(normalizeModelProvider(agent.modelProvider));
  }, [agent]);

  useEffect(() => {
    void api.listRoutines(agent.id).then(setRoutines);
  }, [agent.id]);

  useEffect(() => {
    void api.listModels().then((r) => {
      setModels(r.models ?? []);
      setHfModels(r.huggingface ?? []);
    });
  }, []);

  const persist = (patch: {
    name?: string;
    title?: string;
    avatarColor?: string;
    avatarShape?: AvatarShape;
    systemPrompt?: string;
    model?: string;
    hfModel?: string;
    modelProvider?: ModelProvider;
    notifyOnUpdates?: boolean;
  }) => {
    void api.updateAgent(agent.id, patch).then(onUpdated);
  };

  const share = () => {
    void api.shareAgent(agent.id).then((r) => {
      const url = `${window.location.origin}${r.url}`;
      setShareUrl(url);
      void navigator.clipboard.writeText(url);
    });
  };

  const draft = { ...agent, name, title, avatarColor: color, avatarShape: shape };

  if (page === 'instructions') {
    return (
      <div className={shellClass(phone)} style={{ background: 'var(--gb-bg)', borderColor: 'var(--gb-border)' }}>
        <header className="h-12 px-2 flex items-center gap-1 shrink-0 gb-safe-top">
          <button type="button" className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800" onClick={() => setPage('main')}>
            <BackIcon />
          </button>
          <div className="flex-1 text-center text-[15px] font-semibold pr-9">{t(lang, 'instructions')}</div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <textarea
            className="w-full min-h-[50vh] rounded-2xl bg-zinc-900 border border-zinc-800 px-3 py-3 text-[14px] leading-relaxed"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => persist({ systemPrompt: prompt })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass(phone)} style={{ background: 'var(--gb-bg)', borderColor: 'var(--gb-border)' }}>
      <header className="h-12 px-2 flex items-center justify-between shrink-0 gb-safe-top relative">
        <button type="button" className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800" onClick={onClose} aria-label={t(lang, 'back')}>
          <BackIcon />
        </button>
        <div className="flex items-center gap-1">
          <button type="button" className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800" onClick={share} aria-label={t(lang, 'shareBot')}>
            <ShareIcon />
          </button>
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800"
            onClick={() => setMenu((v) => !v)}
            aria-label={t(lang, 'delete')}
          >
            <MoreIcon />
          </button>
        </div>
        {menu && (
          <div className="absolute right-2 top-12 z-20 min-w-[180px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 text-[13px]">
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-zinc-900" onClick={() => { share(); setMenu(false); }}>
              {t(lang, 'shareBot')}
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-zinc-900 text-red-400"
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              {t(lang, 'delete')}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="flex justify-center py-5">
          <BotAvatar agent={draft} size={88} staticPreview />
        </div>

        <input
          className="w-full text-center text-[17px] font-semibold rounded-2xl bg-[#2c2c2e] px-3 py-3 mb-2 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== agent.name) persist({ name: next });
          }}
        />
        <input
          className="w-full text-center text-[14px] rounded-2xl bg-transparent px-3 py-2 mb-6 outline-none"
          style={{ color: 'var(--gb-muted)' }}
          placeholder={t(lang, 'titleOptional')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => persist({ title: title.trim() })}
        />

        <label className="block mb-3">
          <span className="block text-[12px] mb-1 px-1" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'modelProvider')}
          </span>
          <select
            className="w-full text-center text-[13px] rounded-2xl bg-[#2c2c2e] px-3 py-3 outline-none"
            value={provider}
            onChange={(e) => {
              const next = normalizeModelProvider(e.target.value);
              setProvider(next);
              persist({ modelProvider: next });
            }}
          >
            <option value="ollama">{t(lang, 'providerOllama')}</option>
            <option value="huggingface">{t(lang, 'providerHf')}</option>
          </select>
        </label>
        <label className="block mb-3">
          <span className="block text-[12px] mb-1 px-1" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'model')}
          </span>
          <input
            className="w-full text-center text-[13px] rounded-2xl bg-[#2c2c2e] px-3 py-3 outline-none"
            list="gb-ollama-models"
            value={model}
            placeholder={t(lang, 'modelDefault')}
            onChange={(e) => setModel(e.target.value)}
            onBlur={() => persist({ model: model.trim() })}
          />
          <datalist id="gb-ollama-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block mb-6">
          <span className="block text-[12px] mb-1 px-1" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'hfModel')}
          </span>
          <input
            className="w-full text-center text-[13px] rounded-2xl bg-[#2c2c2e] px-3 py-3 outline-none"
            list="gb-hf-models"
            value={hfModel}
            placeholder="Qwen/Qwen3-32B:fastest"
            onChange={(e) => setHfModel(e.target.value)}
            onBlur={() => persist({ hfModel: hfModel.trim() })}
          />
          <datalist id="gb-hf-models">
            {hfModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <span className="block text-[11px] mt-1 px-1" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'modelHint')}
          </span>
        </label>

        <div className="text-[12px] mb-2 px-1" style={{ color: 'var(--gb-muted)' }}>
          {t(lang, 'character')}
        </div>
        <div className="rounded-2xl bg-[#1c1c1e] p-4 mb-2">
          <CharacterPicker
            agent={draft}
            color={color}
            shape={shape}
            onColor={(c) => {
              setColor(c);
              persist({ avatarColor: c });
            }}
            onShape={(s) => {
              setShape(s);
              persist({ avatarShape: s });
            }}
          />
          <button
            type="button"
            className="w-full text-left text-[15px] pt-4 mt-3 border-t border-white/10"
            onClick={() => {
              setShape(DEFAULT_AVATAR_SHAPE);
              setColor(DEFAULT_AVATAR_COLOR);
              persist({ avatarShape: DEFAULT_AVATAR_SHAPE, avatarColor: DEFAULT_AVATAR_COLOR });
            }}
          >
            {t(lang, 'resetDefaults')}
          </button>
        </div>
        <p className="text-[12px] px-1 mb-6" style={{ color: 'var(--gb-muted)' }}>
          {t(lang, 'brandLook')}
        </p>

        <button
          type="button"
          className="w-full rounded-2xl bg-[#1c1c1e] px-3 py-3.5 flex items-center gap-3 mb-6"
          onClick={() => setPage('instructions')}
        >
          <span className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center" style={{ color: 'var(--gb-muted)' }}>
            <InstructionsIcon />
          </span>
          <span className="flex-1 text-left text-[16px]">{t(lang, 'instructions')}</span>
          <span style={{ color: 'var(--gb-muted)' }}>
            <ChevronIcon />
          </span>
        </button>

        <button
          type="button"
          className="w-full rounded-2xl bg-[#1c1c1e] px-4 py-3.5 flex items-center justify-between mb-6"
          onClick={() => persist({ notifyOnUpdates: !agent.notifyOnUpdates })}
        >
          <span className="text-[16px]">{t(lang, 'notifications')}</span>
          <span className={`gb-toggle ${agent.notifyOnUpdates ? 'on' : ''}`} />
        </button>

        <div className="text-[12px] mb-2 px-1" style={{ color: 'var(--gb-muted)' }}>
          {t(lang, 'routines')}
        </div>
        <div className="rounded-2xl bg-[#1c1c1e] px-4 py-4 text-[14px]" style={{ color: 'var(--gb-muted)' }}>
          {routines.length === 0
            ? t(lang, 'noRoutinesYet')
            : routines.map((r) => (
                <div key={r.id} className="text-[15px] text-zinc-100 py-1">
                  {r.name}
                </div>
              ))}
        </div>
        {shareUrl ? (
          <p className="text-[11px] mt-3 break-all" style={{ color: 'var(--gb-muted)' }}>
            {shareUrl}
          </p>
        ) : null}
        <p className="text-[11px] mt-6 text-center" style={{ color: 'var(--gb-muted)' }}>
          {displayName(agent.name)} · {t(lang, 'localHint')}
        </p>
      </div>
    </div>
  );
}

function shellClass(phone: boolean): string {
  return phone
    ? 'fixed inset-0 z-40 flex flex-col'
    : 'absolute inset-x-0 top-12 bottom-0 z-30 md:left-0 md:right-auto md:w-[400px] flex flex-col rounded-none border-r border-zinc-800 shadow-2xl';
}
