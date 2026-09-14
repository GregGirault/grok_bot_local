export interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  avatarColor: string;
  avatarShape: 'circle' | 'rounded' | 'square' | 'blob' | 'pebble';
  hidden?: boolean;
  notifyOnUpdates?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  avatarColor?: string;
  avatarShape?: 'circle' | 'rounded' | 'square' | 'blob' | 'pebble';
  notifyOnUpdates?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  title?: string;
  description?: string;
  systemPrompt?: string;
  avatarColor?: string;
  avatarShape?: 'circle' | 'rounded' | 'square' | 'blob' | 'pebble';
  hidden?: boolean;
  notifyOnUpdates?: boolean;
}

export type MessageKind = 'text' | 'widget' | 'tool_card' | 'system' | 'approval';

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

export interface ApprovalMeta {
  type: 'approval';
  approvalId: string;
  toolName: string;
  command: string;
  status: 'pending' | 'approved' | 'denied';
}

export interface AttachmentInfo {
  id: string;
  name: string;
  path: string;
  mime?: string;
  size?: number;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  kind?: MessageKind;
  meta?: WidgetMeta | ToolCardMeta | ApprovalMeta | Record<string, unknown>;
  toolName?: string;
  toolCallId?: string;
  attachments?: AttachmentInfo[];
  editedAt?: string;
  createdAt: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  key: string;
  value: string;
  tier?: 'profile' | 'log' | 'note';
  scope?: 'agent' | 'user' | 'project';
  projectId?: string;
  pinned?: boolean;
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
  webhookToken?: string;
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

export interface RoutineRun {
  id: string;
  routineId: string;
  status: 'ok' | 'skipped' | 'error';
  output?: string;
  error?: string;
  createdAt: string;
}

export interface Settings {
  ollamaBaseUrl: string;
  defaultModel: string;
  workspaceRoot: string;
  theme?: 'dark' | 'light' | 'system';
  language?: 'en' | 'fr';
  accentColor?: string;
  taskConcurrency?: number;
  githubRepo?: string;
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
  | 'memory'
  | 'typing'
  | 'approval';

export interface SseEvent {
  type: SseEventType;
  data: unknown;
}

export interface ChatRequest {
  agentId: string;
  message: string;
  model?: string;
  attachmentIds?: string[];
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
  parentTaskId?: string;
  postToChat?: boolean;
  createdAt: string;
  finishedAt?: string;
}

export interface SkillInfo {
  name: string;
  description?: string;
  preview: string;
  content?: string;
  frontmatter?: Record<string, string>;
}

export interface McpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

export interface Machine {
  id: string;
  name: string;
  host: string;
  path: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  createdAt: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  path: string;
  description: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  toolName: string;
  command: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  resolvedAt?: string;
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
  theme: 'dark',
  language: 'en',
  accentColor: '#8b5cf6',
  taskConcurrency: 2,
  githubRepo: 'GregGirault/grok_bot_local',
};
