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
  Machine,
  TeamMember,
  Project,
  ApprovalRequest,
  RoutineRun,
  AttachmentInfo,
  SearchResult,
  PluginInfo,
  TeachSession,
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
  listAgents: (includeHidden = false) =>
    json<Agent[]>(`/api/agents${includeHidden ? '?includeHidden=1' : ''}`),
  listHiddenAgents: () => json<Agent[]>('/api/agents-hidden'),
  createAgent: (body: CreateAgentInput) =>
    json<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: string, body: UpdateAgentInput) =>
    json<Agent>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  hideAgent: (id: string, hidden: boolean) =>
    json<Agent>(`/api/agents/${id}/hide`, { method: 'POST', body: JSON.stringify({ hidden }) }),
  deleteAgent: (id: string) =>
    json<{ ok: boolean }>(`/api/agents/${id}`, { method: 'DELETE' }),
  listMessages: (agentId: string) => json<ChatMessage[]>(`/api/agents/${agentId}/messages`),
  clearMessages: (agentId: string) =>
    json<{ ok: boolean }>(`/api/agents/${agentId}/messages`, { method: 'DELETE' }),
  editMessage: (id: string, content: string) =>
    json<ChatMessage>(`/api/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  reactMessage: (id: string, emoji: string) =>
    json<ChatMessage>(`/api/messages/${id}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
  listMemory: (agentId?: string, projectId?: string) => {
    const params = new URLSearchParams();
    if (agentId) params.set('agentId', agentId);
    if (projectId) params.set('projectId', projectId);
    const q = params.toString();
    return json<MemoryEntry[]>(`/api/memory${q ? `?${q}` : ''}`);
  },
  listUserMemory: () => json<MemoryEntry[]>('/api/memory?scope=user'),
  addMemory: (body: {
    agentId: string;
    key: string;
    value: string;
    tier?: string;
    scope?: string;
    projectId?: string;
    pinned?: boolean;
  }) => json<MemoryEntry>('/api/memory', { method: 'POST', body: JSON.stringify(body) }),
  pinMemory: (id: string, pinned: boolean) =>
    json<MemoryEntry>(`/api/memory/${id}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    }),
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
  listRoutineRuns: (routineId?: string) =>
    json<RoutineRun[]>(
      `/api/routines/runs${routineId ? `?routineId=${routineId}` : ''}`
    ),
  createRoutine: (body: CreateRoutineInput) =>
    json<Routine>('/api/routines', { method: 'POST', body: JSON.stringify(body) }),
  updateRoutine: (
    id: string,
    body: Partial<{
      name: string;
      cron: string;
      prompt: string;
      enabled: boolean;
      quietIfEmpty: boolean;
    }>
  ) => json<Routine>(`/api/routines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),
  runRoutine: (id: string) =>
    json<{ ok: boolean }>(`/api/routines/${id}/run`, { method: 'POST' }),
  listSkills: () => json<SkillInfo[]>('/api/skills'),
  getSkill: (name: string) => json<{ name: string; content: string }>(`/api/skills/${name}`),
  saveSkill: (name: string, content: string) =>
    json<SkillInfo>('/api/skills', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    }),
  deleteSkill: (name: string) =>
    json<{ ok: boolean }>(`/api/skills/${name}`, { method: 'DELETE' }),
  listInbox: (agentId: string) => json<InboxMessage[]>(`/api/agents/${agentId}/inbox`),
  sendInbox: (fromAgentId: string, body: { toAgentId?: string; toAgent?: string; message: string }) =>
    json<InboxMessage>(`/api/agents/${fromAgentId}/inbox`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listChannels: () => json<Channel[]>('/api/channels'),
  createChannel: (body: { name: string; description?: string; memberIds: string[] }) =>
    json<Channel>('/api/channels', { method: 'POST', body: JSON.stringify(body) }),
  updateChannel: (id: string, body: Partial<Pick<Channel, 'name' | 'description' | 'pinned'>>) =>
    json<Channel>(`/api/channels/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listChannelMessages: (id: string) =>
    json<ChannelMessage[]>(`/api/channels/${id}/messages`),
  postChannelMessage: (
    id: string,
    body: { content: string; fromAgentId?: string; replyToId?: string }
  ) =>
    json<ChannelMessage>(`/api/channels/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reactChannelMessage: (channelId: string, messageId: string, emoji: string) =>
    json<ChannelMessage>(`/api/channels/${channelId}/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
  deleteChannel: (id: string) =>
    json<{ ok: boolean }>(`/api/channels/${id}`, { method: 'DELETE' }),
  channelMembers: (id: string) =>
    json<{ agents: Agent[]; team: TeamMember[] }>(`/api/channels/${id}/members`),
  addChannelMember: (id: string, body: { agentId?: string; memberId?: string }) =>
    json<{ ok: boolean }>(`/api/channels/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeChannelMember: (id: string, mid: string) =>
    json<{ ok: boolean }>(`/api/channels/${id}/members/${mid}`, { method: 'DELETE' }),
  listTasks: () => json<BackgroundTask[]>('/api/tasks'),
  createTask: (body: { agentId: string; prompt: string }) =>
    json<BackgroundTask>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  getMcp: () =>
    json<{
      servers: string[];
      tools: string[];
      all?: Array<{
        name: string;
        disabled: boolean;
        command?: string;
        args?: string[];
        tools: string[];
      }>;
    }>('/api/mcp'),
  getMcpConfig: () => json<{ servers: unknown[] }>('/api/mcp/config'),
  putMcpConfig: (servers: unknown[]) =>
    json<{ ok: boolean }>('/api/mcp/config', {
      method: 'PUT',
      body: JSON.stringify({ servers }),
    }),
  toggleMcpServer: (name: string, disabled: boolean) =>
    json<{ ok: boolean }>(`/api/mcp/servers/${name}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ disabled }),
    }),
  listPlugins: () => json<PluginInfo[]>('/api/plugins'),
  installPlugin: (slug: string) =>
    json<PluginInfo[]>(`/api/plugins/${encodeURIComponent(slug)}/install`, { method: 'POST' }),
  uninstallPlugin: (slug: string) =>
    json<PluginInfo[]>(`/api/plugins/${encodeURIComponent(slug)}/uninstall`, { method: 'POST' }),
  togglePluginTool: (slug: string, toolName: string, enabled: boolean) =>
    json<PluginInfo[]>(`/api/plugins/${encodeURIComponent(slug)}/tools`, {
      method: 'POST',
      body: JSON.stringify({ toolName, enabled }),
    }),
  startTeach: (agentId: string, goal: string) =>
    json<TeachSession>('/api/teach/start', {
      method: 'POST',
      body: JSON.stringify({ agentId, goal }),
    }),
  addTeachStep: (id: string, kind: string, detail: string) =>
    json<TeachSession>(`/api/teach/${id}/step`, {
      method: 'POST',
      body: JSON.stringify({ kind, detail }),
    }),
  stopTeach: (id: string) =>
    json<TeachSession>(`/api/teach/${id}/stop`, { method: 'POST' }),
  getTeach: (id: string) => json<TeachSession>(`/api/teach/${id}`),
  listMachines: () => json<Machine[]>('/api/machines'),
  createMachine: (body: { name: string; host?: string; path?: string }) =>
    json<Machine>('/api/machines', { method: 'POST', body: JSON.stringify(body) }),
  updateMachine: (id: string, body: Partial<Machine>) =>
    json<Machine>(`/api/machines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMachine: (id: string) =>
    json<{ ok: boolean }>(`/api/machines/${id}`, { method: 'DELETE' }),
  listMembers: () => json<TeamMember[]>('/api/members'),
  createMember: (body: { name: string; email?: string; role?: string }) =>
    json<TeamMember>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  deleteMember: (id: string) =>
    json<{ ok: boolean }>(`/api/members/${id}`, { method: 'DELETE' }),
  listProjects: () => json<Project[]>('/api/projects'),
  createProject: (body: {
    slug: string;
    name: string;
    path?: string;
    description?: string;
  }) => json<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, body: Partial<Project>) =>
    json<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    json<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  listApprovals: (agentId?: string) =>
    json<ApprovalRequest[]>(
      `/api/approvals${agentId ? `?agentId=${agentId}` : ''}`
    ),
  resolveApproval: (id: string, decision: 'approved' | 'denied') =>
    json<{ ok: boolean }>(`/api/approvals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  computerPreview: () =>
    json<{ ok: boolean; url: string | null }>('/api/computer/preview.json'),
  computerAction: (body:
    | { action: 'navigate'; url: string }
    | { action: 'click'; selector: string }
    | { action: 'type'; selector: string; text: string; pressEnter?: boolean }
    | { action: 'press'; key: string }
    | { action: 'snapshot' }
  ) => json<Record<string, unknown>>('/api/computer/action', { method: 'POST', body: JSON.stringify(body) }),
  checkUpdates: () =>
    json<{
      ok: boolean;
      current: string;
      latest?: string;
      url?: string;
      error?: string;
      source?: string;
    }>('/api/updates/check'),
  search: (q: string, limit = 50) =>
    json<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  networkInfo: () =>
    json<{ bindHost: string; port: number; lanEnabled: boolean; urls: string[] }>('/api/network'),
  upload: async (file: File, agentId?: string): Promise<AttachmentInfo & { url?: string }> => {
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(`/api/uploads/file${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error || res.statusText);
    }
    return res.json() as Promise<AttachmentInfo & { url?: string }>;
  },
};

export type StreamHandlers = {
  onToken: (content: string) => void;
  onToolCall: (data: { id: string; name: string; arguments: string }) => void;
  onToolResult: (data: { id: string; name: string; result: string }) => void;
  onWidget?: (data: { widgetId: string; question: string; options: string[] }) => void;
  onDone: (content: string) => void;
  onError: (message: string) => void;
  onMemory?: (entries: MemoryEntry[]) => void;
  onTyping?: (active: boolean) => void;
  onApproval?: (data: { approvalId: string; toolName: string; command: string }) => void;
};

async function readSse(res: Response, handlers: StreamHandlers): Promise<void> {
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
            case 'typing':
              handlers.onTyping?.(Boolean(data.active));
              break;
            case 'approval':
              handlers.onApproval?.(data);
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
  signal?: AbortSignal,
  attachmentIds?: string[],
  parentMessageId?: string
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message, model, attachmentIds, parentMessageId }),
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

export async function streamRegenerate(
  agentId: string,
  messageId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/chat/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, messageId }),
    signal,
  });
  await readSse(res, handlers);
}
