import type { Agent, Channel, Routine } from '@grok-bot/shared';
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
  const [draft, setDraft] = useState(agent);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setDraft(agent);
    void api.listRoutines(agent.id).then(setRoutines).catch(() => undefined);
    void api.listChannels().then((c) => setChannels(c.filter((x) => x.memberIds.includes(agent.id))));
  }, [agent]);

  const save = async () => {
    await api.updateAgent(agent.id, {
      name: draft.name,
      title: draft.title,
      description: draft.description,
      systemPrompt: draft.systemPrompt,
      avatarColor: draft.avatarColor,
      avatarShape: draft.avatarShape,
    });
    setSaved('Saved');
    onUpdated();
    setTimeout(() => setSaved(''), 1500);
  };

  const tabs = [
    { id: 'computer' as const, label: 'Computer' },
    { id: 'routines' as const, label: 'Routines' },
    { id: 'channels' as const, label: 'Channels' },
    { id: 'members' as const, label: 'Members' },
    { id: 'settings' as const, label: '⚙' },
  ];

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentAvatar agent={draft} size={36} />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{draft.title}</div>
            <div className="text-[11px] text-zinc-500 truncate">@{draft.name}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-sm px-2 py-1 rounded hover:bg-zinc-800"
        >
          ✕
        </button>
      </div>

      <div className="flex border-b border-zinc-800 px-1 gap-0.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[11px] px-2.5 py-2 whitespace-nowrap border-b-2 transition ${
              tab === t.id
                ? 'border-violet-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'computer' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 aspect-video flex items-center justify-center text-zinc-500 text-xs">
              <div className="text-center px-4">
                <div className="text-2xl mb-2 opacity-40">🖥</div>
                <div>Computer preview</div>
                <div className="text-[11px] mt-1 text-zinc-600">Coming soon — local desktop stream stub</div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              When browser/computer use is active, a live preview of the agent&apos;s desktop appears here.
            </p>
          </div>
        )}

        {tab === 'routines' && (
          <div className="space-y-2">
            {routines.length === 0 ? (
              <Empty label="No routines for this agent" hint="Create some in Routines" />
            ) : (
              routines.map((r) => (
                <div key={r.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                  <div className="font-medium text-xs">{r.name}</div>
                  <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
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
                <div key={c.id} className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                  #{c.name}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'members' && (
          <Empty label="Team members" hint="Multi-user / org members — coming soon" />
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
              <div className="text-[11px] text-zinc-500 mb-1">Avatar color</div>
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
            <label className="block text-[11px] text-zinc-500">
              Shape
              <select
                className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-200"
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
            <label className="block text-[11px] text-zinc-500">
              Notifications
              <select
                className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-200"
                defaultValue="all"
              >
                <option value="all">All messages</option>
                <option value="mentions">Mentions only</option>
                <option value="mute">Muted</option>
              </select>
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => void save()}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium"
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
    <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center">
      <div className="text-zinc-400 text-xs">{label}</div>
      <div className="text-zinc-600 text-[11px] mt-1">{hint}</div>
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
    <label className="block text-[11px] text-zinc-500">
      {label}
      <input
        className={`mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-200 ${
          mono ? 'font-mono' : ''
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
