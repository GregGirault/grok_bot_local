import type { PluginInfo, Settings, SkillInfo } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';

type McpSummary = {
  configPath: string;
  servers: Array<{ name: string; command?: string; url?: string; disabled?: boolean; tools: string[] }>;
  raw: unknown[];
};

export function SettingsPlugins({
  lang,
  s,
  plugins,
  pluginView,
  setPluginView,
  openPlugin,
  setOpenPlugin,
  connectSlug,
  setConnectSlug,
  secret,
  setSecret,
  mcp,
  setMcp,
  mcpRaw,
  setMcpRaw,
  mcpMsg,
  setMcpMsg,
  setPlugins,
  skills,
  setSkills,
}: {
  lang: Lang;
  s: Settings;
  plugins: PluginInfo[];
  pluginView: 'market' | 'yours';
  setPluginView: (v: 'market' | 'yours') => void;
  openPlugin: string | null;
  setOpenPlugin: (v: string | null) => void;
  connectSlug: string | null;
  setConnectSlug: (v: string | null) => void;
  secret: string;
  setSecret: (v: string) => void;
  mcp: McpSummary | null;
  setMcp: (v: McpSummary | null) => void;
  mcpRaw: string;
  setMcpRaw: (v: string) => void;
  mcpMsg: string;
  setMcpMsg: (v: string) => void;
  setPlugins: (v: PluginInfo[]) => void;
  skills: SkillInfo[];
  setSkills: (v: SkillInfo[]) => void;
}) {
  void s;
  void setMcp;
  return (
                <div className="space-y-3">
                  <div className="flex gap-2 text-[12px]">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg ${pluginView === 'market' ? 'bg-zinc-800' : ''}`}
                      onClick={() => setPluginView('market')}
                    >
                      {t(lang, 'marketplace')}
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg ${pluginView === 'yours' ? 'bg-zinc-800' : ''}`}
                      onClick={() => setPluginView('yours')}
                    >
                      {t(lang, 'yours')}
                    </button>
                  </div>
                  <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                    {pluginView === 'market' ? t(lang, 'browseMarketplace') : t(lang, 'yoursHint')}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'localHint')}
                  </p>
                  {(pluginView === 'market' ? plugins : plugins.filter((p) => p.installed)).map((p) => (
                    <div key={p.slug} className="rounded-xl border border-zinc-800 p-3">
                      <div className="flex justify-between gap-3">
                        <button type="button" className="text-left min-w-0" onClick={() => setOpenPlugin(openPlugin === p.slug ? null : p.slug)}>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                            {p.description}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: 'var(--gb-muted)' }}>
                            {p.category} · {t(lang, 'localPlugin')}
                          </div>
                        </button>
                        {p.installed ? (
                          ['files', 'browser', 'terminal'].includes(p.slug) ? (
                            <span className="text-[11px] self-center" style={{ color: 'var(--gb-muted)' }}>
                              {t(lang, 'connected')}
                            </span>
                          ) : (
                            <button type="button" className="text-[12px] self-start" onClick={() => void api.uninstallPlugin(p.slug).then(setPlugins)}>
                              {t(lang, 'removePlugin')}
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1 rounded-lg text-white text-[12px] self-start"
                            style={{ background: 'var(--gb-accent)' }}
                            onClick={() => void api.installPlugin(p.slug).then(setPlugins)}
                          >
                            {t(lang, 'addPlugin')}
                          </button>
                        )}
                      </div>
                      {openPlugin === p.slug && p.installed && (
                        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                          <div className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                            {t(lang, 'toolsLabel')}
                          </div>
                          {p.tools.map((tool) => (
                            <label key={tool.name} className="flex items-center justify-between text-[12px]">
                              <span className="font-mono">{tool.name}</span>
                              <input
                                type="checkbox"
                                checked={tool.enabled}
                                onChange={(e) => void api.togglePluginTool(p.slug, tool.name, e.target.checked).then(setPlugins)}
                              />
                            </label>
                          ))}
                          {p.auth === 'secret' && (
                            <div className="pt-1">
                              {connectSlug === p.slug ? (
                                <form
                                  className="flex gap-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!secret) return;
                                    void api.connectPlugin(p.slug, secret).then((list) => {
                                      setPlugins(list);
                                      setSecret('');
                                      setConnectSlug(null);
                                    });
                                  }}
                                >
                                  <input
                                    type="password"
                                    className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1.5"
                                    value={secret}
                                    onChange={(e) => setSecret(e.target.value)}
                                    placeholder={t(lang, 'secretPrompt')}
                                  />
                                  <button type="submit" className="px-2 py-1 rounded-lg text-white text-[11px]" style={{ background: 'var(--gb-accent)' }}>
                                    {t(lang, 'submitSecret')}
                                  </button>
                                </form>
                              ) : (
                                <button type="button" className="text-[12px]" onClick={() => setConnectSlug(p.slug)}>
                                  {t(lang, 'authenticate')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {pluginView === 'yours' && (
                    <div className="pt-2">
                      <div className="text-[12px] font-medium mb-2">{t(lang, 'privateSkills')}</div>
                      {skills.length === 0 && (
                        <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                          {t(lang, 'none')}
                        </p>
                      )}
                      {skills.map((sk) => (
                        <div key={sk.name} className="rounded-xl border border-zinc-800 p-3 mb-2 flex justify-between">
                          <div>
                            <div>/{sk.name}</div>
                            <div className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
                              {sk.description || sk.preview}
                            </div>
                          </div>
                          <button type="button" className="text-[11px]" onClick={() => void api.deleteSkill(sk.name).then(() => api.listSkills().then(setSkills))}>
                            {t(lang, 'delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <section className="pt-4 space-y-2">
                    <div className="text-[12px] font-medium">{t(lang, 'mcpServers')}</div>
                    <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                      {t(lang, 'mcpHint')}
                    </p>
                    {(mcp?.servers ?? []).length === 0 && (
                      <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                        {t(lang, 'mcpEmpty')}
                      </p>
                    )}
                    {(mcp?.servers ?? []).map((s) => (
                      <label
                        key={s.name}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2 text-[12px]"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{s.name}</span>
                          <span className="block text-[11px] font-mono truncate" style={{ color: 'var(--gb-muted)' }}>
                            {s.command || s.url || '—'}
                            {s.tools.length ? ` · ${s.tools.join(', ')}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span>{t(lang, 'mcpEnabled')}</span>
                          <input
                            type="checkbox"
                            checked={!s.disabled}
                            onChange={(e) =>
                              void api.toggleMcp(s.name, !e.target.checked).then((m) => {
                                setMcp(m);
                                setMcpRaw(JSON.stringify(m.raw ?? m.servers, null, 2));
                              })
                            }
                          />
                        </span>
                      </label>
                    ))}
                    <textarea
                      className="w-full h-36 rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-[11px] font-mono"
                      value={mcpRaw}
                      onChange={(e) => setMcpRaw(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg text-white text-[12px]"
                        style={{ background: 'var(--gb-accent)' }}
                        onClick={() => {
                          try {
                            const servers = JSON.parse(mcpRaw) as unknown[];
                            if (!Array.isArray(servers)) throw new Error(t(lang, 'mcpInvalid'));
                            void api.putMcp(servers).then((m) => {
                              setMcp(m);
                              setMcpRaw(JSON.stringify(m.raw ?? m.servers, null, 2));
                              setMcpMsg(t(lang, 'mcpSaved'));
                              setTimeout(() => setMcpMsg(''), 1600);
                            });
                          } catch {
                            setMcpMsg(t(lang, 'mcpInvalid'));
                          }
                        }}
                      >
                        {t(lang, 'mcpSave')}
                      </button>
                      {mcpMsg && (
                        <span className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                          {mcpMsg}
                        </span>
                      )}
                    </div>
                  </section>
                </div>

  );
}
