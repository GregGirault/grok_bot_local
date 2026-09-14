import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  ChatMessage,
  MemoryEntry,
  Routine,
  CreateRoutineInput,
  Settings,
  HealthStatus,
} from '@grok-bot/shared';

const BASE = '';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => json<HealthStatus>('/health'),
  listAgents: () => json<Agent[]>('/api/agents'),
  createAgent: (body: CreateAgentInput) =>
    json<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: string, body: UpdateAgentInput) =>
    json<Agent>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAgent: (id: string) =>
    json<{ ok: boolean }>(`/api/agents/${id}`, { method: 'DELETE' }),
  listMessages: (agentId: string) => json<ChatMessage[]>(`/api/agents/${agentId}/messages`),
  clearMessages: (agentId: string) =>
    json<{ ok: boolean }>(`/api/agents/${agentId}/messages`, { method: 'DELETE' }),
  listMemory: (agentId: string) => json<MemoryEntry[]>(`/api/agents/${agentId}/memory`),
  getSettings: () => json<Settings>('/api/settings'),
  putSettings: (body: Partial<Settings>) =>
    json<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  listModels: () => json<{ models: string[] }>('/api/models'),
  listRoutines: (agentId?: string) =>
    json<Routine[]>(`/api/routines${agentId ? `?agentId=${agentId}` : ''}`),
  createRoutine: (body: CreateRoutineInput) =>
    json<Routine>('/api/routines', { method: 'POST', body: JSON.stringify(body) }),
  deleteRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),
  runRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}/run`, { method: 'POST' }),
  listSkills: () => json<Array<{ name: string; preview: string }>>('/api/skills'),
};

export type StreamHandlers = {
  onToken: (content: string) => void;
  onToolCall: (data: { id: string; name: string; arguments: string }) => void;
  onToolResult: (data: { id: string; name: string; result: string }) => void;
  onDone: (content: string) => void;
  onError: (message: string) => void;
  onMemory?: (entries: MemoryEntry[]) => void;
};

export async function streamChat(
  agentId: string,
  message: string,
  handlers: StreamHandlers,
  model?: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message, model }),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    handlers.onError(err || 'Chat request failed');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';

    for (const line of parts) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        try {
          const data = JSON.parse(raw);
          switch (eventName) {
            case 'token':
              handlers.onToken(data.content ?? '');
              break;
            case 'tool_call':
              handlers.onToolCall(data);
              break;
            case 'tool_result':
              handlers.onToolResult(data);
              break;
            case 'done':
              handlers.onDone(data.content ?? '');
              break;
            case 'error':
              handlers.onError(data.message ?? 'Unknown error');
              break;
            case 'memory':
              handlers.onMemory?.(data.entries ?? []);
              break;
          }
        } catch {
          // ignore
        }
        eventName = 'message';
      }
    }
  }
}
