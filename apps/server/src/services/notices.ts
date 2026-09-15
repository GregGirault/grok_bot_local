import type { Notice } from '@grok-bot/shared';
import { v4 as uuid } from 'uuid';

const notices: Notice[] = [];

export function addNotice(input: Omit<Notice, 'id' | 'dismissed' | 'createdAt'>): Notice {
  const n: Notice = {
    id: uuid(),
    dismissed: false,
    createdAt: new Date().toISOString(),
    ...input,
    requestId: input.requestId || `req_${uuid().slice(0, 8)}`,
  };
  notices.unshift(n);
  if (notices.length > 40) notices.pop();
  return n;
}

export function listNotices(agentId?: string): Notice[] {
  return notices.filter((n) => !n.dismissed && (!agentId || !n.agentId || n.agentId === agentId));
}

export function dismissNotice(id: string): boolean {
  const n = notices.find((x) => x.id === id);
  if (!n) return false;
  n.dismissed = true;
  return true;
}

export function dismissAll(): void {
  for (const n of notices) n.dismissed = true;
}
