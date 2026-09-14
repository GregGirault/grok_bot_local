import type { Agent, Channel, Routine, TeamMember } from '@grok-bot/shared';
import AgentAvatar from './AgentAvatar';
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
  const [tab, setTab] = useState<'computer' | 'routines' | 'channels' | 'members' | 'settings'>(
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

  const tabs = [
    { id: 'computer' as const, label: 'Computer' },
    { id: 'routines' as const, label: 'Routines' },
    { id: 'channels' as const, label: 'Channels' },
    { id: 'members' as const, label: 'Members' },
    { id: 'settings' as const, label: '⚙' },
  ];

  return (
    <aside
      className="w-80 shrink-0 border-l flex flex-col h-full"
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
              Live preview refreshes every 3s from Playwright page or placeholder capture.
            </p>
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
