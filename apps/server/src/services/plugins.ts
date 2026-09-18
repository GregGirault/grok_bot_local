import fs from 'fs';
import path from 'path';
import type { PluginInfo } from '@grok-bot/shared';
import { pushComputer } from './computer';

export const PLUGIN_CATALOG: Array<Omit<PluginInfo, 'installed' | 'enabled'>> = [
  {
    slug: 'files',
    name: 'Fichiers',
    description: 'Workspace partagé /workspace — lecture, écriture, dossiers.',
    category: 'Ordinateur',
    tools: [
      { name: 'read_file', enabled: true },
      { name: 'write_file', enabled: true },
      { name: 'list_dir', enabled: true },
      { name: 'copy_to_workspace', enabled: true },
      { name: 'copy_from_workspace', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'browser',
    name: 'Navigateur',
    description: 'Ouvre des sites, récupère des pages, cherche sur le web.',
    category: 'Ordinateur',
    tools: [
      { name: 'web_fetch', enabled: true },
      { name: 'web_search', enabled: true },
      { name: 'browser_navigate', enabled: true },
      { name: 'browser_snapshot', enabled: true },
      { name: 'browser_click', enabled: true },
      { name: 'browser_type', enabled: true },
      { name: 'browser_select', enabled: true },
      { name: 'browser_press', enabled: true },
      { name: 'browser_back', enabled: true },
      { name: 'screenshot', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'terminal',
    name: 'Terminal',
    description: 'Shell dans le workspace. Les commandes sensibles demandent une approbation.',
    category: 'Ordinateur',
    tools: [{ name: 'shell', enabled: true }],
    local: true,
    auth: 'none',
  },
  {
    slug: 'mail',
    name: 'Messagerie',
    description: 'Boîte locale (brouillons et envois simulés dans /workspace/mail). Équivalent local de Gmail.',
    category: 'Productivité',
    tools: [
      { name: 'list_mail', enabled: true },
      { name: 'draft_mail', enabled: true },
      { name: 'send_mail', enabled: true },
    ],
    local: true,
    auth: 'secret',
  },
  {
    slug: 'calendar',
    name: 'Calendrier',
    description: 'Agenda local dans /workspace/calendar.json. Équivalent de Google Calendar.',
    category: 'Productivité',
    tools: [
      { name: 'list_events', enabled: true },
      { name: 'create_event', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'github',
    name: 'GitHub',
    description: 'git status / log / diff dans le workspace. Équivalent local du plugin GitHub.',
    category: 'Dév',
    tools: [{ name: 'git_status', enabled: true }],
    local: true,
    auth: 'none',
  },
  {
    slug: 'slack',
    name: 'Slack',
    description: 'Journal de salon local /workspace/slack. Les posts restent sur la machine.',
    category: 'Comms',
    tools: [{ name: 'slack_post', enabled: true }],
    local: true,
    auth: 'secret',
  },
  {
    slug: 'drive',
    name: 'Drive',
    description: 'Fichiers partagés dans /workspace/drive. Équivalent local de Google Drive.',
    category: 'Productivité',
    tools: [
      { name: 'list_dir', enabled: true },
      { name: 'read_file', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'mcp',
    name: 'MCP',
    description: 'Serveurs MCP déclarés dans config/mcp.json (outils distants si un serveur est configuré).',
    category: 'Outils',
    tools: [
      { name: 'mcp_list', enabled: true },
      { name: 'mcp_call', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'linear',
    name: 'Linear',
    description: 'Tickets locaux dans /workspace/linear.json. Équivalent du plugin Linear.',
    category: 'Dév',
    tools: [
      { name: 'list_issues', enabled: true },
      { name: 'create_issue', enabled: true },
    ],
    local: true,
    auth: 'secret',
  },
  {
    slug: 'crm',
    name: 'CRM',
    description: 'Comptes et contacts dans /workspace/crm.json. Équivalent local d’un CRM.',
    category: 'Ventes',
    tools: [
      { name: 'list_contacts', enabled: true },
      { name: 'add_contact', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'notion',
    name: 'Notes',
    description: 'Pages locales dans /workspace/notes. Équivalent Notion / wiki.',
    category: 'Productivité',
    tools: [
      { name: 'list_notes', enabled: true },
      { name: 'save_note', enabled: true },
    ],
    local: true,
    auth: 'none',
  },
  {
    slug: 'x',
    name: 'X',
    description: 'Publications locales dans /workspace/x. Équivalent du plugin X.',
    category: 'Comms',
    tools: [{ name: 'x_post', enabled: true }],
    local: true,
    auth: 'secret',
  },
];

const CORE = ['files', 'browser', 'terminal'];

export function listPlugins(installed: string[], disabledTools: string[] = []): PluginInfo[] {
  const set = new Set([...CORE, ...installed]);
  const off = new Set(disabledTools);
  return PLUGIN_CATALOG.map((p) => ({
    ...p,
    installed: set.has(p.slug),
    enabled: set.has(p.slug),
    tools: p.tools.map((t) => ({ ...t, enabled: !off.has(t.name) })),
  }));
}

export function installPlugin(installed: string[], slug: string): string[] {
  if (!PLUGIN_CATALOG.some((p) => p.slug === slug)) return installed;
  return Array.from(new Set([...installed, slug]));
}

export function uninstallPlugin(installed: string[], slug: string): string[] {
  if (CORE.includes(slug)) return installed;
  return installed.filter((s) => s !== slug);
}

export function pluginAllows(installed: string[], toolName: string, disabledTools: string[] = []): boolean {
  if (disabledTools.includes(toolName)) return false;
  if (toolName.startsWith('mcp_')) {
    if (toolName !== 'mcp_list' && disabledTools.includes('mcp_call')) return false;
    return true;
  }
  const enabled = listPlugins(installed, disabledTools).filter((p) => p.installed);
  if (enabled.some((p) => p.tools.some((t) => t.name === toolName && t.enabled))) return true;
  const always = [
    'write_memory',
    'forget_memory',
    'recall_memory',
    'send_to_agent',
    'ask_user',
    'spawn_task',
    'create_routine',
    'save_skill',
    'ask_user',
  ];
  return always.includes(toolName);
}

export function togglePluginTool(disabled: string[], toolName: string, enabled: boolean): string[] {
  const set = new Set(disabled);
  if (enabled) set.delete(toolName);
  else set.add(toolName);
  return Array.from(set);
}

interface MailItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  status: 'inbox' | 'draft' | 'sent';
  at: string;
}

function mailPath(root: string): string {
  return path.join(root, 'mail', 'box.json');
}

function readMail(root: string): MailItem[] {
  const p = mailPath(root);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const seed: MailItem[] = [
      {
        id: 'm1',
        from: 'sarah@acme.com',
        to: 'gregory@local',
        subject: 'Revue design vendredi',
        body: 'On reste à 11h ou on décale ?',
        status: 'inbox',
        at: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(p, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as MailItem[];
}

function writeMail(root: string, items: MailItem[]): void {
  fs.mkdirSync(path.dirname(mailPath(root)), { recursive: true });
  fs.writeFileSync(mailPath(root), JSON.stringify(items, null, 2));
}

export function listMail(root: string): string {
  return JSON.stringify(readMail(root), null, 2);
}

export function draftMail(root: string, to: string, subject: string, body: string, agentId: string): string {
  const items = readMail(root);
  const item: MailItem = {
    id: `d-${Date.now()}`,
    from: 'gregory@local',
    to,
    subject,
    body,
    status: 'draft',
    at: new Date().toISOString(),
  };
  items.push(item);
  writeMail(root, items);
  pushComputer(agentId, 'file', `Brouillon mail : ${subject}`);
  return JSON.stringify({ ok: true, draft: item, hint: 'Le mail n’est pas envoyé tant que send_mail n’est pas approuvé.' });
}

export function sendMail(root: string, id: string, agentId: string): string {
  const items = readMail(root);
  const item = items.find((m) => m.id === id);
  if (!item) return JSON.stringify({ error: 'Brouillon introuvable' });
  item.status = 'sent';
  writeMail(root, items);
  pushComputer(agentId, 'status', `Mail marqué envoyé (local) : ${item.subject}`);
  return JSON.stringify({ ok: true, sent: item, note: 'Envoi local simulé — rien n’a quitté la machine.' });
}

export function listCalendar(root: string): string {
  const p = path.join(root, 'calendar.json');
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify([{ title: 'All-hands', at: 'Vendredi 10:00', where: 'Salle A' }], null, 2));
  }
  return fs.readFileSync(p, 'utf-8');
}

export function createCalendarEvent(root: string, title: string, at: string, where: string): string {
  const p = path.join(root, 'calendar.json');
  const events = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf-8')) as Array<Record<string, string>>) : [];
  events.push({ title, at, where });
  fs.writeFileSync(p, JSON.stringify(events, null, 2));
  return JSON.stringify({ ok: true, event: { title, at, where } });
}

export function slackPost(root: string, channel: string, text: string): string {
  const p = path.join(root, 'slack', `${channel.replace(/[^\w-]/g, '_')}.log`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, `${new Date().toISOString()} ${text}\n`);
  return JSON.stringify({ ok: true, channel, note: 'Posté dans le journal local Slack.' });
}

interface IssueItem {
  id: string;
  title: string;
  status: string;
  at: string;
}

function linearPath(root: string): string {
  return path.join(root, 'linear.json');
}

function readIssues(root: string): IssueItem[] {
  const p = linearPath(root);
  if (!fs.existsSync(p)) {
    const seed: IssueItem[] = [
      { id: 'LIN-1', title: 'Checkout crash staging', status: 'in_review', at: new Date().toISOString() },
    ];
    fs.writeFileSync(p, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as IssueItem[];
}

export function listIssues(root: string): string {
  return JSON.stringify(readIssues(root), null, 2);
}

export function createIssue(root: string, title: string): string {
  const items = readIssues(root);
  const item: IssueItem = { id: `LIN-${items.length + 1}`, title, status: 'todo', at: new Date().toISOString() };
  items.push(item);
  fs.writeFileSync(linearPath(root), JSON.stringify(items, null, 2));
  return JSON.stringify({ ok: true, issue: item });
}

interface ContactItem {
  id: string;
  name: string;
  account: string;
  note: string;
}

function crmPath(root: string): string {
  return path.join(root, 'crm.json');
}

function readContacts(root: string): ContactItem[] {
  const p = crmPath(root);
  if (!fs.existsSync(p)) {
    const seed: ContactItem[] = [{ id: 'c1', name: 'Sarah Chen', account: 'Acme', note: 'Revue design vendredi' }];
    fs.writeFileSync(p, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as ContactItem[];
}

export function listContacts(root: string): string {
  return JSON.stringify(readContacts(root), null, 2);
}

export function addContact(root: string, name: string, account: string, note: string): string {
  const items = readContacts(root);
  const item: ContactItem = { id: `c-${Date.now()}`, name, account, note };
  items.push(item);
  fs.writeFileSync(crmPath(root), JSON.stringify(items, null, 2));
  return JSON.stringify({ ok: true, contact: item });
}

function notesDir(root: string): string {
  return path.join(root, 'notes');
}

export function listNotes(root: string): string {
  const dir = notesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  return JSON.stringify(fs.readdirSync(dir).filter((n) => n.endsWith('.md')));
}

export function saveNote(root: string, name: string, content: string): string {
  const dir = notesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^\w.-]+/g, '_') || 'note';
  const p = path.join(dir, `${safe}.md`);
  fs.writeFileSync(p, content);
  return JSON.stringify({ ok: true, path: `notes/${safe}.md` });
}
