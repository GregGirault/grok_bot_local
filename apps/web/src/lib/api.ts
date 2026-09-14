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
  InboxMessage,
  Channel,
  ChannelMessage,
  BackgroundTask,
  SkillInfo,
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
  listMemory: (agentId?: string) =>
    json<MemoryEntry[]>(`/api/memory${agentId ? `?agentId=${agentId}` : ''}`),
  addMemory: (body: {
    agentId: string;
    key: string;
    value: string;
    tier?: string;
    scope?: string;
  }) => json<MemoryEntry>('/api/memory', { method: 'POST', body: JSON.stringify(body) }),
  forgetMemory: (id: string) =>
    json<{ ok: boolean }>(`/api/memory/${id}`, { method: 'DELETE' }),
  searchMemory: (q: string, agentId?: string) =>
    json<MemoryEntry[]>(
      `/api/memory?q=${encodeURIComponent(q)}${agentId ? `&agentId=${agentId}` : ''}`
    ),
  getSettings: () => json<Settings>('/api/settings'),
  putSettings: (body: Partial<Settings>) =>
    json<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  listModels: () => json<{ models: string[] }>('/api/models'),
  listRoutines: (agentId?: string) =>
    json<Routine[]>(`/api/routines${agentId ? `?agentId=${agentId}` : ''}`),
  createRoutine: (body: CreateRoutineInput) =>
    json<Routine>('/api/routines', { method: 'POST', body: JSON.stringify(body) }),
  updateRoutine: (
    id: string,
    body: Partial<{ name: string; cron: string; prompt: string; enabled: boolean }>
  ) => json<Routine>(`/api/routines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),
  runRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}/run`, { method: 'POST' }),
  listSkills: () => json<SkillInfo[]>('/api/skills'),
  listInbox: (agentId: string) => json<InboxMessage[]>(`/api/agents/${agentId}/inbox`),
  sendInbox: (fromAgentId: string, body: { toAgentId?: string; toAgent?: string; message: string }) =>
    json<InboxMessage>(`/api/agents/${fromAgentId}/inbox`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listChannels: () => json<Channel[]>('/api/channels'),
  createChannel: (body: { name: string; description?: string; memberIds: string[] }) =>
    json<Channel>('/api/channels', { method: 'POST', body: JSON.stringify(body) }),
  listChannelMessages: (id: string) =>
    json<ChannelMessage[]>(`/api/channels/${id}/messages`),
  postChannelMessage: (id: string, body: { content: string; fromAgentId?: string }) =>
    json<ChannelMessage>(`/api/channels/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteChannel: (id: string) =>
    json<{ ok: boolean }>(`/api/channels/${id}`, { method: 'DELETE' }),
  listTasks: () => json<BackgroundTask[]>('/api/tasks'),
  createTask: (body: { agentId: string; prompt: string }) =>
    json<BackgroundTask>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  getMcp: () => json<{ servers: string[]; tools: string[] }>('/api/mcp'),
};

export type StreamHandlers = {
  onToken: (content: string) => void;
  onToolCall: (data: { id: string; name: string; arguments: string }) => void;
  onToolResult: (data: { id: string; name: string; result: string }) => void;
  onWidget?: (data: { widgetId: string; question: string; options: string[] }) => void;
  onDone: (content: string) => void;
  onError: (message: string) => void;
  onMemory?: (entries: MemoryEntry[]) => void;
};

async function readSse(
  res: Response,
  handlers: StreamHandlers
): Promise<void> {
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    handlers.onError(err || 'Request failed');
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
            case 'widget':
              handlers.onWidget?.(data);
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
  await readSse(res, handlers);
}

export async function streamWidgetSelect(
  agentId: string,
  widgetId: string,
  selection: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/chat/widget-select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, widgetId, selection }),
    signal,
  });
  await readSse(res, handlers);
}
