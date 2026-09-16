import type { Agent, Attention, Presence } from '@grok-bot/shared';
import { normalizeAvatarShape, normalizeModelProvider, snapAvatarColor } from '@grok-bot/shared';

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function rowAgent(r: Record<string, unknown>): Agent {
  return {
    id: String(r.id),
    name: String(r.name),
    title: String(r.title),
    description: String(r.description),
    systemPrompt: String(r.system_prompt),
    model: String(r.model ?? ''),
    hfModel: String(r.hf_model ?? ''),
    modelProvider: normalizeModelProvider(String(r.model_provider ?? 'ollama')),
    avatarColor: snapAvatarColor(String(r.avatar_color)),
    avatarShape: normalizeAvatarShape(String(r.avatar_shape)),
    accessory: String(r.accessory || 'none'),
    hidden: Boolean(r.hidden),
    pinned: Boolean(r.pinned),
    notifyOnUpdates: Boolean(r.notify_on_updates),
    lastPreview: String(r.last_preview || ''),
    lastActivityAt: String(r.last_activity_at),
    unread: Boolean(r.unread),
    attention: (String(r.attention) as Attention) || 'none',
    presence: (String(r.presence) as Presence) || 'idle',
    currentAction: String(r.current_action || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}
