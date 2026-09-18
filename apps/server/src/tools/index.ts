import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import type { ToolDef } from '../services/ollama';
import type {
  AgentRepo,
  InboxRepo,
  MemoryRepo,
  MessageRepo,
  MachineRepo,
  ApprovalRepo,
  RoutineRepo,
} from '../db/repos';
import type { LoadedMcp } from '../services/mcp';
import type { Settings } from '@grok-bot/shared';
import { executeMcpTool } from '../services/mcp';
import {
  listMail,
  draftMail,
  sendMail,
  listCalendar,
  createCalendarEvent,
  slackPost,
  listIssues,
  createIssue,
  listContacts,
  addContact,
  listNotes,
  saveNote,
  pluginAllows,
} from '../services/plugins';
import { saveSkill } from '../services/skills';
import {
  browserNavigate,
  browserSnapshot,
  browserScreenshot,
  browserClick,
  browserType,
  browserSelect,
  browserPress,
  browserBack,
} from '../services/browser';

const execFileAsync = promisify(execFile);

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
  mcp?: LoadedMcp;
  settings?: Settings;
  routines?: RoutineRepo;
  skillsDir?: string;
  spawnTask?: (agentId: string, prompt: string, parentId?: string) => { id: string };
  onWidget?: (widget: {
    widgetId: string;
    question: string;
    options: string[];
  }) => void;
  onApproval?: (approval: {
    approvalId: string;
    toolName: string;
    command: string;
  }) => void;
}

export const BASE_TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description:
        'Run a shell command sandboxed to the workspace. cwd is always the workspace root. Dangerous commands require approval or are blocked.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file relative to the workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path within workspace' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file relative to the workspace root. Creates parent dirs.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories relative to the workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative directory path (default ".")' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and return truncated text content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web via DuckDuckGo Instant Answer API. Fails gracefully offline.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_memory',
      description: 'Persist a key/value fact into long-term memory (tier: profile|log|note).',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          tier: { type: 'string', description: 'profile | log | note' },
          scope: { type: 'string', description: 'agent | user | project' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget_memory',
      description: 'Delete a memory entry by key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Search persistent memory by keyword.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_to_agent',
      description: 'Send a message to another agent by name or id (agent-to-agent inbox).',
      parameters: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'Target agent name or id' },
          message: { type: 'string' },
        },
        required: ['agent', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Ask the user a multiple-choice question via a chat widget. Options appear as buttons.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: '2-6 option labels',
          },
        },
        required: ['question', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Navigate the Playwright browser to a URL (requires playwright).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_snapshot',
      description: 'Capture text snapshot of the current browser page (requires playwright).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element in the current browser page. Selector can be CSS, text=Label, or role=button|Name.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' } },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: 'Fill a browser input/textarea and optionally press Enter.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          text: { type: 'string' },
          clear: { type: 'boolean' },
          pressEnter: { type: 'boolean' },
        },
        required: ['selector', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_select',
      description: 'Select an option by value in a browser select element.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' }, value: { type: 'string' } },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_press',
      description: 'Press a keyboard key in the current browser page, e.g. Escape, Enter, Control+L.',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_back',
      description: 'Navigate the current browser page back once.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: 'Capture a screenshot of the current browser page; saves under data/screenshots.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional filename hint' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_to_workspace',
      description:
        'Copy a file from a registered machine path into the workspace (CopyToBox analog).',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Absolute path or machine-relative path' },
          dest: { type: 'string', description: 'Relative path inside workspace' },
          machineId: { type: 'string', description: 'Optional registered machine id' },
        },
        required: ['source', 'dest'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_from_workspace',
      description:
        'Copy a file from the workspace to a registered machine path (CopyFromBox analog).',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Relative path inside workspace' },
          dest: { type: 'string', description: 'Absolute destination or machine-relative path' },
          machineId: { type: 'string', description: 'Optional registered machine id' },
        },
        required: ['source', 'dest'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_task',
      description: 'Enqueue a nested background task for an agent (parallel worker pool).',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          agent: { type: 'string', description: 'Optional agent name/id (default: self)' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_routine',
      description: 'Create a scheduled routine for this Bot using a 5-field cron expression.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cron: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['name', 'cron', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_skill',
      description: 'Save a reusable markdown skill that becomes available to Bots.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_mail',
      description: 'List the local mail workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_mail',
      description: 'Create a local mail draft. This does not send anything externally.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_mail',
      description: 'Mark a local mail draft as sent. Local simulation only.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'List events from the local calendar workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Create an event in the local calendar workspace.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          at: { type: 'string' },
          where: { type: 'string' },
        },
        required: ['title', 'at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show git status and the last commits in the workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_post',
      description: 'Write a message to the local Slack-compatible workspace log.',
      parameters: {
        type: 'object',
        properties: { channel: { type: 'string' }, text: { type: 'string' } },
        required: ['channel', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_list',
      description: 'List configured MCP servers and their advertised tools.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_call',
      description: 'Call a tool on a configured MCP server.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string' },
          tool: { type: 'string' },
          arguments: { type: 'object' },
        },
        required: ['server', 'tool'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_issues',
      description: 'List local Linear-compatible issues.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_issue',
      description: 'Create a local Linear-compatible issue.',
      parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_contacts',
      description: 'List contacts from the local CRM workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_contact',
      description: 'Add a contact to the local CRM workspace.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          account: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description: 'List markdown notes from the local notes workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_note',
      description: 'Save a markdown note in the local notes workspace.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'x_post',
      description: 'Write a post to the local X-compatible workspace journal. Nothing is published externally.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' }, channel: { type: 'string' } },
        required: ['text'],
      },
    },
  },
];

