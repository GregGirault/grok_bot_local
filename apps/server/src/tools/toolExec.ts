import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { pushComputer } from '../services/computer';
import { pluginAllows, listMail, draftMail, sendMail, listCalendar, createCalendarEvent, slackPost, listIssues, createIssue, listContacts, addContact, listNotes, saveNote } from '../services/plugins';
import { executeMcpTool, loadMcpConfig } from '../services/mcp';
import { reviewAction } from '../services/autoReview';
import { saveSkill } from '../services/skills';
import type { ToolContext } from './toolContext';
import { toolWebFetch, toolWebSearch } from './toolWeb';

const execFileAsync = promisify(execFile);

const BLOCKED_SHELL = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  />\s*\/dev\//,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bformat\s+[a-z]:/i,
  /\bcipher\s+\/w/i,
];

const DANGEROUS_ASK = [/\brm\s+/i, /\bchmod\b/i, /\bchown\b/i, /\bkill\b/i, /\bdrop\s+table\b/i];

function resolveSafe(workspaceRoot: string, rel: string): string {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, rel || '.');
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`Chemin hors workspace : ${rel}`);
  }
  return target;
}

export async function executeTool(name: string, argsJson: string, ctx: ToolContext, skipReview = false): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: 'Arguments JSON invalides' });
  }
  try {
    if (!skipReview && ctx.installedPlugins && !pluginAllows(ctx.installedPlugins, name, ctx.pluginDisabledTools ?? [])) {
      return JSON.stringify({ error: `Plugin requis pour ${name}. Installe-le dans Réglages → Plugins.` });
    }
    if (!skipReview) {
      const decision = reviewAction(
        ctx.autoReviewRules ?? [],
        name,
        argsJson,
        ctx.localPolicy ?? 'ask',
        ctx.autoReviewEnforced !== false
      );
      if (decision === 'deny') return JSON.stringify({ error: 'Action bloquée par la politique ordinateur local / auto-revue.' });
      if (decision === 'require' && ctx.approvals && name !== 'ask_user' && name !== 'request_secret') {
        return requestApproval(name, argsJson, ctx);
      }
    }
    if (ctx.actionRecording) {
      const logDir = path.join(ctx.workspaceRoot, 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'actions.log'), `${new Date().toISOString()} ${ctx.agentId} ${name} ${argsJson.slice(0, 240)}\n`);
    }
    switch (name) {
      case 'shell':
        return await toolShell(String(args.command ?? ''), ctx);
      case 'read_file':
        return toolReadFile(String(args.path ?? ''), ctx);
      case 'write_file':
        return toolWriteFile(String(args.path ?? ''), String(args.content ?? ''), ctx);
      case 'list_dir':
        return toolListDir(String(args.path ?? '.'), ctx);
      case 'web_fetch':
        return await toolWebFetch(String(args.url ?? ''), ctx);
      case 'web_search':
        return await toolWebSearch(String(args.query ?? ''), ctx);
      case 'write_memory': {
        const entry = ctx.memory.write(
          ctx.agentId,
          String(args.key ?? ''),
          String(args.value ?? ''),
          (String(args.tier ?? 'note') as 'profile' | 'log' | 'note') || 'note',
          (String(args.scope ?? 'agent') as 'agent' | 'user' | 'project') || 'agent'
        );
        return JSON.stringify({ ok: true, entry });
      }
      case 'forget_memory':
        return JSON.stringify({ ok: ctx.memory.forget(ctx.agentId, String(args.key ?? '')), key: args.key });
      case 'recall_memory': {
        const hits = ctx.memory.search(String(args.query ?? ''), ctx.agentId);
        return JSON.stringify({ count: hits.length, entries: hits });
      }
      case 'send_to_agent':
        return toolSendToAgent(String(args.agent ?? ''), String(args.message ?? ''), ctx);
      case 'ask_user':
        return toolAskUser(String(args.question ?? ''), args.options, ctx);
      case 'spawn_task':
        return toolSpawnTask(String(args.prompt ?? ''), args.agent ? String(args.agent) : undefined, ctx);
      case 'create_routine':
        return toolCreateRoutine(String(args.name ?? ''), String(args.cron ?? ''), String(args.prompt ?? ''), ctx);
      case 'save_skill':
        return toolSaveSkill(String(args.name ?? ''), String(args.content ?? ''), ctx);
      case 'browse':
        pushComputer(ctx.agentId, 'navigate', String(args.url ?? ''));
        return JSON.stringify({ ok: true, url: args.url });
      case 'list_mail':
        return listMail(ctx.workspaceRoot);
      case 'draft_mail':
        return draftMail(ctx.workspaceRoot, String(args.to ?? ''), String(args.subject ?? ''), String(args.body ?? ''), ctx.agentId);
      case 'send_mail':
        return sendMail(ctx.workspaceRoot, String(args.id ?? ''), ctx.agentId);
      case 'list_events':
        return listCalendar(ctx.workspaceRoot);
      case 'create_event':
        return createCalendarEvent(ctx.workspaceRoot, String(args.title ?? ''), String(args.at ?? ''), String(args.where ?? ''));
      case 'git_status':
        return runShell('git status -sb && git log -5 --oneline', ctx);
      case 'slack_post':
        return slackPost(ctx.workspaceRoot, String(args.channel ?? 'general'), String(args.text ?? ''));
      case 'mcp_list':
        return JSON.stringify(loadMcpConfig(ctx.projectRoot || ctx.workspaceRoot).config);
      case 'mcp_call': {
        const root = ctx.projectRoot || ctx.workspaceRoot;
        const loaded = loadMcpConfig(root);
        const server = String(args.server ?? '');
        const tool = String(args.tool ?? '');
        const callArgs = args.arguments ?? args.args ?? {};
        const inner = typeof callArgs === 'string' ? callArgs : JSON.stringify(callArgs);
        const toolName = `mcp_${server}_${tool}`.replace(/[^a-zA-Z0-9_]/g, '_');
        return await executeMcpTool(toolName, inner, loaded);
      }
      case 'request_secret':
        return toolRequestSecret(String(args.keyName ?? ''), String(args.prompt ?? ''), args.plugin ? String(args.plugin) : undefined, ctx);
      case 'list_issues':
        return listIssues(ctx.workspaceRoot);
      case 'create_issue':
        return createIssue(ctx.workspaceRoot, String(args.title ?? ''));
      case 'list_contacts':
        return listContacts(ctx.workspaceRoot);
      case 'add_contact':
        return addContact(ctx.workspaceRoot, String(args.name ?? ''), String(args.account ?? ''), String(args.note ?? ''));
      case 'list_notes':
        return listNotes(ctx.workspaceRoot);
      case 'save_note':
        return saveNote(ctx.workspaceRoot, String(args.name ?? ''), String(args.content ?? ''));
      case 'x_post':
        return slackPost(path.join(ctx.workspaceRoot, 'x'), String(args.channel ?? 'timeline'), String(args.text ?? ''));
      default:
        if (name.startsWith('mcp_')) {
          return await executeMcpTool(name, argsJson, loadMcpConfig(ctx.projectRoot || ctx.workspaceRoot));
        }
        return JSON.stringify({ error: `Outil inconnu : ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

function requestApproval(toolName: string, command: string, ctx: ToolContext): string {
  if (!ctx.approvals) return JSON.stringify({ error: 'Approbation requise mais indisponible' });
  const approval = ctx.approvals.create(ctx.agentId, toolName, command);
  const widgetId = uuid();
  const meta = {
    type: 'widget' as const,
    widgetId,
    question: `Approuver cette action ?\n\n${toolName}\n${command.slice(0, 800)}`,
    options: ['Autoriser une fois', 'Toujours autoriser', 'Refuser'],
  };
  ctx.messages?.add({
    agentId: ctx.agentId,
    role: 'assistant',
    content: meta.question,
    kind: 'approval',
    meta: { type: 'approval', approvalId: approval.id, toolName, command, status: 'pending' },
  });
  ctx.messages?.add({ agentId: ctx.agentId, role: 'assistant', content: meta.question, kind: 'widget', meta });
  ctx.onWidget?.(meta);
  ctx.onApproval?.({ approvalId: approval.id, toolName, command });
  return JSON.stringify({ ok: false, pendingApproval: true, approvalId: approval.id });
}

function toolCreateRoutine(name: string, cron: string, prompt: string, ctx: ToolContext): string {
  if (!ctx.routines) return JSON.stringify({ error: 'Routines non configurées' });
  if (!name.trim() || !cron.trim() || !prompt.trim()) return JSON.stringify({ error: 'name, cron et prompt requis' });
  const r = ctx.routines.create({ agentId: ctx.agentId, name: name.trim(), cron: cron.trim(), prompt: prompt.trim() });
  ctx.messages?.add({
    agentId: ctx.agentId,
    role: 'assistant',
    content: '',
    kind: 'event',
    meta: { type: 'event', event: 'routine_created', label: r.name, name: r.name, schedule: r.cron },
  });
  return JSON.stringify({ ok: true, routine: r });
}

function toolSaveSkill(name: string, content: string, ctx: ToolContext): string {
  if (!ctx.skillsDir) return JSON.stringify({ error: 'Compétences non configurées' });
  const body = content.includes('---') ? content : `---\nname: ${name}\ndescription: ${name}\n---\n\n${content}`;
  saveSkill(ctx.skillsDir, name, body);
  return JSON.stringify({ ok: true, name });
}

function toolRequestSecret(keyName: string, prompt: string, plugin: string | undefined, ctx: ToolContext): string {
  const secretId = uuid();
  const meta = { type: 'secret' as const, secretId, plugin, keyName, prompt, filled: false };
  ctx.messages?.add({ agentId: ctx.agentId, role: 'assistant', content: prompt, kind: 'widget', meta });
  ctx.onWidget?.({ widgetId: secretId, question: prompt, options: [] });
  return JSON.stringify({ ok: true, secretId, message: 'Secret demandé. Attends la saisie masquée.' });
}

function toolSpawnTask(prompt: string, agentRef: string | undefined, ctx: ToolContext): string {
  if (ctx.allowCloudAgents === false) return JSON.stringify({ error: 'Les Cloud Agents sont désactivés (Réglages → Général).' });
  if (!prompt.trim()) return JSON.stringify({ error: 'Invite vide' });
  if (!ctx.spawnTask) return JSON.stringify({ error: 'Tâches non configurées' });
  let agentId = ctx.agentId;
  if (agentRef && ctx.agents) {
    const dest =
      ctx.agents.get(agentRef) ||
      ctx.agents.getByName(agentRef) ||
      ctx.agents.list(true).find((a) => a.name.toLowerCase() === agentRef.toLowerCase());
    if (!dest) return JSON.stringify({ error: `Bot introuvable : ${agentRef}` });
    agentId = dest.id;
  }
  const task = ctx.spawnTask(agentId, prompt.trim());
  return JSON.stringify({ ok: true, taskId: task.id, agentId });
}

function toolSendToAgent(target: string, message: string, ctx: ToolContext): string {
  if (!ctx.agents || !ctx.inbox) return JSON.stringify({ error: 'Messagerie bots non configurée' });
  const dest =
    ctx.agents.get(target) ||
    ctx.agents.getByName(target) ||
    ctx.agents.list(true).find((a) => a.name.toLowerCase() === target.toLowerCase());
  if (!dest) return JSON.stringify({ error: `Bot introuvable : ${target}` });
  const msg = ctx.inbox.send(ctx.agentId, dest.id, message.trim());
  ctx.messages?.add({
    agentId: dest.id,
    role: 'system',
    content: `[Transfert] ${message.trim()}`,
    kind: 'event',
    meta: { type: 'event', event: 'handoff', label: 'Transfert' },
  });
  ctx.agents.update(dest.id, { unread: true, attention: 'needs_attention', lastPreview: message.slice(0, 120) });
  return JSON.stringify({ ok: true, inboxId: msg.id, to: { id: dest.id, name: dest.name } });
}

function toolAskUser(question: string, optionsRaw: unknown, ctx: ToolContext): string {
  const options = Array.isArray(optionsRaw) ? optionsRaw.map((o) => String(o)).filter(Boolean).slice(0, 6) : [];
  if (!question.trim() || options.length < 2) {
    return JSON.stringify({ error: 'ask_user demande une question et au moins 2 options' });
  }
  const widgetId = uuid();
  const meta = { type: 'widget' as const, widgetId, question: question.trim(), options };
  ctx.messages?.add({ agentId: ctx.agentId, role: 'assistant', content: question.trim(), kind: 'widget', meta });
  ctx.onWidget?.(meta);
  return JSON.stringify({ ok: true, widgetId, message: 'Question affichée. Attends la sélection.' });
}

async function toolShell(command: string, ctx: ToolContext): Promise<string> {
  if (!command.trim()) return JSON.stringify({ error: 'Commande vide' });
  for (const re of BLOCKED_SHELL) {
    if (re.test(command)) return JSON.stringify({ error: 'Commande bloquée par le bac à sable' });
  }
  const needsAsk = DANGEROUS_ASK.some((re) => re.test(command));
  if (needsAsk && ctx.localPolicy !== 'always' && ctx.approvals) {
    const approval = ctx.approvals.create(ctx.agentId, 'shell', command);
    const widgetId = uuid();
    const meta = {
      type: 'widget' as const,
      widgetId,
      question: `Approuver cette commande sensible ?\n\n\`\`\`\n${command}\n\`\`\``,
      options: ['Autoriser une fois', 'Refuser'],
    };
    ctx.messages?.add({
      agentId: ctx.agentId,
      role: 'assistant',
      content: meta.question,
      kind: 'approval',
      meta: { type: 'approval', approvalId: approval.id, toolName: 'shell', command, status: 'pending' },
    });
    ctx.messages?.add({ agentId: ctx.agentId, role: 'assistant', content: meta.question, kind: 'widget', meta });
    ctx.onWidget?.(meta);
    ctx.onApproval?.({ approvalId: approval.id, toolName: 'shell', command });
    return JSON.stringify({ ok: false, pendingApproval: true, approvalId: approval.id });
  }
  pushComputer(ctx.agentId, 'shell', command);
  return runShell(command, ctx);
}

