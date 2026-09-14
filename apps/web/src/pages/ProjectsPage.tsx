import { useEffect, useState } from 'react';
import type { Project, MemoryEntry, Agent } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [mem, setMem] = useState<MemoryEntry[]>([]);
  const [form, setForm] = useState({ slug: '', name: '', path: '', description: '' });
  const [memForm, setMemForm] = useState({ key: '', value: '', agentId: '' });

  const refresh = async () => {
    const [p, a] = await Promise.all([api.listProjects(), api.listAgents()]);
    setProjects(p);
    setAgents(a);
    setMemForm((f) => ({ ...f, agentId: f.agentId || a[0]?.id || '' }));
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selected) {
      setMem([]);
      return;
    }
    void api.listMemory(undefined, selected.id).then(setMem);
  }, [selected]);

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Projects</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--gb-muted)' }}>
        Project folders with scoped memory
      </p>

      <ul className="space-y-2 mb-6">
        {projects.length === 0 && (
          <li className="text-sm" style={{ color: 'var(--gb-muted)' }}>
            No projects yet.
          </li>
        )}
        {projects.map((p) => (
          <li
            key={p.id}
            className={`rounded-xl border px-4 py-3 cursor-pointer ${
              selected?.id === p.id ? 'border-violet-500' : ''
            }`}
            style={{ borderColor: selected?.id === p.id ? undefined : 'var(--gb-border)' }}
            onClick={() => setSelected(p)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-[11px] font-mono" style={{ color: 'var(--gb-muted)' }}>
                  {p.slug} · {p.path || '(no path)'}
                </div>
                {p.description && (
                  <div className="text-xs mt-1" style={{ color: 'var(--gb-muted)' }}>
                    {p.description}
                  </div>
                )}
              </div>
              <button
                className="text-[11px] text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  void api.deleteProject(p.id).then(() => {
                    if (selected?.id === p.id) setSelected(null);
                    refresh();
                  });
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="rounded-xl border p-4 space-y-2 mb-8"
        style={{ borderColor: 'var(--gb-border)' }}
      >
        <div className="text-sm font-medium">New project</div>
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs font-mono"
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs font-mono"
          placeholder="Path"
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
        />
        <input
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button
          className="px-3 py-1.5 rounded-lg text-xs text-white"
          style={{ background: 'var(--gb-accent)' }}
          onClick={async () => {
            if (!form.slug.trim() || !form.name.trim()) return;
            await api.createProject(form);
            setForm({ slug: '', name: '', path: '', description: '' });
            await refresh();
          }}
        >
          Create
        </button>
      </div>

      {selected && (
        <div>
          <h2 className="text-sm font-semibold mb-2">
            Memory · {selected.name}
          </h2>
          <ul className="space-y-1 mb-3">
            {mem.map((m) => (
              <li
                key={m.id}
                className="text-xs rounded border px-2 py-1.5 font-mono"
                style={{ borderColor: 'var(--gb-border)' }}
              >
                [{m.tier}] {m.key}: {m.value}
              </li>
            ))}
            {mem.length === 0 && (
              <li className="text-xs" style={{ color: 'var(--gb-muted)' }}>
                No project memory yet.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs"
              value={memForm.agentId}
              onChange={(e) => setMemForm({ ...memForm, agentId: e.target.value })}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.name}
                </option>
              ))}
            </select>
            <input
              className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs"
              placeholder="key"
              value={memForm.key}
              onChange={(e) => setMemForm({ ...memForm, key: e.target.value })}
            />
            <input
              className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs"
              placeholder="value"
              value={memForm.value}
              onChange={(e) => setMemForm({ ...memForm, value: e.target.value })}
            />
            <button
              className="px-2 py-1 rounded text-xs text-white"
              style={{ background: 'var(--gb-accent)' }}
              onClick={async () => {
                if (!memForm.agentId || !memForm.key.trim()) return;
                await api.addMemory({
                  agentId: memForm.agentId,
                  key: memForm.key.trim(),
                  value: memForm.value,
                  scope: 'project',
                  projectId: selected.id,
                });
                setMemForm((f) => ({ ...f, key: '', value: '' }));
                setMem(await api.listMemory(undefined, selected.id));
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