export const TOOL_DEFS = BASE_TOOL_DEFS;

export function getToolDefs(mcp?: LoadedMcp, settings?: Settings): ToolDef[] {
  const installed = settings?.installedPlugins;
  const disabled = settings?.pluginDisabledTools ?? [];
  const local = installed?.length
    ? BASE_TOOL_DEFS.filter((d) => pluginAllows(installed, d.function.name, disabled))
    : BASE_TOOL_DEFS;
  const remote = (mcp?.toolDefs ?? []).filter((d) => !disabled.includes(d.function.name));
  return [...local, ...remote];
}

const BLOCKED_SHELL = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  />\s*\/dev\//,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /curl[^|]*\|\s*(ba)?sh/i,
  /wget[^|]*\|\s*(ba)?sh/i,
];

/** Dangerous but ask-before-run (not hard-blocked) */
const DANGEROUS_ASK = [
  /\brm\s+/i,
  /\bmv\s+.*\s+\//i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bkill\b/i,
  /\btruncate\b/i,
  /\bfind\b.*-delete/i,
  />\s*[^|]/,
  /\bdrop\s+table\b/i,
];

function resolveSafe(workspaceRoot: string, rel: string): string {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, rel || '.');
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`Path escapes workspace: ${rel}`);
  }
  return target;
}

