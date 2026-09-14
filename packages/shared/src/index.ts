export interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  avatarColor: string;
  avatarShape: 'circle' | 'rounded' | 'square';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  avatarColor?: string;
  avatarShape?: 'circle' | 'rounded' | 'square';
}

export interface UpdateAgentInput {
  name?: string;
  title?: string;
  description?: string;
  systemPrompt?: string;
  avatarColor?: string;
  avatarShape?: 'circle' | 'rounded' | 'square';
}

export type MessageKind = 'text' | 'widget' | 'tool_card' | 'system';

export interface WidgetMeta {
  type: 'widget';
  widgetId: string;
  question: string;
  options: string[];
  selected?: string;
}

export interface ToolCardMeta {
  type: 'tool_card';
  toolName: string;
  arguments?: string;
  result?: string;
  callId: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  kind?: MessageKind;
  meta?: WidgetMeta | ToolCardMeta | Record<string, unknown>;
  toolName?: string;
  toolCallId?: string;
  createdAt: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  key: string;
  value: string;
  tier?: 'profile' | 'log' | 'note';
  scope?: 'agent' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface Routine {
  id: string;
  agentId: string;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  quietIfEmpty?: boolean;
  lastRunAt?: string;
  createdAt: string;
}

export interface CreateRoutineInput {
  agentId: string;
  name: string;
  cron: string;
  prompt: string;
  enabled?: boolean;
  quietIfEmpty?: boolean;
}

export interface Settings {
  ollamaBaseUrl: string;
  defaultModel: string;
  workspaceRoot: string;
}

export interface HealthStatus {
  ok: boolean;
  ollama: {
    reachable: boolean;
    baseUrl: string;
    models?: string[];
    error?: string;
  };
  version: string;
}

export type SseEventType =
  | 'token'
  | 'tool_call'
  | 'tool_result'
  | 'widget'
  | 'done'
  | 'error'
  | 'memory';

export interface SseEvent {
  type: SseEventType;
  data: unknown;
}

export interface ChatRequest {
  agentId: string;
  message: string;
  model?: string;
}

export interface InboxMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  read: boolean;
  createdAt: string;
  fromAgentName?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  createdAt: string;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  fromAgentId?: string;
  content: string;
  createdAt: string;
}

export interface BackgroundTask {
  id: string;
  agentId: string;
  prompt: string;
  status: 'queued' | 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface SkillInfo {
  name: string;
  description?: string;
  preview: string;
  frontmatter?: Record<string, string>;
}

export interface McpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
}

export const AVATAR_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  defaultModel: 'qwen2.5:7b',
  workspaceRoot: '',
};
