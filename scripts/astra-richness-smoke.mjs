import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../apps/server/dist/db/schema.js');
const {
  AgentRepo,
  MemoryRepo,
  MessageRepo,
  MachineRepo,
  ApprovalRepo,
  RoutineRepo,
  SettingsRepo,
} = require('../apps/server/dist/db/repos.js');
const { executeTool, getToolDefs } = require('../apps/server/dist/tools/index.js');
const { loadMcpConfig, closeMcpClients } = require('../apps/server/dist/services/mcp.js');

const ROOT = process.cwd();
const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const stamp = `astra_rich_${Date.now()}`;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-bot-astra-rich-'));
const dataDir = path.join(tmpRoot, 'data');
const workspaceRoot = path.join(tmpRoot, 'workspace');
const skillsDir = path.join(tmpRoot, 'skills');
fs.mkdirSync(workspaceRoot, { recursive: true });
fs.mkdirSync(skillsDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(raw, label) {
  let value;
  try { value = JSON.parse(raw); } catch { return raw; }
  if (value?.error) throw new Error(`${label}: ${value.error}`);
  return value;
}

async function request(route, init = {}, expected = 200) {
  const res = await fetch(`${BASE}${route}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (res.status !== expected) {
    throw new Error(`${init.method || 'GET'} ${route}: expected ${expected}, got ${res.status}: ${text}`);
  }
  return body;
}

const db = openDatabase(dataDir);
const agents = new AgentRepo(db);
const memory = new MemoryRepo(db);
const messages = new MessageRepo(db);
const machines = new MachineRepo(db);
const approvals = new ApprovalRepo(db);
const routines = new RoutineRepo(db);
const settingsRepo = new SettingsRepo(db);
const bot = agents.getByName('dev');
const mcp = loadMcpConfig(ROOT);
const settings = {
  ...settingsRepo.getAll(),
  workspaceRoot,
  installedPlugins: [
    'files', 'browser', 'terminal', 'mail', 'calendar', 'github', 'slack',
    'drive', 'mcp', 'linear', 'crm', 'notion', 'x',
  ],
  pluginDisabledTools: [],
  localExecutionPolicy: 'always',
};
const ctx = {
  workspaceRoot,
  dataDir,
  agentId: bot.id,
  memory,
  agents,
  messages,
  machines,
  approvals,
  routines,
  skillsDir,
  mcp,
  settings,
};

const expectedRoster = [
  'oracle', 'vulcan-forge', 'noesis-grid', 'axon-nexus', 'aegis-ledger',
  'mneme-vault', 'helios-probe', 'daedalus-core', 'sovereign-mind', 'argos-watch',
];
const expectedAdvanced = [
  'create_routine', 'save_skill', 'list_mail', 'draft_mail', 'send_mail',
  'list_events', 'create_event', 'git_status', 'slack_post', 'mcp_list', 'mcp_call',
  'list_issues', 'create_issue', 'list_contacts', 'add_contact', 'list_notes',
  'save_note', 'x_post',
];

let teachSkillName = '';
try {
  const liveAgents = await request('/api/agents');
  assert(liveAgents.length === 10, `expected 10 visible ASTRA Bots, got ${liveAgents.length}`);
  assert(expectedRoster.every((name) => liveAgents.some((a) => a.name === name)), 'ASTRA roster names mismatch');
  assert(liveAgents.every((a) => a.model), 'one or more ASTRA Bots has no per-Bot model');
  console.log('PASS astra-10-bot-roster-model-routing');

  const plugins = await request('/api/plugins');
  assert(plugins.length === 13, `expected 13 plugins, got ${plugins.length}`);
  assert(plugins.every((p) => p.installed), 'not every restored plugin is installed');
  const pluginToolCount = plugins.reduce((n, p) => n + p.tools.length, 0);
  assert(pluginToolCount >= 34, `expected >=34 catalog tool memberships, got ${pluginToolCount}`);
  console.log(`PASS plugin-catalog :: ${plugins.length} plugins / ${pluginToolCount} memberships`);

  const defs = getToolDefs(mcp, settings).map((d) => d.function.name);
  for (const name of expectedAdvanced) assert(defs.includes(name), `tool def missing: ${name}`);
  const filtered = getToolDefs(mcp, { ...settings, pluginDisabledTools: ['x_post'] }).map((d) => d.function.name);
  assert(!filtered.includes('x_post'), 'pluginDisabledTools did not filter x_post');
  console.log(`PASS advanced-tool-registry :: ${defs.length} callable defs`);

  const xDisabled = await request('/api/plugins/x/tools', {
    method: 'POST',
    body: JSON.stringify({ toolName: 'x_post', enabled: false }),
  });
  assert(xDisabled.find((p) => p.slug === 'x')?.tools.find((t) => t.name === 'x_post')?.enabled === false,
    'x_post API toggle off failed');
  const xEnabled = await request('/api/plugins/x/tools', {
    method: 'POST',
    body: JSON.stringify({ toolName: 'x_post', enabled: true }),
  });
  assert(xEnabled.find((p) => p.slug === 'x')?.tools.find((t) => t.name === 'x_post')?.enabled === true,
    'x_post API toggle on failed');
  console.log('PASS plugin-tool-toggle-api');

  const routine = parse(await executeTool('create_routine', JSON.stringify({
    name: `rich-${stamp}`, cron: '0 7 * * *', prompt: 'ASTRA richness smoke',
  }), ctx), 'create_routine');
  assert(routine.ok && routine.routine?.id, 'create_routine failed');
  routines.delete(routine.routine.id);
  console.log('PASS tool-create-routine');

  const skill = parse(await executeTool('save_skill', JSON.stringify({
    name: `rich_skill_${stamp}`, content: '# Rich skill\nVerify, execute, retest.',
  }), ctx), 'save_skill');
  assert(skill.ok && fs.existsSync(path.join(skillsDir, `${skill.name}.md`)), 'save_skill did not persist');
  console.log('PASS tool-save-skill');

  const mail = parse(await executeTool('list_mail', '{}', ctx), 'list_mail');
  assert(Array.isArray(mail), 'list_mail did not return an array');
  const draft = parse(await executeTool('draft_mail', JSON.stringify({
    to: 'test@local', subject: stamp, body: 'local only',
  }), ctx), 'draft_mail');
  assert(draft.ok && draft.draft?.id, 'draft_mail failed');
  const sent = parse(await executeTool('send_mail', JSON.stringify({ id: draft.draft.id }), ctx), 'send_mail');
  assert(sent.ok && sent.sent?.status === 'sent', 'send_mail local simulation failed');
  console.log('PASS tools-mail-local');

  const events = parse(await executeTool('list_events', '{}', ctx), 'list_events');
  assert(Array.isArray(events), 'list_events did not return array');
  const event = parse(await executeTool('create_event', JSON.stringify({
    title: stamp, at: '2026-09-19T09:00:00+02:00', where: 'local',
  }), ctx), 'create_event');
  assert(event.ok, 'create_event failed');
  console.log('PASS tools-calendar-local');

  const gitCtx = { ...ctx, workspaceRoot: ROOT };
  const gitStatus = await executeTool('git_status', '{}', gitCtx);
  assert(gitStatus.includes('## ') || gitStatus.includes('main') || gitStatus.includes('recovery'), 'git_status returned no git output');
  console.log('PASS tool-git-status');

  const slack = parse(await executeTool('slack_post', JSON.stringify({ channel: 'smoke', text: stamp }), ctx), 'slack_post');
  assert(slack.ok, 'slack_post failed');
  const x = parse(await executeTool('x_post', JSON.stringify({ text: stamp, channel: 'timeline' }), ctx), 'x_post');
  assert(x.ok, 'x_post failed');
  console.log('PASS tools-comms-local');

  const mcpList = parse(await executeTool('mcp_list', '{}', ctx), 'mcp_list');
  assert(Array.isArray(mcpList.servers) && mcpList.servers.some((s) => s.name === 'echo'), 'mcp_list missing echo');
  const mcpEcho = parse(await executeTool('mcp_call', JSON.stringify({
    server: 'echo', tool: 'echo', arguments: { message: 'ASTRA_MCP_OK' },
  }), ctx), 'mcp_call');
  assert(mcpEcho.ok && mcpEcho.live && JSON.stringify(mcpEcho).includes('ASTRA_MCP_OK'), 'mcp_call echo failed');
  console.log('PASS tools-mcp-list-call-live');

  const issues = parse(await executeTool('list_issues', '{}', ctx), 'list_issues');
  assert(Array.isArray(issues), 'list_issues failed');
  const issue = parse(await executeTool('create_issue', JSON.stringify({ title: stamp }), ctx), 'create_issue');
  assert(issue.ok, 'create_issue failed');
  const contacts = parse(await executeTool('list_contacts', '{}', ctx), 'list_contacts');
  assert(Array.isArray(contacts), 'list_contacts failed');
  const contact = parse(await executeTool('add_contact', JSON.stringify({
    name: stamp, account: 'ASTRA', note: 'smoke',
  }), ctx), 'add_contact');
  assert(contact.ok, 'add_contact failed');
  console.log('PASS tools-linear-crm-local');

  const note = parse(await executeTool('save_note', JSON.stringify({
    name: stamp, content: '# ASTRA\nrichness smoke',
  }), ctx), 'save_note');
  assert(note.ok, 'save_note failed');
  const notes = parse(await executeTool('list_notes', '{}', ctx), 'list_notes');
  assert(Array.isArray(notes) && notes.some((n) => n.includes(stamp)), 'list_notes missing saved note');
  console.log('PASS tools-notes-local');

  const oracle = liveAgents.find((a) => a.name === 'oracle');
  const goal = `Teach smoke ${stamp}`;
  teachSkillName = goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const teach = await request('/api/teach/start', {
    method: 'POST', body: JSON.stringify({ agentId: oracle.id, goal }),
  });
  await request(`/api/teach/${teach.id}/step`, {
    method: 'POST', body: JSON.stringify({ kind: 'navigate', detail: 'Open the validated local workspace.' }),
  });
  await request(`/api/teach/${teach.id}/step`, {
    method: 'POST', body: JSON.stringify({ kind: 'status', detail: 'Verify health and tests before delivery.' }),
  });
  const savedTeach = await request(`/api/teach/${teach.id}/stop`, { method: 'POST' });
  assert(savedTeach.status === 'saved' && savedTeach.steps.length === 2, 'Teach session did not save');
  const learned = await request(`/api/skills/${teachSkillName}`);
  assert(String(learned.content).includes('Verify health and tests'), 'Teach skill content missing step');
  await request(`/api/skills/${teachSkillName}`, { method: 'DELETE' });
  teachSkillName = '';
  console.log('PASS teach-demonstration-to-skill');

  console.log(JSON.stringify({
    ok: true,
    visibleBots: liveAgents.length,
    plugins: plugins.length,
    pluginToolMemberships: pluginToolCount,
    callableToolDefs: defs.length,
  }, null, 2));
} finally {
  if (teachSkillName) {
    await fetch(`${BASE}/api/skills/${teachSkillName}`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (typeof closeMcpClients === 'function') closeMcpClients();
  db.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
