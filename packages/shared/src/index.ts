export interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  title: string;
  description?: string;
  systemPrompt?: string;
}

export interface UpdateAgentInput {
  name?: string;
  title?: string;
  description?: string;
  systemPrompt?: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolCallId?: string;
  createdAt: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  key: string;
  value: string;
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
  lastRunAt?: string;
  createdAt: string;
}

export interface CreateRoutineInput {
  agentId: string;
  name: string;
  cron: string;
  prompt: string;
  enabled?: boolean;
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

export const DEFAULT_SETTINGS: Settings = {
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  defaultModel: 'llama3.2',
  workspaceRoot: '',
};
