import type { AgentRepo, InboxRepo, MemoryRepo, MessageRepo, MachineRepo, ApprovalRepo, RoutineRepo } from '../db/repos';
import type { AutoReviewRule } from '@grok-bot/shared';

export interface ToolContext {
  workspaceRoot: string;
  dataDir: string;
  agentId: string;
  memory: MemoryRepo;
  agents?: AgentRepo;
  inbox?: InboxRepo;
  messages?: MessageRepo;
  machines?: MachineRepo;
  approvals?: ApprovalRepo;
  spawnTask?: (agentId: string, prompt: string, parentId?: string) => { id: string };
  onWidget?: (widget: { widgetId: string; question: string; options: string[] }) => void;
  onApproval?: (approval: { approvalId: string; toolName: string; command: string }) => void;
  installedPlugins?: string[];
  pluginDisabledTools?: string[];
  autoReviewRules?: AutoReviewRule[];
  autoReviewEnforced?: boolean;
  allowCloudAgents?: boolean;
  networkMode?: 'allow-all' | 'allowlist';
  networkAllowlist?: string[];
  actionRecording?: boolean;
  localPolicy?: 'ask' | 'always' | 'never';
  geminiApiKey?: string;
  skillsDir?: string;
  projectRoot?: string;
  routines?: RoutineRepo;
}
