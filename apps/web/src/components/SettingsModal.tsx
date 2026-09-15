import { useEffect, useState } from 'react';
import type { AutoReviewRule, HealthStatus, PluginInfo, Settings, SkillInfo, TeamMember } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang, applyTheme, applyAccent, saveLang } from '../lib/i18n';
import { IosSettingsHome } from './SettingsIos';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsPlugins } from './SettingsPlugins';

type Tab = 'general' | 'plugins' | 'usage' | 'team' | 'beta';

type McpSummary = {
  configPath: string;
  servers: Array<{ name: string; command?: string; url?: string; disabled?: boolean; tools: string[] }>;
  raw: unknown[];
};

export default function SettingsModal({
  lang,
  health,
  onClose,
  onLang,
  initialTab = 'general',
  phone = false,
  account = null,
  usage: usageProp,
}: {
  lang: Lang;
  health: HealthStatus | null;
  onClose: () => void;
  onLang: (l: Lang) => void;
  initialTab?: Tab;
  phone?: boolean;
  account?: TeamMember | null;
  usage?: { messages: number; tools: number; weekStart: string };
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [iosHome, setIosHome] = useState(phone);
  const [s, setS] = useState<Settings | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [pluginView, setPluginView] = useState<'market' | 'yours'>('market');
  const [usage, setUsage] = useState({ messages: 0, tools: 0, weekStart: '' });
  const [ruleKind, setRuleKind] = useState<AutoReviewRule['kind']>('require');
  const [rulePat, setRulePat] = useState('');
  const [busy, setBusy] = useState('');
  const [connectSlug, setConnectSlug] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [team, setTeam] = useState<{ source: string; applied: boolean; appliedAt: string | null } | null>(null);
  const [openPlugin, setOpenPlugin] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [mcp, setMcp] = useState<McpSummary | null>(null);
  const [mcpRaw, setMcpRaw] = useState('[]');
  const [mcpMsg, setMcpMsg] = useState('');

  useEffect(() => {
    setTab(initialTab);
    if (phone && initialTab === 'general') setIosHome(true);
    else if (phone) setIosHome(false);
  }, [initialTab, phone]);

  const load = () => {
    void api.getSettings().then(setS);
    void api.listSkills().then(setSkills);
    void api.listPlugins().then(setPlugins);
    void api.usage().then(setUsage);
    void api.teamSetup().then(setTeam);
    void api.listModels().then((r) => setModels(r.models ?? []));
    void api.getMcp().then((m) => {
      setMcp(m);
      setMcpRaw(JSON.stringify(m.raw ?? m.servers, null, 2));
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = (patch: Partial<Settings>) => {
    void api.putSettings(patch).then((next) => {
      setS(next);
      if (next.theme) applyTheme(next.theme);
      if (next.accentColor) applyAccent(next.accentColor);
      if (next.language) {
        saveLang(next.language);
        onLang(next.language);
      }
    });
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'general', label: t(lang, 'general') },
    { id: 'plugins', label: t(lang, 'plugins') },
    { id: 'usage', label: t(lang, 'usageBilling') },
    { id: 'team', label: t(lang, 'teamSetup') },
    { id: 'beta', label: t(lang, 'beta') },
  ];

  const usageCount = usageProp?.messages ?? usage.messages;
  const usagePct = Math.min(100, Math.max(0, Math.round((usageCount / 40) * 100)));
  const ownerName = account?.name || s?.accountName || '3pas sage .';
  const ownerEmail = account?.email || s?.accountEmail || 'yakary88@gmail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 p-0 md:p-4" onClick={onClose}>
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden border-0 shadow-2xl md:h-[min(680px,90vh)] md:max-w-3xl md:flex-row md:rounded-2xl md:border"
        style={{ background: phone ? '#000' : 'var(--gb-panel)', borderColor: 'var(--gb-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {phone && iosHome && s ? (
          <IosSettingsHome
            lang={lang}
            s={s}
            ownerName={ownerName}
            ownerEmail={ownerEmail}
            usagePct={usagePct}
            onClose={onClose}
            onOpen={(next) => {
              setTab(next);
              setIosHome(false);
            }}
            onSave={save}
          />
        ) : (
          <>
        <nav
          className={`${phone ? 'hidden' : 'flex'} shrink-0 overflow-x-auto border-b p-2 md:block md:w-48 md:border-b-0 md:border-r gb-safe-top`}
          style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-card)' }}
        >
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-[12px] whitespace-nowrap ${tab === tb.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
            >
              {tb.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 p-5 overflow-y-auto text-[13px]" style={{ background: 'var(--gb-panel)' }}>
          <div className="flex justify-between mb-4">
            {phone ? (
              <button type="button" className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800" onClick={() => setIosHome(true)} aria-label={t(lang, 'back')}>
                ←
              </button>
            ) : (
              <h2 className="text-[15px] font-semibold">{t(lang, 'settings')}</h2>
            )}
            <button type="button" onClick={onClose} style={{ color: 'var(--gb-muted)' }}>
              {t(lang, 'close')}
            </button>
          </div>
          {!s ? (
            <p style={{ color: 'var(--gb-muted)' }}>Chargement…</p>
          ) : (
            <>
              {tab === 'general' && (
                <SettingsGeneral
                  lang={lang}
                  s={s}
                  health={health}
                  models={models}
                  save={save}
                  load={load}
                  ruleKind={ruleKind}
                  setRuleKind={setRuleKind}
                  rulePat={rulePat}
                  setRulePat={setRulePat}
                />
              )}
              {tab === 'plugins' && (
                <SettingsPlugins
                  lang={lang}
                  s={s}
                  plugins={plugins}
                  pluginView={pluginView}
                  setPluginView={setPluginView}
                  openPlugin={openPlugin}
                  setOpenPlugin={setOpenPlugin}
                  connectSlug={connectSlug}
                  setConnectSlug={setConnectSlug}
                  secret={secret}
                  setSecret={setSecret}
                  mcp={mcp}
                  setMcp={setMcp}
                  mcpRaw={mcpRaw}
                  setMcpRaw={setMcpRaw}
                  mcpMsg={mcpMsg}
                  setMcpMsg={setMcpMsg}
                  setPlugins={setPlugins}
                  skills={skills}
                  setSkills={setSkills}
                />
              )}
              {tab === 'usage' && (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'weeklyIncluded')}
                  </div>
                  <div className="rounded-xl border border-zinc-800 p-4">
                    <div className="text-[22px] font-semibold">{usage.messages}</div>
                    <div className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                      messages
                    </div>
                    <div className="mt-3 text-[22px] font-semibold">{usage.tools}</div>
                    <div className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                      outils
                    </div>
                    <p className="text-[11px] mt-3" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'quotaLocal')} {usage.weekStart ? `· ${usage.weekStart}` : ''}
                    </p>
                  </div>
                  <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'onDemand')}
                  </p>
                </div>
              )}
              {tab === 'team' && (
                <div className="space-y-3">
                  <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'teamSetupHint')}
                  </p>
                  <pre className="text-[11px] whitespace-pre-wrap rounded-xl border border-zinc-800 p-3 max-h-48 overflow-auto">
                    {team?.source || '—'}
                  </pre>
                  <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                    {team?.applied ? `TEAM.md · ${team.appliedAt}` : 'Pas encore appliquée'}
                  </p>
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg bg-zinc-800"
                    onClick={() => void api.reinstallTeamSetup().then(() => load())}
                  >
                    {t(lang, 'reinstallSetup')}
                  </button>
                </div>
              )}
              {tab === 'beta' && (
                <div className="space-y-3">
                  <p style={{ color: 'var(--gb-muted)' }}>{t(lang, 'betaHint')}</p>
                  <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                    {busy || `${t(lang, 'version')} ${health?.version}`}
                  </p>
                  <button type="button" className="w-full py-2 rounded-lg bg-zinc-800" onClick={() => setBusy(`${t(lang, 'upToDate')} · ${health?.version}`)}>
                    {t(lang, 'checkUpdates')}
                  </button>
                  <button type="button" className="w-full py-2 rounded-lg bg-zinc-800" onClick={() => setBusy(`${t(lang, 'upToDate')} · ${health?.version}`)}>
                    {t(lang, 'restartToUpdate')}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg bg-zinc-800"
                    onClick={() => void api.computerUpdate().then(() => setBusy(t(lang, 'updateComputer')))}
                  >
                    {t(lang, 'updateComputer')}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg bg-zinc-800"
                    onClick={() => void api.computerRecover().then(() => setBusy(t(lang, 'recoverComputer')))}
                  >
                    {t(lang, 'recoverComputer')}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg bg-zinc-800 text-amber-200"
                    onClick={() => void api.computerReset().then(() => setBusy(t(lang, 'resetComputer')))}
                  >
                    {t(lang, 'resetComputer')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
