import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { AvatarShape } from '@grok-bot/shared';
import CharacterPicker from '../components/CharacterPicker';

export default function NewAgentPage({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful local AI assistant with access to workspace tools.'
  );
  const [avatarColor, setAvatarColor] = useState<string>('#FF6A00');
  const [avatarShape, setAvatarShape] = useState<AvatarShape>('blob');
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
    <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-xl">
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
          <div className="text-sm text-zinc-400 mb-2">Official Grok Bot character</div>
          <CharacterPicker
            agent={{ name: name || 'new-bot', title: title || 'New Bot', accessory: 'none' }}
            color={avatarColor}
            shape={avatarShape}
            onColor={setAvatarColor}
            onShape={setAvatarShape}
          />
        </div>
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