export async function runShell(command: string, ctx: ToolContext): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], {
      cwd: ctx.workspaceRoot,
      timeout: 30_000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, HOME: ctx.workspaceRoot, PATH: process.env.PATH },
    });
    return [stdout, stderr].filter(Boolean).join('\n').slice(0, 20_000) || '(aucune sortie)';
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return JSON.stringify({ error: err.message ?? String(e), stdout: err.stdout, stderr: err.stderr });
  }
}

function toolReadFile(rel: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  if (!fs.existsSync(full)) return JSON.stringify({ error: 'Fichier introuvable' });
  const stat = fs.statSync(full);
  if (!stat.isFile()) return JSON.stringify({ error: 'Pas un fichier' });
  if (stat.size > 512 * 1024) return JSON.stringify({ error: 'Fichier trop volumineux' });
  pushComputer(ctx.agentId, 'file', `Lecture ${rel}`);
  return fs.readFileSync(full, 'utf-8');
}

function toolWriteFile(rel: string, content: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  pushComputer(ctx.agentId, 'file', `Écriture ${rel}`);
  return JSON.stringify({ ok: true, path: rel, bytes: Buffer.byteLength(content) });
}

function toolListDir(rel: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  if (!fs.existsSync(full)) return JSON.stringify({ error: 'Dossier introuvable' });
  pushComputer(ctx.agentId, 'file', `Liste ${rel}`);
  const entries = fs.readdirSync(full, { withFileTypes: true }).map((d) => ({
    name: d.name,
    type: d.isDirectory() ? 'dir' : 'file',
  }));
  return JSON.stringify(entries, null, 2);
}
