import type { AutoReviewRule, HealthStatus, Settings } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';

export function SettingsGeneral({
  lang,
  s,
  health,
  models,
  save,
  load,
  ruleKind,
  setRuleKind,
  rulePat,
  setRulePat,
}: {
  lang: Lang;
  s: Settings;
  health: HealthStatus | null;
  models: string[];
  save: (patch: Partial<Settings>) => void;
  load: () => void;
  ruleKind: AutoReviewRule['kind'];
  setRuleKind: (v: AutoReviewRule['kind']) => void;
  rulePat: string;
  setRulePat: (v: string) => void;
}) {
  return (
                <div className="space-y-6">
                  <section>
                    <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'account')}
                    </div>
                    <p>{s.accountName || 'Gregory'}</p>
                    <p className="text-[12px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'version')} {health?.version} · {health?.llmMode === 'local' ? t(lang, 'localMode') : t(lang, 'online')}
                    </p>
                    {s.hostFacts && s.hostFacts.source !== 'server' ? (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                        PC : {s.hostFacts.osLabel || s.hostFacts.platform}
                        {s.hostFacts.cpuCount ? ` · ${s.hostFacts.cpuCount} cœurs` : ''}
                        {s.hostFacts.totalMemGb ? ` · ${s.hostFacts.totalMemGb} Go RAM` : s.hostFacts.deviceMemoryGb ? ` · ~${s.hostFacts.deviceMemoryGb} Go RAM` : ''}
                        {s.hostFacts.gpu ? ` · ${s.hostFacts.gpu}` : ''}
                      </p>
                    ) : (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                        Ouvre Grok Bot sur le PC (pas le téléphone) pour enregistrer CPU / RAM / GPU.
                      </p>
                    )}
                    <p className="text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'mobileApps')}
                    </p>
                  </section>
                  <section>
                    <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'appearance')}
                    </div>
                    <select
                      className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                      value={s.theme}
                      onChange={(e) => save({ theme: e.target.value as Settings['theme'] })}
                    >
                      <option value="system">{t(lang, 'followSystem')}</option>
                      <option value="light">{t(lang, 'light')}</option>
                      <option value="dark">{t(lang, 'dark')}</option>
                    </select>
                    <label className="block mt-3 text-[12px]">
                      {t(lang, 'language')}
                      <select
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.language}
                        onChange={(e) => save({ language: e.target.value as Lang })}
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="block mt-3 text-[12px]">
                      {t(lang, 'modelDefault')}
                      <input
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        list="gb-settings-models"
                        value={s.defaultModel}
                        onChange={(e) => save({ defaultModel: e.target.value })}
                      />
                      <datalist id="gb-settings-models">
                        {models.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </label>
                    <label className="block mt-3 text-[12px]">
                      {t(lang, 'hfToken')}
                      <input
                        type="password"
                        autoComplete="off"
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.huggingfaceToken ?? ''}
                        placeholder="hf_…"
                        onChange={(e) => save({ huggingfaceToken: e.target.value })}
                      />
                      <span className="block text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                        {t(lang, 'hfTokenHint')}
                      </span>
                    </label>
                    <label className="block mt-3 text-[12px]">
                      {t(lang, 'geminiKey')}
                      <input
                        type="password"
                        autoComplete="off"
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.geminiApiKey ?? ''}
                        placeholder="AIza…"
                        onChange={(e) => save({ geminiApiKey: e.target.value })}
                      />
                      <span className="block text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                        {t(lang, 'geminiHint')}
                      </span>
                    </label>
                  </section>
                  <section>
                    <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'agent')}
                    </div>
                    <label className="block">
                      {t(lang, 'timezone')}
                      <input
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.timezone ?? 'Europe/Paris'}
                        disabled={s.timezoneAuto !== false}
                        onChange={(e) => save({ timezone: e.target.value, timezoneAuto: false })}
                      />
                    </label>
                    <label className="flex items-center justify-between mt-3 text-[13px]">
                      <span>
                        <span className="block">{t(lang, 'timezoneAuto')}</span>
                        <span className="block text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                          {t(lang, 'timezoneAutoHint')}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={s.timezoneAuto !== false}
                        onChange={(e) =>
                          save({
                            timezoneAuto: e.target.checked,
                            timezone: e.target.checked
                              ? Intl.DateTimeFormat().resolvedOptions().timeZone
                              : s.timezone,
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between mt-3 text-[13px]">
                      <span>{t(lang, 'notifications')}</span>
                      <input
                        type="checkbox"
                        checked={s.notificationsEnabled !== false}
                        onChange={(e) => save({ notificationsEnabled: e.target.checked })}
                      />
                    </label>
                    <label className="block mt-3">
                      {t(lang, 'localComputer')}
                      <select
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.localComputerPolicy}
                        onChange={(e) => save({ localComputerPolicy: e.target.value as Settings['localComputerPolicy'] })}
                      >
                        <option value="ask">{t(lang, 'askEveryTime')}</option>
                        <option value="always">{t(lang, 'alwaysAllow')}</option>
                        <option value="never">{t(lang, 'neverAllow')}</option>
                      </select>
                    </label>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'localComputerHint')}
                    </p>
                  </section>
                  <section>
                    <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'autoReview')}
                    </div>
                    <p className="text-[12px] mb-2" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'autoReviewRequire')}
                    </p>
                    {(s.autoReviewRules ?? []).map((r) => (
                      <div key={r.id} className="flex justify-between rounded-xl border border-zinc-800 p-3 mb-2">
                        <div>
                          <div className="text-[12px] font-medium">{r.kind === 'require' ? t(lang, 'requireApproval') : t(lang, 'allowRule')}</div>
                          <div className="text-[11px] font-mono" style={{ color: 'var(--gb-muted)' }}>
                            {r.toolName ? `${r.toolName} · ` : ''}
                            {r.pattern}
                          </div>
                        </div>
                        <button type="button" onClick={() => void api.deleteAutoReview(r.id).then(() => load())}>
                          {t(lang, 'delete')}
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <select
                        className="rounded-lg bg-zinc-900 border border-zinc-800 px-2"
                        value={ruleKind}
                        onChange={(e) => setRuleKind(e.target.value as AutoReviewRule['kind'])}
                      >
                        <option value="require">{t(lang, 'requireApproval')}</option>
                        <option value="allow">{t(lang, 'allowRule')}</option>
                      </select>
                      <input
                        className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5"
                        placeholder="send_mail"
                        value={rulePat}
                        onChange={(e) => setRulePat(e.target.value)}
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg text-white text-[12px]"
                        style={{ background: 'var(--gb-accent)' }}
                        onClick={() => {
                          if (!rulePat.trim()) return;
                          void api.addAutoReview({ id: '', kind: ruleKind, pattern: rulePat.trim() }).then(() => {
                            setRulePat('');
                            load();
                          });
                        }}
                      >
                        {t(lang, 'addRule')}
                      </button>
                    </div>
                    <label className="flex items-center justify-between mt-4 text-[13px]">
                      <span>{s.autoReviewEnforced === false ? t(lang, 'autoReviewOff') : t(lang, 'autoReviewOn')}</span>
                      <input
                        type="checkbox"
                        checked={s.autoReviewEnforced !== false}
                        onChange={(e) => save({ autoReviewEnforced: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between mt-3 text-[13px]">
                      <span>{t(lang, 'cloudAgents')}</span>
                      <input
                        type="checkbox"
                        checked={s.allowCloudAgents !== false}
                        onChange={(e) => save({ allowCloudAgents: e.target.checked })}
                      />
                    </label>
                    <p className="mt-3 text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'noPublish')}
                    </p>
                    <label className="block mt-3">
                      {t(lang, 'networkMode')}
                      <select
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2"
                        value={s.networkMode ?? 'allow-all'}
                        onChange={(e) => save({ networkMode: e.target.value as Settings['networkMode'] })}
                      >
                        <option value="allow-all">{t(lang, 'allowAll')}</option>
                        <option value="allowlist">{t(lang, 'allowlist')}</option>
                      </select>
                    </label>
                    {(s.networkMode ?? 'allow-all') === 'allowlist' && (
                      <label className="block mt-3 text-[12px]">
                        {t(lang, 'networkAllowlist')}
                        <input
                          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 font-mono"
                          value={(s.networkAllowlist ?? []).join(', ')}
                          onChange={(e) =>
                            save({
                              networkAllowlist: e.target.value
                                .split(',')
                                .map((x) => x.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="example.com, docs.x.ai"
                        />
                      </label>
                    )}
                    <label className="flex items-center justify-between mt-3 text-[13px]">
                      <span>{t(lang, 'actionRecording')}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(s.actionRecording)}
                        onChange={(e) => save({ actionRecording: e.target.checked })}
                      />
                    </label>
                    {s.actionRecording && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                        {t(lang, 'recordingOn')}
                      </p>
                    )}
                  </section>
                </div>

  );
}
