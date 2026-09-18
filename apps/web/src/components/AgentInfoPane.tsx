import type { Agent, Channel, Routine, TeamMember, TeachSession } from '@grok-bot/shared';
import AgentAvatar from './AgentAvatar';
import CharacterPicker from './CharacterPicker';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';

export default function AgentInfoPane({
  agent,
  onClose,
  onUpdated,
}: {
  agent: Agent;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [tab, setTab] = useState<'computer' | 'teach' | 'routines' | 'channels' | 'members' | 'settings'>(
    'computer'
  );
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState(agent);
  const [notify, setNotify] = useState(agent.notifyOnUpdates !== false);
  const [saved, setSaved] = useState('');
  const [newMember, setNewMember] = useState('');
  const [computerUrl, setComputerUrl] = useState('https://example.com');
  const [computerSelector, setComputerSelector] = useState('');
  const [computerText, setComputerText] = useState('');
  const [computerStatus, setComputerStatus] = useState('');
  const [teachGoal, setTeachGoal] = useState('');
  const [teachSession, setTeachSession] = useState<TeachSession | null>(null);
  const [teachKind, setTeachKind] = useState('click');
  const [teachDetail, setTeachDetail] = useState('');
  const [teachStatus, setTeachStatus] = useState('');

  useEffect(() => {
    setDraft(agent);
    setNotify(agent.notifyOnUpdates !== false);
    void api.listRoutines(agent.id).then(setRoutines).catch(() => undefined);
    void api.listChannels().then((c) => setChannels(c.filter((x) => x.memberIds.includes(agent.id))));
    void api.listMembers().then(setAllMembers).catch(() => undefined);
  }, [agent]);

  useEffect(() => {
    if (tab !== 'computer') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const p = await api.computerPreview();
        if (!cancelled && p.url) setPreviewUrl(p.url);
      } catch {
        // ignore
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [tab]);

  const save = async () => {
    await api.updateAgent(agent.id, {
      name: draft.name,
      title: draft.title,
      description: draft.description,
      systemPrompt: draft.systemPrompt,
      avatarColor: draft.avatarColor,
      avatarShape: draft.avatarShape,
      model: draft.model,
      hfModel: draft.hfModel,
      modelProvider: draft.modelProvider,
      accessory: draft.accessory,
      pinned: draft.pinned,
      notifyOnUpdates: notify,
    });
    setSaved('Saved');
    onUpdated();
    setTimeout(() => setSaved(''), 1500);
  };

  const addMember = async () => {
    if (!newMember.trim()) return;
    const m = await api.createMember({ name: newMember.trim() });
    setAllMembers((prev) => [...prev, m]);
    setMembers((prev) => [...prev, m]);
    setNewMember('');
  };

  const computerAction = async (
    body: Parameters<typeof api.computerAction>[0]
  ) => {
    setComputerStatus('Running…');
    try {
      const result = await api.computerAction(body);
      setComputerStatus(
        typeof result.error === 'string'
          ? result.error
          : typeof result.url === 'string'
            ? result.url
            : 'Done'
      );
      const p = await api.computerPreview();
      if (p.url) setPreviewUrl(p.url);
    } catch (e) {
      setComputerStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const tabs = [
    { id: 'computer' as const, label: 'Computer' },
    { id: 'teach' as const, label: 'Teach' },
    { id: 'routines' as const, label: 'Routines' },
    { id: 'channels' as const, label: 'Channels' },
    { id: 'members' as const, label: 'Members' },
    { id: 'settings' as const, label: '⚙' },
  ];

  return (
    <aside
      className="fixed inset-0 z-50 flex h-full w-full shrink-0 flex-col border-l md:static md:z-auto md:w-80"
      style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--gb-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentAvatar agent={draft} size={36} />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{draft.title}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>
              @{draft.name}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-sm px-2 py-1 rounded hover:bg-zinc-800"
          style={{ color: 'var(--gb-muted)' }}
        >
          ✕
        </button>
      </div>

      <div
        className="flex border-b px-1 gap-0.5 overflow-x-auto"
        style={{ borderColor: 'var(--gb-border)' }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[11px] px-2.5 py-2 whitespace-nowrap border-b-2 transition ${
              tab === t.id ? 'text-zinc-100' : 'border-transparent hover:text-zinc-300'
            }`}
            style={{
              borderColor: tab === t.id ? 'var(--gb-accent)' : 'transparent',
              color: tab === t.id ? undefined : 'var(--gb-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'computer' && (
          <div className="space-y-3">
            <div
              className="rounded-xl border aspect-video flex items-center justify-center overflow-hidden"
              style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-card)' }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Computer preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center px-4" style={{ color: 'var(--gb-muted)' }}>
                  <div className="text-2xl mb-2 opacity-40">🖥</div>
                  <div>Computer preview</div>
                  <div className="text-[11px] mt-1">Polling desktop / browser capture…</div>
                </div>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--gb-muted)' }}>
              Persistent local Chromium profile. Live preview refreshes every 3s.
            </p>
            <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--gb-border)' }}>
              <div className="text-xs font-medium">Manual computer control</div>
              <div className="flex gap-1.5">
                <input
                  value={computerUrl}
                  onChange={(e) => setComputerUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => void computerAction({ action: 'navigate', url: computerUrl })}
                  className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[11px]"
                >
                  Go
                </button>
              </div>
              <input
                value={computerSelector}
                onChange={(e) => setComputerSelector(e.target.value)}
                placeholder="CSS · text=Label · role=button|Name"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-mono"
              />
              <div className="flex gap-1.5">
                <input
                  value={computerText}
                  onChange={(e) => setComputerText(e.target.value)}
                  placeholder="Text to type"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px]"
                />
                <button
                  type="button"
                  disabled={!computerSelector.trim()}
                  onClick={() => void computerAction({ action: 'click', selector: computerSelector })}
                  className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[11px] disabled:opacity-40"
                >
                  Click
                </button>
                <button
                  type="button"
                  disabled={!computerSelector.trim()}
                  onClick={() => void computerAction({ action: 'type', selector: computerSelector, text: computerText })}
                  className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[11px] disabled:opacity-40"
                >
                  Type
                </button>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => void computerAction({ action: 'press', key: 'Enter' })} className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px]">Enter</button>
                <button type="button" onClick={() => void computerAction({ action: 'press', key: 'Escape' })} className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px]">Esc</button>
                <button type="button" onClick={() => void computerAction({ action: 'snapshot' })} className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px]">Snapshot</button>
              </div>
              {computerStatus && <div className="break-all text-[10px]" style={{ color: 'var(--gb-muted)' }}>{computerStatus}</div>}
            </div>
          </div>
        )}
        {tab === 'teach' && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium">Teach this Bot a repeatable workflow</div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
                Record the important actions, then save them as a reusable skill loaded into future conversations.
              </p>
            </div>
            {!teachSession || teachSession.status === 'saved' ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={teachGoal}
                  onChange={(e) => setTeachGoal(e.target.value)}
                  placeholder="Example: Deploy the local Grok Bot release safely"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={!teachGoal.trim()}
                  onClick={() =>
                    void api
                      .startTeach(agent.id, teachGoal.trim())
                      .then((session) => {
                        setTeachSession(session);
                        setTeachStatus('Recording');
                      })
                      .catch((e) => setTeachStatus(e instanceof Error ? e.message : String(e)))
                  }
                  className="rounded-lg bg-violet-700 px-3 py-2 text-xs disabled:opacity-40"
                >
                  Start teaching
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-[11px]">
                  <div className="font-medium">{teachSession.goal}</div>
                  <div className="mt-1" style={{ color: 'var(--gb-muted)' }}>
                    {teachSession.steps.length} recorded step{teachSession.steps.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <select
                    value={teachKind}
                    onChange={(e) => setTeachKind(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-[11px]"
                  >
                    <option value="navigate">navigate</option>
                    <option value="click">click</option>
                    <option value="type">type</option>
                    <option value="shell">shell</option>
                    <option value="file">file</option>
                    <option value="status">status</option>
                  </select>
                  <input
                    value={teachDetail}
                    onChange={(e) => setTeachDetail(e.target.value)}
                    placeholder="Describe the action"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={!teachDetail.trim()}
                    onClick={() =>
                      teachSession &&
                      void api
                        .addTeachStep(teachSession.id, teachKind, teachDetail.trim())
                        .then((session) => {
                          setTeachSession(session);
                          setTeachDetail('');
                        })
                    }
                    className="rounded-lg bg-zinc-800 px-2 py-2 text-[11px] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {teachSession.steps.map((step, index) => (
                    <div key={`${step.at}-${index}`} className="rounded bg-zinc-900 px-2 py-1.5 text-[10px]">
                      <span className="font-mono text-violet-300">{step.kind}</span>{' '}
                      <span style={{ color: 'var(--gb-muted)' }}>{step.detail}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void api
                      .stopTeach(teachSession.id)
                      .then((session) => {
                        setTeachSession(session);
                        setTeachStatus('Skill saved');
                        setTeachGoal('');
                      })
                      .catch((e) => setTeachStatus(e instanceof Error ? e.message : String(e)))
                  }
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-xs"
                >
                  Finish & save skill
                </button>
              </div>
            )}
            {teachStatus && <div className="text-[11px] text-emerald-300">{teachStatus}</div>}
          </div>
        )}

        {tab === 'routines' && (
          <div className="space-y-2">
            {routines.length === 0 ? (
              <Empty label="No routines for this agent" hint="Create some in Routines" />
            ) : (
              routines.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--gb-border)' }}
                >
                  <div className="font-medium text-xs">{r.name}</div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--gb-muted)' }}>
                    {r.cron} · {r.enabled ? 'on' : 'paused'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'channels' && (
          <div className="space-y-2">
            {channels.length === 0 ? (
              <Empty label="Not in any channel" hint="Join from Channels" />
            ) : (
              channels.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: 'var(--gb-border)' }}
                >
                  #{c.name}
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {c.memberIds.map((mid) => (
                      <button
                        key={mid}
                        className="text-[10px] px-1 rounded bg-zinc-800"
                        title="Remove agent from channel"
                        onClick={() =>
                          void api.removeChannelMember(c.id, mid).then(() =>
                            api.listChannels().then((ch) =>
                              setChannels(ch.filter((x) => x.memberIds.includes(agent.id)))
                            )
                          )
                        }
                      >
                        × {mid.slice(0, 6)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-3">
            <p className="text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              Local team members (stub org users) attachable to channels.
            </p>
            <ul className="space-y-1">
              {(members.length ? members : allMembers).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs"
                  style={{ borderColor: 'var(--gb-border)' }}
                >
                  <span>
                    {m.name}{' '}
                    <span style={{ color: 'var(--gb-muted)' }}>· {m.role}</span>
                  </span>
                  <button
                    className="text-red-400"
                    onClick={() =>
                      void api.deleteMember(m.id).then(() =>
                        api.listMembers().then(setAllMembers)
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs bg-zinc-900 border-zinc-700"
                placeholder="New member name"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
              />
              <button
                onClick={() => void addMember()}
                className="px-2 py-1 rounded text-xs text-white"
                style={{ background: 'var(--gb-accent)' }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] mb-2" style={{ color: 'var(--gb-muted)' }}>
                Official Grok Bot character
              </div>
              <CharacterPicker
                agent={{ name: draft.name, title: draft.title, accessory: draft.accessory || 'none' }}
                color={draft.avatarColor}
                shape={draft.avatarShape}
                onColor={(avatarColor) => setDraft({ ...draft, avatarColor })}
                onShape={(avatarShape) => setDraft({ ...draft, avatarShape })}
              />
            </div>
            <label className="block text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              Ollama model
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-mono"
                value={draft.model || ''}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="granite4:micro"
              />
            </label>
            <label className="block text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              Hugging Face fallback model
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-mono"
                value={draft.hfModel || ''}
                onChange={(e) => setDraft({ ...draft, hfModel: e.target.value })}
                placeholder="hf.co/Qwen/..."
              />
            </label>
            <Field label="Name (slug)" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} mono />
            <Field label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <Field
              label="Description"
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
            />
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--gb-muted)' }}>
                Avatar color
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, avatarColor: c })}
                      className={`h-6 w-6 rounded-full border-2 ${
                        draft.avatarColor === c ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  )
                )}
              </div>
            </div>
            <label className="block text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              Shape
              <select
                className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm"
                value={draft.avatarShape}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    avatarShape: e.target.value as Agent['avatarShape'],
                  })
                }
              >
                <option value="circle">circle</option>
                <option value="rounded">rounded</option>
                <option value="square">square</option>
                <option value="blob">blob</option>
                <option value="pebble">pebble</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={Boolean(draft.pinned)}
                onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
              />
              Pin Bot in sidebar
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Notify on updates (routines / tasks post to chat)
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => void save()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--gb-accent)' }}
              >
                Save
              </button>
              {saved && <span className="text-xs text-emerald-400">{saved}</span>}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Empty({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-4 py-8 text-center"
      style={{ borderColor: 'var(--gb-border)' }}
    >
      <div className="text-xs" style={{ color: 'var(--gb-muted)' }}>
        {label}
      </div>
      <div className="text-[11px] mt-1 opacity-60">{hint}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block text-[11px]" style={{ color: 'var(--gb-muted)' }}>
      {label}
      <input
        className={`mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm ${
          mono ? 'font-mono' : ''
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
