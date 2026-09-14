import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const AVATAR_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
] as const;

export default function NewAgentPage({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful local AI assistant with access to workspace tools.'
  );
  const [avatarColor, setAvatarColor] = useState<string>(AVATAR_COLORS[0]);
  const [avatarShape, setAvatarShape] = useState<'circle' | 'rounded' | 'square' | 'blob' | 'pebble'>('blob');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const agent = await api.createAgent({
        name: name.trim(),
        title: title.trim(),
        description,
        systemPrompt,
        avatarColor,
        avatarShape,
      });
      onCreated();
      navigate(`/chat/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">Create agent</h1>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <label className="block text-sm">
          <span className="text-zinc-400">Name (slug)</span>
          <input
            required
            pattern="[a-z0-9_-]+"
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 font-mono"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="research"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Title</span>
          <input
            required
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Research Assistant"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Description</span>
          <input
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div>
          <div className="text-sm text-zinc-400 mb-2">Avatar color</div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`h-8 w-8 border-2 ${
                  avatarColor === c ? 'border-white' : 'border-transparent'
                } ${
                  avatarShape === 'square'
                    ? 'rounded-md'
                    : avatarShape === 'rounded'
                      ? 'rounded-xl'
                      : 'rounded-full'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-zinc-400">Avatar shape</span>
          <select
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={avatarShape}
            onChange={(e) =>
              setAvatarShape(e.target.value as 'circle' | 'rounded' | 'square' | 'blob' | 'pebble')
            }
          >
            <option value="circle">circle</option>
            <option value="rounded">rounded</option>
            <option value="square">square</option>
            <option value="blob">blob</option>
            <option value="pebble">pebble</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">System prompt</span>
          <textarea
            rows={6}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium text-sm"
        >
          Create
        </button>
      </form>
    </div>
  );
}
