import type { Agent, AvatarShape, Presence } from '@grok-bot/shared';
import { normalizeAvatarShape, snapAvatarColor } from '../lib/avatar';

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
      return { x: 0.8, y: -0.6 };
    case 'working':
      return { x: 1, y: 0.3 };
    case 'waiting':
      return { x: -0.6, y: 0.6 };
    case 'blocked':
      return { x: 0, y: 1 };
    case 'done':
      return { x: 0, y: -0.3 };
    default: {
      const _e: never = presence;
      void _e;
      return { x: 0, y: 0 };
    }
  }
}

function isLight(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 168;
}

/** Blobs Grok officiels : amibes irrégulières, yeux blancs sans pupille. */
const BLOBS = [
  'M7.4 11.2C4.6 15.4 5.8 23.6 11.6 26.8C17.6 30.2 26.8 28.2 28.8 21.6C30.6 15.8 26.2 8.6 20.2 7.2C14.6 5.8 10.2 6.8 7.4 11.2Z',
  'M8.8 8.6C5.2 12.2 4.8 21.4 10.2 25.6C15.8 30 25.6 29.6 28.4 23.6C30.8 18.6 27.6 10.6 21.8 8.2C16.6 6.2 12.2 5.4 8.8 8.6Z',
  'M6.8 13.2C5.2 18.2 8.4 25.4 14.2 27.2C20.6 29.2 28.2 25.4 28.6 19.2C29 13.2 23.8 7.4 17.8 7.2C12.4 7 8.4 8.6 6.8 13.2Z',
];

function ShapeFill({ shape, name, color }: { shape: AvatarShape; name: string; color: string }) {
  const blob = BLOBS[hashName(name) % BLOBS.length];
  switch (shape) {
    case 'circle':
      return <circle cx="16" cy="16" r="14" fill={color} />;
    case 'rounded':
    case 'square':
      return <rect x="3.4" y="3.4" width="25.2" height="25.2" rx="8.2" fill={color} />;
    case 'pill':
      return <ellipse cx="16" cy="16.2" rx="11.2" ry="14.2" fill={color} />;
    case 'blob':
    case 'pebble':
      return <path d={blob} fill={color} />;
    case 'triangle':
      return (
        <path
          d="M16 3.6C16.8 3.6 17.5 4 17.9 4.7L28.4 24.2C28.8 25 28.6 26 27.9 26.6C27.6 26.9 27.2 27 26.7 27H5.3C4.4 27 3.6 26.2 3.6 25.3C3.6 25 3.7 24.6 3.9 24.2L14.1 4.7C14.5 4 15.2 3.6 16 3.6Z"
          fill={color}
        />
      );
    case 'hexagon':
      return <path d="M9.4 5.2 H22.6 L29.2 16 L22.6 26.8 H9.4 L2.8 16 Z" fill={color} />;
    case 'cloud':
      return (
        <path
          d="M11.2 22.2C7.2 21.8 5 18.6 5.8 15.4C6.4 13.2 8.6 12 10.8 12.4C11.2 8.8 14.4 6.4 18 6.8C20.8 7.2 22.8 9.2 23.4 11.8C25.8 10.8 28.8 12.2 29.4 14.8C30.4 18.2 28.4 21.4 25.2 22C24.6 24.8 21.6 26.6 18.4 26.2C15.2 25.8 12.8 24.2 12 22.2H11.2Z"
          fill={color}
        />
      );
    case 'drop':
      return (
        <path
          d="M16 2.2C16 2.2 27.6 14.8 27.6 21C27.6 27.4 22.4 31.2 16 31.2C9.6 31.2 4.4 27.4 4.4 21C4.4 14.8 16 2.2 16 2.2Z"
          fill={color}
        />
      );
    default: {
      const _: never = shape;
      void _;
      return <circle cx="16" cy="16" r="14" fill={color} />;
    }
  }
}

