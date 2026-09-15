export type AvatarShape =
  | 'circle'
  | 'blob'
  | 'rounded'
  | 'pill'
  | 'triangle'
  | 'hexagon'
  | 'cloud'
  | 'drop'
  | 'square'
  | 'pebble';

/** Official Grok Bot character grid (8 shapes). `square` and `pebble` stay valid for older bots. */
export const AVATAR_SHAPES: AvatarShape[] = [
  'circle',
  'blob',
  'rounded',
  'pill',
  'triangle',
  'hexagon',
  'cloud',
  'drop',
];

export const DEFAULT_AVATAR_SHAPE: AvatarShape = 'blob';
export const DEFAULT_AVATAR_COLOR = '#FF6A00';

export function normalizeAvatarShape(shape: string | undefined | null): AvatarShape {
  switch (shape) {
    case 'circle':
    case 'blob':
    case 'rounded':
    case 'pill':
    case 'triangle':
    case 'hexagon':
    case 'cloud':
    case 'drop':
    case 'square':
    case 'pebble':
      return shape;
    default:
      return DEFAULT_AVATAR_SHAPE;
  }
}

export type Presence = 'idle' | 'thinking' | 'working' | 'waiting' | 'blocked' | 'done';

export type Attention = 'none' | 'unread' | 'needs_attention';

export type ModelProvider = 'ollama' | 'huggingface';

export const MODEL_PROVIDERS: ModelProvider[] = ['ollama', 'huggingface'];

export function normalizeModelProvider(value: string | undefined | null): ModelProvider {
  switch (value) {
    case 'ollama':
    case 'huggingface':
      return value;
    default:
      return 'ollama';
  }
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  /** Ollama tag. Empty = Settings.defaultModel. */
  model: string;
  /** Hugging Face Inference Providers id, e.g. Qwen/Qwen3-32B:fastest */
  hfModel: string;
  modelProvider: ModelProvider;
  avatarColor: string;
  avatarShape: AvatarShape;
  accessory: string;
  hidden: boolean;
  pinned: boolean;
  notifyOnUpdates: boolean;
  lastPreview: string;
  lastActivityAt: string;
  unread: boolean;
  attention: Attention;
  presence: Presence;
  currentAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name?: string;
  title?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  hfModel?: string;
  modelProvider?: ModelProvider;
  avatarColor?: string;
  avatarShape?: AvatarShape;
  accessory?: string;
  notifyOnUpdates?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  title?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  hfModel?: string;
  modelProvider?: ModelProvider;
  avatarColor?: string;
  avatarShape?: AvatarShape;
  accessory?: string;
  hidden?: boolean;
  pinned?: boolean;
  notifyOnUpdates?: boolean;
  unread?: boolean;
  attention?: Attention;
}

export type MessageKind = 'text' | 'widget' | 'tool_card' | 'system' | 'approval' | 'event';

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

export interface EventMeta {
  type: 'event';
  event: 'routine_created' | 'handoff' | 'computer' | 'skill';
  label: string;
  bots?: string[];
  count?: number;
  schedule?: string;
  name?: string;
}

