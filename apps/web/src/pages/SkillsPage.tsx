import { useEffect, useState } from 'react';
import type { SkillInfo } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [editing, setEditing] = useState<{ name: string; content: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');

  const refresh = () => void api.listSkills().then(setSkills).catch(console.error);

  useEffect(() => {
    refresh();
  }, []);

  const openEdit = async (name: string) => {
    const s = await api.getSkill(name);
    setEditing({ name: s.name, content: s.content });
    setCreating(false);
  };

  const save = async () => {
    if (!editing) return;
    await api.saveSkill(editing.name, editing.content);
    setStatus('Saved');
    setEditing(null);
    refresh();
    setTimeout(() => setStatus(''), 1200);
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Skills</h1>
        <button
          className="text-xs px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'var(--gb-accent)' }}
          onClick={() => {
            setCreating(true);
            setEditing({
              name: 'new-skill',
              content: `---\nname: new-skill\ndescription: Describe this skill\n---\n\n# New skill\n\nWrite guidance for the agent here.\n`,
            });
          }}
        >
          + New skill
        </button>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--gb-muted)' }}>
        Markdown skills with YAML frontmatter · in-UI authoring
      </p>
      {status && <p className="text-xs text-emerald-400 mb-2">{status}</p>}

      {editing && (
        <div
          className="mb-6 rounded-xl border p-4 space-y-3"
          style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-card)' }}
        >
          <div className="flex items-center gap-2">
            <input
              className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1 text-sm font-mono"
              value={editing.name}
              disabled={!creating}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <button
              onClick={() => void save()}
              className="px-3 py-1 rounded-lg text-xs text-white"
              style={{ background: 'var(--gb-accent)' }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-3 py-1 rounded-lg text-xs bg-zinc-800"
            >
              Cancel
            </button>
          </div>
          <textarea
            className="w-full h-64 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono"
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          />
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--gb-muted)' }}>
          No skills found. Add <code>*.md</code> files under skills/ or create one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {skills.map((s) => (
            <li
              key={s.name}
              className="rounded-xl border px-4 py-3"
              style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-violet-400">✦</span>
                <span className="font-mono text-sm text-violet-300">{s.name}</span>
                <div className="flex-1" />
                <button
                  className="text-[11px] px-2 py-1 rounded bg-zinc-800"
                  onClick={() => void openEdit(s.name)}
                >
                  Edit
                </button>
                <button
                  className="text-[11px] px-2 py-1 rounded bg-zinc-800 text-red-400"
                  onClick={() => void api.deleteSkill(s.name).then(refresh)}
                >
                  Delete
                </button>
              </div>
              {s.description && (
                <p className="text-sm mt-1" style={{ color: 'var(--gb-muted)' }}>
                  {s.description}
                </p>
              )}
              <p className="text-xs mt-2 whitespace-pre-wrap opacity-60">{s.preview}…</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
