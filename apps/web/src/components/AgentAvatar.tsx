import type { Agent } from '@grok-bot/shared';

export default function AgentAvatar({
  agent,
  size = 28,
}: {
  agent: Pick<Agent, 'name' | 'title' | 'avatarColor' | 'avatarShape'>;
  size?: number;
}) {
  const shape =
    agent.avatarShape === 'square'
      ? 'rounded-md'
      : agent.avatarShape === 'rounded'
        ? 'rounded-xl'
        : 'rounded-full';
  const initial = (agent.title || agent.name || '?').charAt(0).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 font-semibold text-white ${shape}`}
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
