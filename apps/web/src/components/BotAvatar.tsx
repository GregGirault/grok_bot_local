import type { Agent, AvatarShape, Presence } from '@grok-bot/shared';
import { normalizeAvatarShape } from '@grok-bot/shared';

const BLOBS = [
  '62% 38% 52% 48% / 48% 58% 42% 52%',
  '40% 60% 58% 42% / 52% 38% 62% 48%',
  '70% 30% 44% 56% / 42% 62% 38% 58%',
  '48% 52% 36% 64% / 60% 40% 55% 45%',
  '55% 45% 68% 32% / 36% 64% 48% 52%',
  '38% 62% 50% 50% / 58% 42% 46% 54%',
  '64% 36% 40% 60% / 50% 50% 34% 66%',
  '46% 54% 62% 38% / 44% 56% 60% 40%',
  '52% 48% 30% 70% / 66% 34% 52% 48%',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function eyeOffset(presence: Presence): { x: number; y: number } {
  switch (presence) {
    case 'idle':
      return { x: 0, y: 0 };
    case 'thinking':
      return { x: 1.2, y: -1 };
    case 'working':
      return { x: 1.5, y: 0.5 };
    case 'waiting':
      return { x: -1, y: 1 };
    case 'blocked':
      return { x: 0, y: 1.5 };
    case 'done':
      return { x: 0, y: -0.5 };
    default: {
      const _e: never = presence;
      void _e;
      return { x: 0, y: 0 };
    }
  }
}

function shapeStyle(
  shape: AvatarShape,
  name: string
): { borderRadius: string; clipPath?: string; innerScaleY?: number } {
  switch (shape) {
    case 'circle':
      return { borderRadius: '50%' };
    case 'rounded':
      return { borderRadius: '28%' };
    case 'square':
      return { borderRadius: '18%' };
    case 'pill':
      return { borderRadius: '999px', innerScaleY: 0.72 };
    case 'blob':
    case 'pebble':
      return { borderRadius: BLOBS[hashName(name) % BLOBS.length] };
    case 'triangle':
      return { borderRadius: '0', clipPath: 'polygon(50% 6%, 94% 90%, 6% 90%)' };
    case 'hexagon':
      return {
        borderRadius: '0',
        clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)',
      };
    case 'cloud':
      return {
        borderRadius: '0',
        clipPath:
          'polygon(20% 58%, 14% 44%, 22% 28%, 38% 22%, 48% 10%, 64% 12%, 78% 24%, 90% 40%, 88% 58%, 76% 72%, 54% 78%, 32% 74%, 18% 64%)',
      };
    case 'drop':
      return {
        borderRadius: '0',
        clipPath: 'polygon(50% 4%, 86% 42%, 80% 74%, 50% 98%, 20% 74%, 14% 42%)',
      };
    default: {
      const _: never = shape;
      void _;
      return { borderRadius: '50%' };
    }
  }
}

function isLight(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

export default function BotAvatar({
  agent,
  size = 32,
  presence,
  className = '',
  title,
  staticPreview = false,
}: {
  agent: Pick<Agent, 'name' | 'title' | 'avatarColor' | 'avatarShape' | 'accessory'> & { presence?: Presence };
  size?: number;
  presence?: Presence;
  className?: string;
  title?: string;
  staticPreview?: boolean;
}) {
  const p = presence ?? agent.presence ?? 'idle';
  const shape = normalizeAvatarShape(agent.avatarShape);
  const look = shapeStyle(shape, agent.name);
  const eyes = eyeOffset(staticPreview ? 'idle' : p);
  const acc = agent.accessory || 'none';
  const h = hashName(agent.name);
  const organic = shape === 'blob' || shape === 'pebble';
  const tilt = staticPreview || !organic ? 0 : (h % 7) - 3;
  const squash = staticPreview || !organic ? 1 : 0.92 + (h % 5) * 0.02;
  const color = agent.avatarColor || '#FF6A00';
  const light = isLight(color);
  const wrapTransform = look.innerScaleY
    ? `rotate(${tilt}deg) scaleX(${squash}) scaleY(${look.innerScaleY})`
    : `rotate(${tilt}deg) scaleX(${squash})`;

  return (
    <span
      className={`gb-avatar-wrap ${staticPreview ? '' : `gb-avatar-${p}`} ${className}`}
      style={{ width: size, height: size }}
      title={title ?? agent.title}
    >
      <span
        className="gb-avatar"
        style={{
          width: size,
          height: size,
          background: color,
          borderRadius: look.borderRadius,
          clipPath: look.clipPath,
          transform: wrapTransform,
          boxShadow: light
            ? 'inset 0 -6px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.18)'
            : 'inset 0 -6px 10px rgba(0,0,0,0.18)',
        }}
      >
        <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
          <ellipse cx={11 + eyes.x} cy={14 + eyes.y} rx="3.15" ry={p === 'idle' ? 3.5 : p === 'done' ? 2.4 : 3.1} fill="#fff" />
          <ellipse cx={21 + eyes.x} cy={14 + eyes.y} rx="3.15" ry={p === 'idle' ? 3.5 : p === 'done' ? 2.4 : 3.1} fill="#fff" />
          <circle cx={11.6 + eyes.x * 1.4} cy={14.4 + eyes.y} r="1.35" fill="#18181b" />
          <circle cx={21.6 + eyes.x * 1.4} cy={14.4 + eyes.y} r="1.35" fill="#18181b" />
          {acc === 'glasses' ? (
            <g fill="none" stroke="rgba(24,24,27,0.55)" strokeWidth="1.2">
              <rect x="7.2" y="11.4" width="7.2" height="5.4" rx="1.6" />
              <rect x="17.6" y="11.4" width="7.2" height="5.4" rx="1.6" />
              <path d="M14.4 14h3.2" />
            </g>
          ) : null}
          {acc === 'antenna' ? (
            <g>
              <path d="M16 4.5 v4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" />
              <circle cx="16" cy="4.2" r="1.4" fill="#fff" />
            </g>
          ) : null}
          {acc === 'blush' ? (
            <g fill="rgba(255,255,255,0.28)">
              <ellipse cx="8.5" cy="20" rx="2.2" ry="1.1" />
              <ellipse cx="23.5" cy="20" rx="2.2" ry="1.1" />
            </g>
          ) : null}
        </svg>
      </span>
    </span>
  );
}
