import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { openDatabase } from './db/schema';
import {
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
} from './db/repos';
import { registerAgentRoutes } from './routes/agents';
import { registerChatRoutes } from './routes/chat';
import { registerSettingsRoutes } from './routes/settings';
import { registerRoutineRoutes } from './routes/routines';
import { registerChannelRoutes } from './routes/channels';
import { registerTaskRoutes } from './routes/tasks';
import { registerMemoryRoutes } from './routes/memory';
import { registerExtraRoutes } from './routes/extra';
import { RoutineScheduler } from './services/routines';
import { TaskRunner } from './services/tasks';
import { loadMcpConfig } from './services/mcp';
import type { AgentLoopDeps } from './services/agentLoop';

const VERSION = '0.3.0';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

function findProjectRoot(): string {
  const fromEnv = process.env.GROK_BOT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(process.cwd()),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json')) && fs.existsSync(path.join(c, 'apps'))) {
      return c;
    }
  }
  return path.resolve(process.cwd());
}

async function main() {
  const projectRoot = findProjectRoot();
  const dataDir = path.join(projectRoot, 'data');
  const skillsDir = path.join(projectRoot, 'skills');
  const defaultWorkspace = path.join(projectRoot, 'workspace');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(defaultWorkspace, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'screenshots'), { recursive: true });

  const db = openDatabase(dataDir);
  const agents = new AgentRepo(db);
  const messages = new MessageRepo(db);
  const memory = new MemoryRepo(db);
  const routines = new RoutineRepo(db);
  const settings = new SettingsRepo(db);
  const inbox = new InboxRepo(db);
  const channels = new ChannelRepo(db);
  const tasks = new TaskRepo(db);
  const machines = new MachineRepo(db);
  const members = new TeamMemberRepo(db);
  const projects = new ProjectRepo(db);
  const approvals = new ApprovalRepo(db);
  const uploads = new UploadRepo(db);

  const current = settings.getAll();
  if (!current.workspaceRoot) {
    settings.set({ workspaceRoot: defaultWorkspace });
  }

  // Fill local machine path if empty
  const machineList = machines.list();
  const local = machineList.find((m) => m.name === 'This machine');
  if (local && !local.path) {
    machines.update(local.id, { path: defaultWorkspace });
  }

  let mcp = loadMcpConfig(projectRoot);

  const loopDeps: AgentLoopDeps = {
    messages,
    memory,
    settings,
    skillsDir,
    defaultWorkspace,
    dataDir,
    agents,
    inbox,
    machines,
    approvals,
    mcp,
  };

  const scheduler = new RoutineScheduler(routines, agents, loopDeps);
  const taskRunner = new TaskRunner(tasks, agents, loopDeps, messages, settings);
  loopDeps.spawnTask = (agentId, prompt, parentId) =>
    taskRunner.enqueue(agentId, prompt, { parentTaskId: parentId, postToChat: true });

  const app = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });
  await app.register(cors, { origin: true });

  // Serve screenshots / uploads
  await app.register(fastifyStatic, {
    root: path.join(dataDir, 'screenshots'),
    prefix: '/screenshots/',
    decorateReply: false,
  });
  await app.register(fastifyStatic, {
    root: path.join(dataDir, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  registerAgentRoutes(app, agents, messages, memory, inbox);
  registerChatRoutes(app, agents, messages, loopDeps, uploads, dataDir);
  registerSettingsRoutes(app, settings, skillsDir, VERSION, () => mcp, projectRoot, (m) => {
    mcp = m;
    loopDeps.mcp = m;
  });
  registerRoutineRoutes(app, routines, agents, scheduler);
  registerChannelRoutes(app, channels, agents, inbox, messages);
  registerTaskRoutes(app, tasks, agents, taskRunner);
  registerMemoryRoutes(app, memory, agents);
  registerExtraRoutes(app, {
    machines,
    members,
    projects,
    approvals,
    channels,
    agents,
    messages,
    memory,
    uploads,
    dataDir,
    version: VERSION,
    settings,
    projectRoot,
    reloadMcp: () => {
      mcp = loadMcpConfig(projectRoot);
      loopDeps.mcp = mcp;
      return mcp;
    },
  });

  app.get('/api/version', async () => ({ version: VERSION }));

  await app.listen({ port: PORT, host: HOST });
  scheduler.start();
  // Promote memory tiers periodically
  setInterval(() => memory.promoteStale(7), 60 * 60 * 1000);

  console.log(`Grok Bot Local server v${VERSION} on http://${HOST}:${PORT}`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Data: ${dataDir}`);
  console.log(`MCP servers: ${mcp.serverNames.length ? mcp.serverNames.join(', ') : '(none)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
