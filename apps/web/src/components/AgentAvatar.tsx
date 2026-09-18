import type { Agent, Presence } from '@grok-bot/shared';
import BotAvatar from './BotAvatar';

export default function AgentAvatar({
  agent,
  size = 28,
  className = '',
  presence,
}: {
  agent: Pick<Agent, 'name' | 'title' | 'avatarColor' | 'avatarShape' | 'accessory'> & {
    presence?: Presence;
  };
  size?: number;
  className?: string;
  presence?: Presence;
}) {
  return (
    <BotAvatar
      agent={{
        ...agent,
        avatarShape: agent.avatarShape || 'blob',
        accessory: agent.accessory || 'none',
      }}
      size={size}
      className={className}
      presence={presence}
    />
  );
}
