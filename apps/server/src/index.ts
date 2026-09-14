import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
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
} from './db/repos';
import { registerAgentRoutes } from './routes/agents';
import { registerChatRoutes } from './routes/chat';
import { registerSettingsRoutes } from './routes/settings';
import { registerRoutineRoutes } from './routes/routines';
import { registerChannelRoutes } from './routes/channels';
import { registerTaskRoutes } from './routes/tasks';
import { registerMemoryRoutes } from './routes/memory';
import { RoutineScheduler } from './services/routines';
import { TaskRunner } from './services/tasks';
import { loadMcpConfig } from './services/mcp';
import type { AgentLoopDeps } from './services/agentLoop';

const VERSION = '0.2.0';
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

  const db = openDatabase(dataDir);
  const agents = new AgentRepo(db);
  const messages = new MessageRepo(db);
  const memory = new MemoryRepo(db);
  const routines = new RoutineRepo(db);
  const settings = new SettingsRepo(db);
  const inbox = new InboxRepo(db);
  const channels = new ChannelRepo(db);
  const tasks = new TaskRepo(db);

  const current = settings.getAll();
  if (!current.workspaceRoot) {
    settings.set({ workspaceRoot: defaultWorkspace });
  }

  const mcp = loadMcpConfig(projectRoot);

  const loopDeps: AgentLoopDeps = {
    messages,
    memory,
    settings,
    skillsDir,
    defaultWorkspace,
    agents,
    inbox,
    mcp,
  };

  const scheduler = new RoutineScheduler(routines, agents, loopDeps);
  const taskRunner = new TaskRunner(tasks, agents, loopDeps);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  registerAgentRoutes(app, agents, messages, memory, inbox);
  registerChatRoutes(app, agents, messages, loopDeps);
  registerSettingsRoutes(app, settings, skillsDir, VERSION, mcp);
  registerRoutineRoutes(app, routines, agents, scheduler);
  registerChannelRoutes(app, channels, agents, inbox, messages);
  registerTaskRoutes(app, tasks, agents, taskRunner);
  registerMemoryRoutes(app, memory, agents);

  app.get('/api/version', async () => ({ version: VERSION }));

  await app.listen({ port: PORT, host: HOST });
  scheduler.start();
  console.log(`Grok Bot Local server v${VERSION} on http://${HOST}:${PORT}`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Data: ${dataDir}`);
  console.log(`MCP servers: ${mcp.serverNames.length ? mcp.serverNames.join(', ') : '(none)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