export async function executeTool(
  name: string,
  argsJson: string,
  ctx: ToolContext
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: 'Invalid JSON arguments' });
  }

  try {
    if (name.startsWith('mcp_') && name !== 'mcp_list' && name !== 'mcp_call' && ctx.mcp) {
      return await executeMcpTool(name, argsJson, ctx.mcp);
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
        return await toolWebFetch(String(args.url ?? ''));
      case 'web_search':
        return await toolWebSearch(String(args.query ?? ''));
      case 'write_memory': {
        const tier = (String(args.tier ?? 'note') as 'profile' | 'log' | 'note') || 'note';
        const scope =
          (String(args.scope ?? 'agent') as 'agent' | 'user' | 'project') || 'agent';
        const entry = ctx.memory.write(
          ctx.agentId,
          String(args.key ?? ''),
          String(args.value ?? ''),
          tier,
          scope
        );
        return JSON.stringify({ ok: true, entry });
      }
      case 'forget_memory': {
        const ok = ctx.memory.forget(ctx.agentId, String(args.key ?? ''));
        return JSON.stringify({ ok, key: args.key });
      }
      case 'recall_memory': {
        const hits = ctx.memory.search(String(args.query ?? ''), ctx.agentId);
        return JSON.stringify({ count: hits.length, entries: hits });
      }
      case 'send_to_agent':
        return toolSendToAgent(String(args.agent ?? ''), String(args.message ?? ''), ctx);
      case 'ask_user':
        return toolAskUser(String(args.question ?? ''), args.options, ctx);
      case 'browser_navigate':
        return await browserNavigate(String(args.url ?? ''));
      case 'browser_snapshot':
        return await browserSnapshot();
      case 'browser_click':
        return await browserClick(String(args.selector ?? ''));
      case 'browser_type':
        return await browserType(String(args.selector ?? ''), String(args.text ?? ''), {
          clear: args.clear === undefined ? true : Boolean(args.clear),
          pressEnter: Boolean(args.pressEnter),
        });
      case 'browser_select':
        return await browserSelect(String(args.selector ?? ''), String(args.value ?? ''));
      case 'browser_press':
        return await browserPress(String(args.key ?? ''));
      case 'browser_back':
        return await browserBack();
      case 'screenshot':
        return await browserScreenshot(ctx.dataDir, args.path ? String(args.path) : undefined);
      case 'copy_to_workspace':
        return toolCopyToWorkspace(
          String(args.source ?? ''),
          String(args.dest ?? ''),
          args.machineId ? String(args.machineId) : undefined,
          ctx
        );
      case 'copy_from_workspace':
        return toolCopyFromWorkspace(
          String(args.source ?? ''),
          String(args.dest ?? ''),
          args.machineId ? String(args.machineId) : undefined,
          ctx
        );
      case 'spawn_task':
        return toolSpawnTask(
          String(args.prompt ?? ''),
          args.agent ? String(args.agent) : undefined,
          ctx
        );
      case 'create_routine':
        return toolCreateRoutine(
          String(args.name ?? ''),
          String(args.cron ?? ''),
          String(args.prompt ?? ''),
          ctx
        );
      case 'save_skill':
        return toolSaveSkill(String(args.name ?? ''), String(args.content ?? ''), ctx);
      case 'list_mail':
        return listMail(ctx.workspaceRoot);
      case 'draft_mail':
        return draftMail(
          ctx.workspaceRoot,
          String(args.to ?? ''),
          String(args.subject ?? ''),
          String(args.body ?? ''),
          ctx.agentId
        );
      case 'send_mail':
        return sendMail(ctx.workspaceRoot, String(args.id ?? ''), ctx.agentId);
      case 'list_events':
        return listCalendar(ctx.workspaceRoot);
      case 'create_event':
        return createCalendarEvent(
          ctx.workspaceRoot,
          String(args.title ?? ''),
          String(args.at ?? ''),
          String(args.where ?? '')
        );
      case 'git_status':
        return await runShell('git status -sb && git log -5 --oneline', ctx);
      case 'slack_post':
        return slackPost(ctx.workspaceRoot, String(args.channel ?? 'general'), String(args.text ?? ''));
      case 'mcp_list':
        return JSON.stringify(ctx.mcp?.config ?? { servers: [] });
      case 'mcp_call': {
        if (!ctx.mcp) return JSON.stringify({ error: 'MCP not configured' });
        const server = String(args.server ?? '');
        const tool = String(args.tool ?? '');
        const callArgs = args.arguments ?? {};
        const inner = typeof callArgs === 'string' ? callArgs : JSON.stringify(callArgs);
        const toolName = `mcp_${server}_${tool}`.replace(/[^a-zA-Z0-9_]/g, '_');
        return await executeMcpTool(toolName, inner, ctx.mcp);
      }
      case 'list_issues':
        return listIssues(ctx.workspaceRoot);
      case 'create_issue':
        return createIssue(ctx.workspaceRoot, String(args.title ?? ''));
      case 'list_contacts':
        return listContacts(ctx.workspaceRoot);
      case 'add_contact':
        return addContact(
          ctx.workspaceRoot,
          String(args.name ?? ''),
          String(args.account ?? ''),
          String(args.note ?? '')
        );
      case 'list_notes':
        return listNotes(ctx.workspaceRoot);
      case 'save_note':
        return saveNote(ctx.workspaceRoot, String(args.name ?? ''), String(args.content ?? ''));
      case 'x_post':
        return slackPost(
          path.join(ctx.workspaceRoot, 'x'),
          String(args.channel ?? 'timeline'),
          String(args.text ?? '')
        );
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

function toolCreateRoutine(name: string, cronExpr: string, prompt: string, ctx: ToolContext): string {
  if (!ctx.routines) return JSON.stringify({ error: 'Routines not configured' });
  if (!name.trim() || !cronExpr.trim() || !prompt.trim()) {
    return JSON.stringify({ error: 'name, cron and prompt required' });
  }
  if (ctx.routines.list(ctx.agentId).length >= 50) {
    return JSON.stringify({ error: 'Maximum 50 routines per Bot' });
  }
  const routine = ctx.routines.create({
    agentId: ctx.agentId,
    name: name.trim(),
    cron: cronExpr.trim(),
    prompt: prompt.trim(),
    timezone: ctx.settings?.timezone,
  });
  return JSON.stringify({ ok: true, routine });
}

function toolSaveSkill(name: string, content: string, ctx: ToolContext): string {
  if (!ctx.skillsDir) return JSON.stringify({ error: 'Skills not configured' });
  if (!name.trim() || !content.trim()) return JSON.stringify({ error: 'name and content required' });
  const body = content.includes('---')
    ? content
    : `---\nname: ${name.trim()}\ndescription: ${name.trim()}\n---\n\n${content}`;
  const skill = saveSkill(ctx.skillsDir, name.trim(), body);
  return JSON.stringify({ ok: true, name: skill.name, description: skill.description });
}

function toolSpawnTask(prompt: string, agentRef: string | undefined, ctx: ToolContext): string {
  if (!prompt.trim()) return JSON.stringify({ error: 'Empty prompt' });
  if (!ctx.spawnTask) return JSON.stringify({ error: 'Task runner not configured' });
  let agentId = ctx.agentId;
  if (agentRef && ctx.agents) {
    const dest =
      ctx.agents.get(agentRef) ||
      ctx.agents.getByName(agentRef) ||
      ctx.agents.list(true).find((a) => a.name.toLowerCase() === agentRef.toLowerCase());
    if (!dest) return JSON.stringify({ error: `Agent not found: ${agentRef}` });
    agentId = dest.id;
  }
  const task = ctx.spawnTask(agentId, prompt.trim());
  return JSON.stringify({ ok: true, taskId: task.id, agentId });
}

function toolCopyToWorkspace(
  source: string,
  dest: string,
  machineId: string | undefined,
  ctx: ToolContext
): string {
  let src = source;
  if (machineId && ctx.machines) {
    const m = ctx.machines.get(machineId);
    if (!m) return JSON.stringify({ error: 'Machine not found' });
    src = path.isAbsolute(source) ? source : path.join(m.path || '/', source);
  }
  if (!fs.existsSync(src)) return JSON.stringify({ error: `Source not found: ${src}` });
  const target = resolveSafe(ctx.workspaceRoot, dest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  return JSON.stringify({ ok: true, from: src, to: dest });
}

function toolCopyFromWorkspace(
  source: string,
  dest: string,
  machineId: string | undefined,
  ctx: ToolContext
): string {
  const src = resolveSafe(ctx.workspaceRoot, source);
  if (!fs.existsSync(src)) return JSON.stringify({ error: `Source not found: ${source}` });
  let target = dest;
  if (machineId && ctx.machines) {
    const m = ctx.machines.get(machineId);
    if (!m) return JSON.stringify({ error: 'Machine not found' });
    target = path.isAbsolute(dest) ? dest : path.join(m.path || '/', dest);
  }
  if (!path.isAbsolute(target)) {
    return JSON.stringify({ error: 'Destination must be absolute or use machineId' });
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  return JSON.stringify({ ok: true, from: source, to: target });
}

function toolSendToAgent(target: string, message: string, ctx: ToolContext): string {
  if (!ctx.agents || !ctx.inbox) {
    return JSON.stringify({ error: 'Agent messaging not configured' });
  }
  if (!message.trim()) return JSON.stringify({ error: 'Empty message' });
  const dest =
    ctx.agents.get(target) ||
    ctx.agents.getByName(target) ||
    ctx.agents.list(true).find((a) => a.name.toLowerCase() === target.toLowerCase());
  if (!dest) return JSON.stringify({ error: `Agent not found: ${target}` });
  if (dest.id === ctx.agentId) {
    return JSON.stringify({ error: 'Cannot send message to self' });
  }
  const msg = ctx.inbox.send(ctx.agentId, dest.id, message.trim());
  ctx.messages?.add({
    agentId: dest.id,
    role: 'system',
    content: `[Message from agent] ${message.trim()}`,
    kind: 'system',
  });
  const source = ctx.agents.get(ctx.agentId);
  const task = ctx.spawnTask?.(
    dest.id,
    `[Handoff from @${source?.name || ctx.agentId}] ${message.trim()}\n\nHandle this asynchronously. When useful, use send_to_agent to report the result back to @${source?.name || ctx.agentId}.`
  );
  return JSON.stringify({
    ok: true,
    inboxId: msg.id,
    taskId: task?.id,
    to: { id: dest.id, name: dest.name },
  });
}

function toolAskUser(question: string, optionsRaw: unknown, ctx: ToolContext): string {
  const options = Array.isArray(optionsRaw)
    ? optionsRaw.map((o) => String(o)).filter(Boolean).slice(0, 6)
    : [];
  if (!question.trim() || options.length < 2) {
    return JSON.stringify({ error: 'ask_user requires question and at least 2 options' });
  }
  const widgetId = uuid();
  const meta = {
    type: 'widget' as const,
    widgetId,
    question: question.trim(),
    options,
  };
  ctx.messages?.add({
    agentId: ctx.agentId,
    role: 'assistant',
    content: question.trim(),
    kind: 'widget',
    meta,
  });
  ctx.onWidget?.(meta);
  return JSON.stringify({
    ok: true,
    widgetId,
    message: 'Widget shown to user. Wait for their next message with the selection.',
  });
}

async function toolShell(command: string, ctx: ToolContext): Promise<string> {
  if (!command.trim()) return JSON.stringify({ error: 'Empty command' });
  for (const re of BLOCKED_SHELL) {
    if (re.test(command)) {
      return JSON.stringify({ error: 'Command blocked by sandbox policy' });
    }
  }

  const policy = ctx.settings?.localExecutionPolicy || 'ask';
  if (policy === 'never') {
    return JSON.stringify({
      error: 'Local shell execution is disabled by policy',
      policy,
    });
  }

  const matchesRule = (patterns: string[] | undefined): boolean =>
    (patterns || []).some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(command);
      } catch {
        return command.toLowerCase().includes(pattern.toLowerCase());
      }
    });
  const askRule = matchesRule(ctx.settings?.autoReviewAskPatterns);
  const allowRule = matchesRule(ctx.settings?.autoReviewAllowPatterns);
  const dangerous = DANGEROUS_ASK.some((re) => re.test(command));

  // Ask-first rules win. With local policy "ask", every shell command pauses
  // unless an explicit allow rule matches. Dangerous commands remain gated
  // while Auto Review is enabled even if an allow rule also matches.
  const needsAsk =
    askRule ||
    (ctx.settings?.autoReviewEnabled !== false && dangerous) ||
    (policy === 'ask' && !allowRule);
  if (needsAsk && ctx.approvals) {
    const approval = ctx.approvals.create(ctx.agentId, 'shell', command);
    const widgetId = uuid();
    const meta = {
      type: 'widget' as const,
      widgetId,
      question: `Approve dangerous shell command?\n\n\`\`\`\n${command}\n\`\`\``,
      options: ['Approve', 'Deny'],
    };
    ctx.messages?.add({
      agentId: ctx.agentId,
      role: 'assistant',
      content: meta.question,
      kind: 'approval',
      meta: {
        type: 'approval',
        approvalId: approval.id,
        toolName: 'shell',
        command,
        status: 'pending',
      },
    });
    ctx.messages?.add({
      agentId: ctx.agentId,
      role: 'assistant',
      content: meta.question,
      kind: 'widget',
      meta,
    });
    ctx.onWidget?.(meta);
    ctx.onApproval?.({
      approvalId: approval.id,
      toolName: 'shell',
      command,
    });
    return JSON.stringify({
      ok: false,
      pendingApproval: true,
      approvalId: approval.id,
      message: 'Waiting for user approval before running dangerous command.',
    });
  }

  return runShell(command, ctx);
}

export async function runShell(command: string, ctx: ToolContext): Promise<string> {
  const isWin = process.platform === 'win32';
  try {
    const { stdout, stderr } = await execFileAsync(
      isWin ? 'cmd.exe' : 'bash',
      isWin ? ['/c', command] : ['-c', command],
      {
        cwd: ctx.workspaceRoot,
        timeout: 30_000,
        maxBuffer: 512 * 1024,
        env: { ...process.env, HOME: ctx.workspaceRoot, PATH: process.env.PATH },
      }
    );
    const out = [stdout, stderr].filter(Boolean).join('\n').slice(0, 20_000);
    return out || '(no output)';
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return JSON.stringify({
      error: err.message ?? String(e),
      stdout: err.stdout?.slice(0, 5000),
      stderr: err.stderr?.slice(0, 5000),
    });
  }
}

function toolReadFile(rel: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  if (!fs.existsSync(full)) return JSON.stringify({ error: 'File not found' });
  const stat = fs.statSync(full);
  if (!stat.isFile()) return JSON.stringify({ error: 'Not a file' });
  if (stat.size > 512 * 1024) return JSON.stringify({ error: 'File too large (>512KB)' });
  return fs.readFileSync(full, 'utf-8');
}

function toolWriteFile(rel: string, content: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return JSON.stringify({ ok: true, path: rel, bytes: Buffer.byteLength(content) });
}

function toolListDir(rel: string, ctx: ToolContext): string {
  const full = resolveSafe(ctx.workspaceRoot, rel);
  if (!fs.existsSync(full)) return JSON.stringify({ error: 'Directory not found' });
  const entries = fs.readdirSync(full, { withFileTypes: true }).map((d) => ({
    name: d.name,
    type: d.isDirectory() ? 'dir' : 'file',
  }));
  return JSON.stringify(entries, null, 2);
}

async function toolWebFetch(url: string): Promise<string> {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return JSON.stringify({ error: 'Only http/https allowed' });
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'GrokBotLocal/0.3' },
    });
    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `Status ${res.status}\n${stripped.slice(0, 15_000)}`;
  } catch (e) {
    return JSON.stringify({
      error: 'web_fetch failed (offline or unreachable)',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function toolWebSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'GrokBotLocal/0.3' },
    });
    if (!res.ok) {
      return JSON.stringify({ error: `Search HTTP ${res.status}`, offline: false });
    }
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const related = (data.RelatedTopics ?? [])
      .filter((t) => t.Text)
      .slice(0, 5)
      .map((t) => `- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ''}`);
    return JSON.stringify(
      {
        heading: data.Heading,
        abstract: data.AbstractText,
        url: data.AbstractURL,
        related,
      },
      null,
      2
    );
  } catch (e) {
    return JSON.stringify({
      error: 'web_search unavailable (offline or blocked)',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
