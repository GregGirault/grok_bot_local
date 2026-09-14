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
} from './db/repos';
import { registerAgentRoutes } from './routes/agents';
import { registerChatRoutes } from './routes/chat';
import { registerSettingsRoutes } from './routes/settings';
import { registerRoutineRoutes } from './routes/routines';
import { RoutineScheduler } from './services/routines';
import type { AgentLoopDeps } from './services/agentLoop';

const VERSION = '0.1.0';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

/** Monorepo root: apps/server/src -> ../../.. */
function findProjectRoot(): string {
  const fromEnv = process.env.GROK_BOT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  // dist/index.js or src/index.ts -> apps/server -> apps -> root
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

  const db = openDatabase(dataDir);
  const agents = new AgentRepo(db);
  const messages = new MessageRepo(db);
  const memory = new MemoryRepo(db);
  const routines = new RoutineRepo(db);
  const settings = new SettingsRepo(db);

  // Ensure workspaceRoot default points somewhere useful
  const current = settings.getAll();
  if (!current.workspaceRoot) {
    settings.set({ workspaceRoot: defaultWorkspace });
  }

  const loopDeps: AgentLoopDeps = {
    messages,
    memory,
    settings,
    skillsDir,
    defaultWorkspace,
  };

  const scheduler = new RoutineScheduler(routines, agents, loopDeps);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  registerAgentRoutes(app, agents, messages, memory);
  registerChatRoutes(app, agents, loopDeps);
  registerSettingsRoutes(app, settings, skillsDir, VERSION);
  registerRoutineRoutes(app, routines, agents, scheduler);

  app.get('/api/version', async () => ({ version: VERSION }));

  await app.listen({ port: PORT, host: HOST });
  scheduler.start();
  console.log(`Grok Bot Local server v${VERSION} on http://${HOST}:${PORT}`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Data: ${dataDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
