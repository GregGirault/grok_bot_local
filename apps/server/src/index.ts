import path from 'path';
import fs from 'fs';
import os from 'os';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { openDatabase } from './db/schema';
import { seedIfEmpty } from './db/seed';
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
  ShareRepo,
  SecretRepo,
} from './db/repos';
import type { AgentLoopDeps } from './services/agentLoop';
import { RoutineScheduler, TaskRunner } from './services/routines';
import { setSetupPhase } from './services/computer';
import type { HostFacts } from '@grok-bot/shared';
import type { FastifyReply } from 'fastify';
import type { HttpDeps } from './http/deps';
import { registerHttpCore } from './http/core';
import { registerHttpWork } from './http/work';
import { registerHttpExtra } from './http/extra';

function serverHostFacts(): HostFacts {
  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(),
    source: 'server',
    platform: os.platform(),
    arch: os.arch(),
    osLabel: `${os.platform()} ${os.release()}`,
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model,
    cpuCount: cpus.length,
    totalMemGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  };
}

const VERSION = '0.13.0';
const PORT = Number(process.env.PORT || 48732);
const HOST = process.env.HOST || '0.0.0.0';

function findProjectRoot(): string {
  const fromEnv = process.env.GROK_BOT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(process.cwd()),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json')) && fs.existsSync(path.join(c, 'apps'))) return c;
  }
  return path.resolve(process.cwd());
}

function sse(reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  return (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

function loadDotEnv(root: string): void {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const projectRoot = findProjectRoot();
  loadDotEnv(projectRoot);
  const dataDir = path.join(projectRoot, 'data');
  const skillsDir = path.join(projectRoot, 'skills');
  const defaultWorkspace = path.join(projectRoot, 'workspace');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(defaultWorkspace, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

  const db = openDatabase(dataDir);
  seedIfEmpty(db, defaultWorkspace);

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
  const shares = new ShareRepo(db);
  const secrets = new SecretRepo(db);

  const current = settings.getAll();
  if (!current.workspaceRoot) settings.set({ workspaceRoot: defaultWorkspace });
  if (!current.huggingfaceToken && process.env.HF_TOKEN) {
    settings.set({ huggingfaceToken: process.env.HF_TOKEN });
  }
  if (!current.geminiApiKey && process.env.GEMINI_API_KEY) {
    settings.set({ geminiApiKey: process.env.GEMINI_API_KEY });
  }

  const loopDeps: AgentLoopDeps = {
    messages,
    memory,
    settings,
    skillsDir,
    defaultWorkspace,
    dataDir,
    projectRoot,
    agents,
    inbox,
    machines,
    approvals,
    routines,
  };

  const scheduler = new RoutineScheduler(routines, agents, loopDeps);
  const taskRunner = new TaskRunner(tasks, agents, loopDeps, messages, settings);
  loopDeps.spawnTask = (agentId, prompt, parentId) =>
    taskRunner.enqueue(agentId, prompt, { parentTaskId: parentId, postToChat: true });

  const app = Fastify({ logger: false, bodyLimit: 210 * 1024 * 1024 });
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = typeof body === 'string' ? body : '';
    if (!raw.trim()) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw) as unknown);
    } catch (e) {
      done(e as Error, undefined);
    }
  });
  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    root: path.join(dataDir, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });


  const httpDeps: HttpDeps = {
    app,
    projectRoot,
    dataDir,
    skillsDir,
    defaultWorkspace,
    VERSION,
    PORT,
    agents,
    messages,
    memory,
    routines,
    settings,
    inbox,
    channels,
    tasks,
    machines,
    members,
    projects,
    approvals,
    uploads,
    shares,
    secrets,
    loopDeps,
    scheduler,
    sse,
    serverHostFacts,
  };
  registerHttpCore(httpDeps);
  registerHttpWork(httpDeps);
  registerHttpExtra(httpDeps);

  const webDist = path.join(projectRoot, 'apps/web/dist');
  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', decorateReply: true });
  }

  await app.listen({ port: PORT, host: HOST });
  setSetupPhase('starting');
  setTimeout(() => setSetupPhase('ready'), 1600);
  scheduler.start();
  console.log(`Grok Bot Local v${VERSION} → http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
