import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AgentLoopDeps } from '../services/agentLoop';
import type { RoutineScheduler } from '../services/routines';
import type {
  AgentRepo,
  MessageRepo,
  MemoryRepo,
  RoutineRepo,
  SettingsRepo,
  InboxRepo,
  ChannelRepo,
  TaskRepo,
  MachineRepo,
  TeamMemberRepo,
  ProjectRepo,
  ApprovalRepo,
  UploadRepo,
  ShareRepo,
  SecretRepo,
} from '../db/repos';
import type { HostFacts } from '@grok-bot/shared';

export type SseFn = (reply: FastifyReply) => (event: string, data: unknown) => void;

export interface HttpDeps {
  app: FastifyInstance;
  projectRoot: string;
  dataDir: string;
  skillsDir: string;
  defaultWorkspace: string;
  VERSION: string;
  PORT: number;
  agents: AgentRepo;
  messages: MessageRepo;
  memory: MemoryRepo;
  routines: RoutineRepo;
  settings: SettingsRepo;
  inbox: InboxRepo;
  channels: ChannelRepo;
  tasks: TaskRepo;
  machines: MachineRepo;
  members: TeamMemberRepo;
  projects: ProjectRepo;
  approvals: ApprovalRepo;
  uploads: UploadRepo;
  shares: ShareRepo;
  secrets: SecretRepo;
  loopDeps: AgentLoopDeps;
  scheduler: RoutineScheduler;
  sse: SseFn;
  serverHostFacts: () => HostFacts;
}