function eyeLayout(shape: AvatarShape): { cx1: number; cx2: number; cy: number; rx: number; ry: number; tilt: number } {
  switch (shape) {
    case 'drop':
      return { cx1: 12.35, cx2: 19.65, cy: 18.4, rx: 2.25, ry: 3.15, tilt: 13 };
    case 'cloud':
      return { cx1: 12.7, cx2: 19.3, cy: 15.4, rx: 2.3, ry: 3.05, tilt: 12 };
    case 'triangle':
      return { cx1: 12.5, cx2: 19.5, cy: 17.6, rx: 2.1, ry: 2.85, tilt: 10 };
    case 'hexagon':
      return { cx1: 12.2, cx2: 19.8, cy: 14.4, rx: 2.3, ry: 3.1, tilt: 12 };
    case 'pill':
      return { cx1: 12.4, cx2: 19.6, cy: 14.2, rx: 2.2, ry: 3.05, tilt: 14 };
    case 'rounded':
    case 'square':
      return { cx1: 12.2, cx2: 19.8, cy: 14.1, rx: 2.35, ry: 3.15, tilt: 14 };
    case 'circle':
      return { cx1: 12.15, cx2: 19.85, cy: 14.05, rx: 2.4, ry: 3.2, tilt: 14 };
    case 'blob':
    case 'pebble':
      return { cx1: 12.2, cx2: 19.8, cy: 14.15, rx: 2.35, ry: 3.2, tilt: 14 };
    default: {
      const _: never = shape;
      void _;
      return { cx1: 12.2, cx2: 19.8, cy: 14.15, rx: 2.35, ry: 3.2, tilt: 14 };
    }
  }
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
  const eyes = eyeOffset(staticPreview ? 'idle' : p);
  const acc = agent.accessory || 'none';
  const color = snapAvatarColor(agent.avatarColor || '#FF6A00');
  const light = isLight(color);
  const eyeFill = light ? '#1c1917' : '#fff';
  const layout = eyeLayout(shape);
  const ry = p === 'done' ? layout.ry * 0.55 : layout.ry;
  const left = { x: layout.cx1 + eyes.x, y: layout.cy + eyes.y };
  const right = { x: layout.cx2 + eyes.x, y: layout.cy + eyes.y };

  return (
    <span
      className={`gb-avatar-wrap ${staticPreview ? '' : `gb-avatar-${p}`} ${className}`}
      style={{ width: size, height: size }}
      title={title ?? agent.title}
    >
      <svg className="gb-avatar" viewBox="0 0 32 32" width={size} height={size} aria-hidden>
        <ShapeFill shape={shape} name={agent.name} color={color} />
        <ellipse
          cx={left.x}
          cy={left.y}
          rx={layout.rx}
          ry={ry}
          fill={eyeFill}
          transform={`rotate(-${layout.tilt} ${left.x} ${left.y})`}
        />
        <ellipse
          cx={right.x}
          cy={right.y}
          rx={layout.rx}
          ry={ry}
          fill={eyeFill}
          transform={`rotate(${layout.tilt} ${right.x} ${right.y})`}
        />
        {acc === 'glasses' ? (
          <g fill="none" stroke={light ? 'rgba(24,24,27,0.45)' : 'rgba(24,24,27,0.4)'} strokeWidth="1.15">
            <rect x="8" y="11.6" width="6.4" height="5" rx="1.5" />
            <rect x="17.6" y="11.6" width="6.4" height="5" rx="1.5" />
            <path d="M14.4 14h3.2" />
          </g>
        ) : null}
        {acc === 'antenna' ? (
          <g>
            <path d="M16 4.2 v3.6" stroke={eyeFill} strokeWidth="1.3" />
            <circle cx="16" cy="4" r="1.25" fill={eyeFill} />
          </g>
        ) : null}
        {acc === 'blush' ? (
          <g fill={light ? 'rgba(255,90,120,0.35)' : 'rgba(255,255,255,0.28)'}>
            <ellipse cx="8.4" cy="20.2" rx="2" ry="1" />
            <ellipse cx="23.6" cy="20.2" rx="2" ry="1" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
