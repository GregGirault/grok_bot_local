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
  ComputerState,
  PluginInfo,
  Notice,
  TeachSession,
  SharePayload,
  AutoReviewRule,
  HostFacts,
} from '@grok-bot/shared';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) || {}) };
  if (init?.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  health: () => json<HealthStatus>('/health'),
  reportHost: (body: HostFacts) => json<Settings>('/api/host-facts', { method: 'PUT', body: JSON.stringify(body) }),
  listAgents: (includeHidden = false) => json<Agent[]>(`/api/agents${includeHidden ? '?includeHidden=1' : ''}`),
  listHiddenAgents: () => json<Agent[]>('/api/agents-hidden'),
  createAgent: (body: CreateAgentInput) => json<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: string, body: UpdateAgentInput) =>
    json<Agent>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  hideAgent: (id: string, hidden: boolean) =>
    json<Agent>(`/api/agents/${id}/hide`, { method: 'POST', body: JSON.stringify({ hidden }) }),
  pinAgent: (id: string, pinned: boolean) =>
    json<Agent>(`/api/agents/${id}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) }),
  duplicateAgent: (id: string) => json<Agent>(`/api/agents/${id}/duplicate`, { method: 'POST' }),
  markRead: (id: string) => json<{ ok: boolean }>(`/api/agents/${id}/read`, { method: 'POST' }),
  deleteAgent: (id: string) => json<{ ok: boolean }>(`/api/agents/${id}`, { method: 'DELETE' }),
  listMessages: (agentId: string) => json<ChatMessage[]>(`/api/agents/${agentId}/messages`),
  clearMessages: (agentId: string) => json<{ ok: boolean }>(`/api/agents/${agentId}/messages`, { method: 'DELETE' }),
  editMessage: (id: string, content: string) =>
    json<ChatMessage>(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  react: (id: string, emoji: string) =>
    json<ChatMessage>(`/api/messages/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  listMemory: (agentId?: string) => json<MemoryEntry[]>(`/api/memory${agentId ? `?agentId=${agentId}` : ''}`),
  addMemory: (body: { agentId: string; key: string; value: string; tier?: string }) =>
    json<MemoryEntry>('/api/memory', { method: 'POST', body: JSON.stringify(body) }),
  forgetMemory: (id: string) => json<{ ok: boolean }>(`/api/memory/${id}`, { method: 'DELETE' }),
  getSettings: () => json<Settings>('/api/settings'),
  putSettings: (body: Partial<Settings>) => json<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  listModels: () => json<{ models: string[]; huggingface?: string[] }>('/api/models'),
  listRoutines: (agentId?: string) => json<Routine[]>(`/api/routines${agentId ? `?agentId=${agentId}` : ''}`),
  listRoutineRuns: (routineId?: string) =>
    json<RoutineRun[]>(`/api/routines/runs${routineId ? `?routineId=${routineId}` : ''}`),
  createRoutine: (body: CreateRoutineInput) => json<Routine>('/api/routines', { method: 'POST', body: JSON.stringify(body) }),
  updateRoutine: (id: string, body: Partial<Routine>) =>
    json<Routine>(`/api/routines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoutine: (id: string) => json<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),
  runRoutine: (id: string) => json<{ ok: boolean }>(`/api/routines/${id}/run`, { method: 'POST' }),
  listSkills: () => json<SkillInfo[]>('/api/skills'),
  saveSkill: (name: string, content: string) =>
    json<SkillInfo>('/api/skills', { method: 'POST', body: JSON.stringify({ name, content }) }),
  listInbox: (agentId: string) => json<InboxMessage[]>(`/api/agents/${agentId}/inbox`),
  sendInbox: (fromAgentId: string, body: { toAgentId: string; message: string }) =>
    json<InboxMessage>(`/api/agents/${fromAgentId}/inbox`, { method: 'POST', body: JSON.stringify(body) }),
  listChannels: () => json<Channel[]>('/api/channels'),
  createChannel: (body: { name: string; description?: string; memberIds: string[] }) =>
    json<Channel>('/api/channels', { method: 'POST', body: JSON.stringify(body) }),
  updateChannel: (id: string, body: { name?: string; description?: string; memberIds?: string[] }) =>
    json<Channel>(`/api/channels/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listChannelMessages: (id: string) => json<ChannelMessage[]>(`/api/channels/${id}/messages`),
  postChannelMessage: (id: string, body: { content: string; fromAgentId?: string }) =>
    json<ChannelMessage>(`/api/channels/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  deleteChannel: (id: string) => json<{ ok: boolean }>(`/api/channels/${id}`, { method: 'DELETE' }),
  listTasks: () => json<BackgroundTask[]>('/api/tasks'),
  listMachines: () => json<Machine[]>('/api/machines'),
  createMachine: (body: { name: string; host?: string; path?: string }) =>
    json<Machine>('/api/machines', { method: 'POST', body: JSON.stringify(body) }),
  deleteMachine: (id: string) => json<{ ok: boolean }>(`/api/machines/${id}`, { method: 'DELETE' }),
  listMembers: () => json<TeamMember[]>('/api/members'),
  listProjects: () => json<Project[]>('/api/projects'),
  listApprovals: (agentId?: string) => json<ApprovalRequest[]>(`/api/approvals${agentId ? `?agentId=${agentId}` : ''}`),
  resolveApproval: (id: string, decision: 'approved' | 'denied' | 'always') =>
    json<{ ok: boolean }>(`/api/approvals/${id}`, { method: 'POST', body: JSON.stringify({ decision }) }),
  computer: (agentId?: string) => json<ComputerState>(`/api/computer${agentId ? `?agentId=${agentId}` : ''}`),
  takeover: (on: boolean, agentId?: string) =>
    json<ComputerState>('/api/computer/takeover', { method: 'POST', body: JSON.stringify({ on, agentId }) }),
  search: (q: string) =>
    json<{
      agents: Agent[];
      messages: ChatMessage[];
      routines: Routine[];
      files: AttachmentInfo[];
      channels: Channel[];
    }>(`/api/search?q=${encodeURIComponent(q)}`),
  listPlugins: () => json<PluginInfo[]>('/api/plugins'),
  installPlugin: (slug: string) => json<PluginInfo[]>(`/api/plugins/${slug}/install`, { method: 'POST' }),
  uninstallPlugin: (slug: string) => json<PluginInfo[]>(`/api/plugins/${slug}/uninstall`, { method: 'POST' }),
  listNotices: (agentId?: string) => json<Notice[]>(`/api/notices${agentId ? `?agentId=${agentId}` : ''}`),
  dismissNotice: (id: string) => json<{ ok: boolean }>(`/api/notices/${id}/dismiss`, { method: 'POST' }),
  clearNotices: () => json<{ ok: boolean }>('/api/notices/clear', { method: 'POST' }),
  startTeach: (agentId: string, goal: string) => json<TeachSession>('/api/teach/start', { method: 'POST', body: JSON.stringify({ agentId, goal }) }),
  teachStep: (id: string, kind: string, detail: string) =>
    json<TeachSession>(`/api/teach/${id}/step`, { method: 'POST', body: JSON.stringify({ kind, detail }) }),
  stopTeach: (id: string) => json<TeachSession>(`/api/teach/${id}/stop`, { method: 'POST' }),
  shareAgent: (id: string) => json<{ token: string; url: string }>(`/api/agents/${id}/share`, { method: 'POST' }),
  getShare: (token: string) => json<SharePayload>(`/api/share/${token}`),
  importShare: (token: string) => json<Agent>(`/api/share/${token}/import`, { method: 'POST' }),
  putSecret: (body: { plugin?: string; keyName: string; value: string }) => json<{ id: string }>('/api/secrets', { method: 'POST', body: JSON.stringify(body) }),
  usage: () => json<{ messages: number; tools: number; weekStart: string }>('/api/usage'),
  addAutoReview: (body: AutoReviewRule) => json<AutoReviewRule[]>('/api/auto-review', { method: 'POST', body: JSON.stringify(body) }),
  deleteAutoReview: (id: string) => json<AutoReviewRule[]>(`/api/auto-review/${id}`, { method: 'DELETE' }),
  computerUpdate: () => json<{ ok: boolean }>('/api/computer/update', { method: 'POST' }),
  computerRecover: () => json<{ ok: boolean }>('/api/computer/recover', { method: 'POST' }),
  computerReset: () => json<{ ok: boolean }>('/api/computer/reset', { method: 'POST' }),
  computerNavigate: (agentId: string, url: string) =>
    json<ComputerState>('/api/computer/navigate', { method: 'POST', body: JSON.stringify({ agentId, url }) }),
  computerFiles: (rel?: string) => json<{ files: Array<{ name: string; type: 'dir' | 'file' }>; computer: ComputerState }>(`/api/computer/files${rel ? `?path=${encodeURIComponent(rel)}` : ''}`),
  computerType: (agentId: string, text: string) =>
    json<ComputerState>('/api/computer/type', { method: 'POST', body: JSON.stringify({ agentId, text }) }),
  computerClick: (agentId: string, target: string) =>
    json<ComputerState>('/api/computer/click', { method: 'POST', body: JSON.stringify({ agentId, target }) }),
  togglePluginTool: (slug: string, toolName: string, enabled: boolean) =>
    json<PluginInfo[]>(`/api/plugins/${slug}/tools`, { method: 'POST', body: JSON.stringify({ toolName, enabled }) }),
  connectPlugin: (slug: string, value: string, keyName?: string) =>
    json<PluginInfo[]>(`/api/plugins/${slug}/connect`, { method: 'POST', body: JSON.stringify({ value, keyName }) }),
  teamSetup: () => json<{ source: string; applied: boolean; appliedAt: string | null }>('/api/team-setup'),
  reinstallTeamSetup: () => json<{ ok: boolean }>('/api/team-setup/reinstall', { method: 'POST' }),
  agentSkills: (id: string) => json<Array<SkillInfo & { enabled: boolean }>>(`/api/agents/${id}/skills`),
  setAgentSkills: (id: string, names: string[]) => json<{ ok: boolean }>(`/api/agents/${id}/skills`, { method: 'PUT', body: JSON.stringify({ names }) }),
  fireEvent: (kind: string) => json<{ ok: boolean }>(`/api/hooks/event/${kind}`, { method: 'POST' }),
  deleteSkill: (name: string) => json<{ ok: boolean }>(`/api/skills/${name}`, { method: 'DELETE' }),
  network: () => json<{ urls: string[]; apiPort: number; webPort: number }>('/api/network'),
  getMcp: () =>
    json<{
      configPath: string;
      servers: Array<{ name: string; command?: string; url?: string; disabled?: boolean; tools: string[] }>;
      raw: unknown[];
    }>('/api/mcp'),
  putMcp: (servers: unknown[]) =>
    json<{
      configPath: string;
      servers: Array<{ name: string; command?: string; url?: string; disabled?: boolean; tools: string[] }>;
      raw: unknown[];
    }>('/api/mcp', { method: 'PUT', body: JSON.stringify({ servers }) }),
  toggleMcp: (name: string, disabled: boolean) =>
    json<{
      configPath: string;
      servers: Array<{ name: string; command?: string; url?: string; disabled?: boolean; tools: string[] }>;
      raw: unknown[];
    }>('/api/mcp/toggle', { method: 'POST', body: JSON.stringify({ name, disabled }) }),
  upload: async (file: File, agentId?: string): Promise<AttachmentInfo & { url?: string }> => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return json('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ agentId, name: file.name, contentBase64: btoa(binary), mime: file.type }),
    });
  },
};

export type StreamHandlers = {
  onToken: (content: string) => void;
  onToolCall: (data: { id: string; name: string; arguments: string }) => void;
  onToolResult: (data: { id: string; name: string; result: string }) => void;
  onWidget?: (data: { widgetId: string; question: string; options: string[] }) => void;
  onDone: (content: string) => void;
  onError: (message: string) => void;
  onTyping?: (active: boolean) => void;
  onApproval?: (data: { approvalId: string; toolName: string; command: string }) => void;
  onPresence?: (data: { presence: string; action: string }) => void;
};

async function readSse(res: Response, handlers: StreamHandlers): Promise<void> {
  if (!res.ok || !res.body) {
    handlers.onError((await res.text().catch(() => '')) || 'Échec');
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
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) {
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
            case 'presence':
              handlers.onPresence?.(data);
              break;
            case 'done':
              handlers.onDone(data.content ?? '');
              break;
            case 'error':
              handlers.onError(data.message ?? 'Erreur');
              break;
            default:
              break;
          }
        } catch {
          /* ignore */
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
  signal?: AbortSignal,
  attachmentIds?: string[],
  replyToId?: string
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message, attachmentIds, replyToId }),
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
