import type { Agent, AvatarShape } from '@grok-bot/shared';
import { AVATAR_COLORS, AVATAR_SHAPES } from '@grok-bot/shared';
import BotAvatar from './BotAvatar';

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
  onColor: (c: string) => void;
  onShape: (s: AvatarShape) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2.5">
        {AVATAR_SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={s}
            aria-pressed={shape === s}
              className={`h-14 rounded-2xl flex items-center justify-center ${
              shapeSelected(shape, s) ? 'ring-2 ring-white/90 bg-zinc-800/80' : 'bg-transparent'
            }`}
            onClick={() => onShape(s)}
          >
            <BotAvatar
              agent={{ ...agent, avatarColor: color, avatarShape: s }}
              size={36}
              staticPreview
            />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5 pt-1">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color.toLowerCase() === c.toLowerCase()}
            className={`h-8 w-8 rounded-full ${
              color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
            }`}
            style={{
              background: c,
              boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px rgba(255,255,255,0.25)' : undefined,
            }}
            onClick={() => onColor(c)}
          />
        ))}
      </div>
    </div>
  );
}
