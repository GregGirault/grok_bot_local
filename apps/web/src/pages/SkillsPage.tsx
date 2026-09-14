import { useEffect, useState } from 'react';
import type { SkillInfo } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  useEffect(() => {
    void api.listSkills().then(setSkills).catch(console.error);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Skills</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Markdown skills loaded from the <code className="text-zinc-400">skills/</code> folder
      </p>

      {skills.length === 0 ? (
        <p className="text-sm text-zinc-500">No skills found. Add <code>*.md</code> files under skills/.</p>
      ) : (
        <ul className="space-y-3">
          {skills.map((s) => (
            <li
              key={s.name}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-violet-400">✦</span>
                <span className="font-mono text-sm text-violet-300">{s.name}</span>
              </div>
              {s.description && (
                <p className="text-sm text-zinc-400 mt-1">{s.description}</p>
              )}
              <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap">{s.preview}…</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