export interface EmailMeta {
  type: 'email';
  status: 'draft' | 'ready' | 'sent' | 'discarded';
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface CalendarMeta {
  type: 'calendar';
  title: string;
  at: string;
  where?: string;
}

export interface BoardMeta {
  type: 'board';
  title: string;
  columns: Array<{ name: string; items: string[] }>;
}

export interface FileCardMeta {
  type: 'file';
  name: string;
  mime?: string;
  size?: number;
  url?: string;
}

export interface LinkMeta {
  type: 'link';
  url: string;
  title?: string;
}

export interface ActivityMeta {
  type: 'activity';
  title: string;
  steps: Array<{ label: string; detail?: string }>;
}

export interface SecretMeta {
  type: 'secret';
  secretId: string;
  plugin?: string;
  keyName: string;
  prompt: string;
  filled?: boolean;
}

export interface AttachmentInfo {
  id: string;
  name: string;
  path: string;
  mime?: string;
  size?: number;
  url?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  kind?: MessageKind;
  meta?:
    | WidgetMeta
    | ToolCardMeta
    | ApprovalMeta
    | EventMeta
    | EmailMeta
    | ActivityMeta
    | SecretMeta
    | CalendarMeta
    | BoardMeta
    | FileCardMeta
    | LinkMeta
    | Record<string, unknown>;
  toolName?: string;
  toolCallId?: string;
  attachments?: AttachmentInfo[];
  reactions?: Reaction[];
  replyToId?: string;
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
  huggingfaceToken?: string;
  huggingfaceBaseUrl?: string;
  geminiApiKey?: string;
  workspaceRoot: string;
  theme?: 'dark' | 'light' | 'system';
  language?: 'fr' | 'en';
  accentColor?: string;
  taskConcurrency?: number;
  timezone?: string;
  timezoneAuto?: boolean;
  notificationsEnabled?: boolean;
  accountEmail?: string;
  localComputerPolicy?: 'ask' | 'always' | 'never';
  githubRepo?: string;
  accountName?: string;
  computerImage?: string;
  installedPlugins?: string[];
  pluginDisabledTools?: string[];
  botSkills?: Record<string, string[]>;
  autoReviewRules?: AutoReviewRule[];
  weeklyUsage?: WeeklyUsage;
  autoReviewEnforced?: boolean;
  allowCloudAgents?: boolean;
  publicSharing?: boolean;
  networkMode?: 'allow-all' | 'allowlist';
  networkAllowlist?: string[];
  actionRecording?: boolean;
  hostFacts?: HostFacts;
}

export interface HostFacts {
  capturedAt: string;
  source: 'electron' | 'browser' | 'script' | 'server';
  platform?: string;
  arch?: string;
  osLabel?: string;
  hostname?: string;
  cpuModel?: string;
  cpuCount?: number;
  totalMemGb?: number;
  deviceMemoryGb?: number;
  gpu?: string;
  userAgent?: string;
}

export interface AutoReviewRule {
  id: string;
  kind: 'require' | 'allow';
  pattern: string;
  toolName?: string;
}

export interface WeeklyUsage {
  messages: number;
  tools: number;
  weekStart: string;
}

export interface PluginInfo {
  slug: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  enabled: boolean;
  tools: Array<{ name: string; enabled: boolean }>;
  local: boolean;
  auth?: 'none' | 'secret' | 'browser';
}

export interface Notice {
  id: string;
  agentId?: string;
  title: string;
  body: string;
  requestId?: string;
  dismissed: boolean;
  createdAt: string;
}

export interface SharePayload {
  token: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  model?: string;
  hfModel?: string;
  modelProvider?: ModelProvider;
  avatarColor: string;
  avatarShape: AvatarShape;
  accessory: string;
  routines: Array<{ name: string; cron: string; prompt: string }>;
}

export interface TeachSession {
  id: string;
  agentId: string;
  goal: string;
  steps: Array<{ kind: string; detail: string; at: string }>;
  status: 'recording' | 'review' | 'saved';
  createdAt: string;
}

export interface HealthStatus {
  ok: boolean;
  ollama: {
    reachable: boolean;
    baseUrl: string;
    models?: string[];
    error?: string;
  };
  llmMode: 'ollama' | 'huggingface' | 'local';
  huggingface?: {
    configured: boolean;
    reachable: boolean;
    error?: string;
  };
  version: string;
  hostFacts?: HostFacts;
  serverHost?: HostFacts;
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
  | 'approval'
  | 'presence'
  | 'computer';

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
  lastPreview: string;
  lastActivityAt: string;
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

export interface ComputerEvent {
  id: string;
  agentId: string;
  kind: 'navigate' | 'type' | 'click' | 'shell' | 'file' | 'status';
  detail: string;
  at: string;
}

export interface ComputerState {
  active: boolean;
  agentId?: string;
  wallpaper: 'dawn' | 'day' | 'dusk' | 'night';
  url?: string;
  events: ComputerEvent[];
  takeover: boolean;
  image?: string;
  reachable: boolean;
  setupPhase?: 'starting' | 'updating' | 'ready';
}

/** Official Grok Bot character colors (11), then a few extras kept for existing bots. */
export const AVATAR_COLORS = [
  '#FFFFFF',
  '#8B5A2B',
  '#E53935',
  '#FF6A00',
  '#F5A623',
  '#2ECC71',
  '#1ABC9C',
  '#4A90E2',
  '#9B59B6',
  '#FF4FA3',
  '#8E8E93',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  defaultModel: 'qwen2.5:14b',
  huggingfaceBaseUrl: 'https://router.huggingface.co/v1',
  geminiApiKey: '',
  workspaceRoot: '',
  theme: 'dark',
  language: 'fr',
  accentColor: '#8b5cf6',
  taskConcurrency: 2,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  timezoneAuto: true,
  notificationsEnabled: true,
  accountEmail: 'yakary88@gmail.com',
  localComputerPolicy: 'ask',
  githubRepo: 'GregGirault/grok_bot_local',
  accountName: '3pas sage .',
  computerImage: 'local-1',
  installedPlugins: ['files', 'browser', 'terminal'],
  pluginDisabledTools: [],
  botSkills: {},
  autoReviewRules: [],
  weeklyUsage: { messages: 0, tools: 0, weekStart: '' },
  autoReviewEnforced: true,
  allowCloudAgents: true,
  publicSharing: false,
  networkMode: 'allow-all',
  networkAllowlist: [],
  actionRecording: false,
};

/** Tags Ollama de la flotte GPT-6-ASTRA 10 (déjà prévus sur PC-PORTABLE). */
export const RECOMMENDED_LOCAL_MODELS = [
  'qwen3:30b',
  'qwen2.5-coder:14b',
  'qwen2.5:14b',
  'qwen3:8b',
  'qwen2.5-coder:7b',
] as const;

/** Flotte GPT-6-ASTRA 10 — 2ᵉ ligne roster = specialty. */
export const DOMAIN_MODELS = [
  {
    name: 'oracle',
    title: 'ORACLE · Orchestration 24/7',
    ollama: 'qwen3:30b',
    huggingface: 'hf.co/Qwen/Qwen2.5-14B-Instruct-GGUF',
  },
  {
    name: 'vulcan-forge',
    title: 'VULCAN-FORGE · TS / React / Node / Python / PHP',
    ollama: 'qwen2.5-coder:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
  },
  {
    name: 'noesis-grid',
    title: 'NOESIS-GRID · HAOS · MYÉLIA · Argos',
    ollama: 'qwen2.5:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
  },
  {
    name: 'axon-nexus',
    title: 'AXON-NEXUS · Android · RFCY90YLP1R',
    ollama: 'qwen2.5:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
  },
  {
    name: 'aegis-ledger',
    title: 'AEGIS-LEDGER · Crypto · freqtrade · Hyperliquid',
    ollama: 'qwen2.5:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
  },
  {
    name: 'mneme-vault',
    title: 'MNEME-VAULT · Mémoire · rien n’est oublié',
    ollama: 'qwen2.5:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
  },
  {
    name: 'helios-probe',
    title: 'HELIOS-PROBE · Recherche · DDG · Wiki · Jina',
    ollama: 'qwen3:8b',
    huggingface: 'hf.co/Qwen/Qwen2.5-14B-Instruct-GGUF',
  },
  {
    name: 'daedalus-core',
    title: 'DAEDALUS-CORE · Windows · Ops · Codex failover',
    ollama: 'qwen2.5:14b',
    huggingface: 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
  },
  {
    name: 'sovereign-mind',
    title: 'SOVEREIGN-MIND · Architecture · arbitrage IA',
    ollama: 'qwen3:30b',
    huggingface: 'hf.co/Qwen/Qwen2.5-14B-Instruct-GGUF',
  },
  {
    name: 'argos-watch',
    title: 'ARGOS-WATCH · Review · tests · régressions',
    ollama: 'qwen2.5-coder:7b',
    huggingface: 'hf.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
  },
] as const;

export const RECOMMENDED_OLLAMA_PULLS = [...new Set(DOMAIN_MODELS.map((d) => d.ollama))];

export function resolveAgentModel(agentModel: string | undefined | null, defaultModel: string): string {
  const m = agentModel?.trim();
  return m || defaultModel;
}

/** Prénom roster Grok (oracle → Oracle, vulcan-forge → Vulcan-Forge). */
export function displayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/([-_])/)
    .map((part) => {
      if (part === '-' || part === '_') return '-';
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

export function formatCron(cron: string, lang: 'fr' | 'en' = 'fr'): string {
  const map: Record<string, { fr: string; en: string }> = {
    '0 8 * * *': { fr: 'Tous les jours à 8:00', en: 'Every day at 8:00 AM' },
    '0 8 * * 1-5': { fr: 'En semaine à 8:00', en: 'Weekdays at 8:00 AM' },
    '0 9 * * 1-5': { fr: 'En semaine à 9:00', en: 'Weekdays at 9:00 AM' },
    '0 18 * * 1-5': { fr: 'En semaine à 18:00', en: 'Weekdays at 6:00 PM' },
    '0 9 * * 1': { fr: 'Tous les lundis à 9:00', en: 'Every Monday at 9:00 AM' },
    '0 1 1 * *': { fr: 'Le 1er de chaque mois à 8:00', en: 'Monthly on the 1st at 8:00 AM' },
    '*/30 * * * *': { fr: 'Toutes les 30 minutes', en: 'Every 30 minutes' },
    'event:webhook': { fr: 'Quand le webhook reçoit un POST', en: 'When webhook receives a POST' },
    'event:github': { fr: 'Événement GitHub (PR, push, issue)', en: 'GitHub event (PR, push, issue)' },
    'event:slack': { fr: 'Nouveau message Slack local', en: 'New local Slack message' },
    'event:file': { fr: 'Fichier modifié dans /workspace', en: 'File changed in /workspace' },
  };
  const hit = map[cron];
  if (hit) return hit[lang];
  return cron;
}
