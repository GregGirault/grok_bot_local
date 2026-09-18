import type { Agent, AvatarShape } from '@grok-bot/shared';
import BotAvatar from './BotAvatar';
import { OFFICIAL_AVATAR_COLORS, OFFICIAL_AVATAR_SHAPES } from '../lib/avatar';

function shapeSelected(current: AvatarShape, option: AvatarShape): boolean {
  if (current === option) return true;
  if (current === 'pebble' && option === 'blob') return true;
  if (current === 'square' && option === 'rounded') return true;
  return false;
}

export default function CharacterPicker({
  agent,
  color,
  shape,
  onColor,
  onShape,
}: {
  agent: Pick<Agent, 'name' | 'title' | 'accessory'>;
  color: string;
  shape: AvatarShape;
  lang?: string;
  onColor: (c: string) => void;
  onShape: (s: AvatarShape) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {OFFICIAL_AVATAR_SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={s}
            title={s}
            aria-pressed={shapeSelected(shape, s)}
            className={`h-12 rounded-xl flex items-center justify-center ${
              shapeSelected(shape, s) ? 'ring-1 ring-white/80 bg-zinc-800/80' : 'bg-transparent'
            }`}
            onClick={() => onShape(s)}
          >
            <BotAvatar agent={{ ...agent, avatarColor: color, avatarShape: s }} size={32} staticPreview />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2.5 pt-1 w-[196px]">
        {OFFICIAL_AVATAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color.toLowerCase() === c.toLowerCase()}
            className={`h-7 w-7 rounded-full ${
              color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1e]' : ''
            }`}
            style={{
              background: c,
              boxShadow: c === '#F4EFE6' ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : undefined,
            }}
            onClick={() => onColor(c)}
          />
        ))}
      </div>
    </div>
  );
}
