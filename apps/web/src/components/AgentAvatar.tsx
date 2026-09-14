import type { Agent } from '@grok-bot/shared';

export type AvatarShape = 'circle' | 'rounded' | 'square' | 'blob' | 'pebble';

const SHAPE_CLASS: Record<string, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-md',
  blob: 'avatar-blob',
  pebble: 'avatar-pebble',
};

export default function AgentAvatar({
  agent,
  size = 28,
  className = '',
}: {
  agent: Pick<Agent, 'name' | 'title' | 'avatarColor'> & { avatarShape?: string };
  size?: number;
  className?: string;
}) {
  const shape = SHAPE_CLASS[agent.avatarShape || 'circle'] || SHAPE_CLASS.circle;
  const initial = (agent.title || agent.name || '?').charAt(0).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 font-semibold text-white select-none ${shape} ${className}`}
      style={{
        width: size,
        height: size,
        background: agent.avatarColor || '#8b5cf6',
        fontSize: Math.max(10, size * 0.4),
      }}
      title={`@${agent.name}`}
    >
      {initial}
    </span>
  );
}
