import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import type { ToolDef } from '../services/ollama';
import type { AgentRepo, InboxRepo, MemoryRepo, MessageRepo } from '../db/repos';
import type { LoadedMcp } from '../services/mcp';
import { executeMcpStub } from '../services/mcp';
import { browserNavigate, browserSnapshot } from '../services/browser';

const execFileAsync = promisify(execFile);

export interface ToolContext {
  workspaceRoot: string;
  agentId: string;
  memory: MemoryRepo;
  agents?: AgentRepo;
  inbox?: InboxRepo;
  messages?: MessageRepo;
  mcp?: LoadedMcp;
  /** Called when ask_user creates a widget */
  onWidget?: (widget: {
    widgetId: string;
    question: string;
    options: string[];
  }) => void;
}

export const BASE_TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description:
        'Run a shell command sandboxed to the workspace. cwd is always the workspace root. Dangerous commands are blocked.',
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
          scope: { type: 'string', description: 'agent | user' },
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
      name: 'screenshot',
      description: 'Screenshot stub — returns a clear not-implemented message (Phase 2).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional save path hint' },
        },
        required: [],
      },
    },
  },
];

/** @deprecated use getToolDefs */
export const TOOL_DEFS = BASE_TOOL_DEFS;

export function getToolDefs(mcp?: LoadedMcp): ToolDef[] {
  return [...BASE_TOOL_DEFS, ...(mcp?.toolDefs ?? [])];
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
    if (name.startsWith('mcp_') && ctx.mcp) {
      return await executeMcpStub(name, argsJson, ctx.mcp);
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
        const scope = (String(args.scope ?? 'agent') as 'agent' | 'user') || 'agent';
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
      case 'screenshot':
        return JSON.stringify({
          ok: false,
          stub: true,
          message: 'screenshot tool is a stub in Phase 1. Use browser_snapshot for text capture.',
          path: args.path ?? null,
        });
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

function toolSendToAgent(target: string, message: string, ctx: ToolContext): string {
  if (!ctx.agents || !ctx.inbox) {
    return JSON.stringify({ error: 'Agent messaging not configured' });
  }
  if (!message.trim()) return JSON.stringify({ error: 'Empty message' });
  const dest =
    ctx.agents.get(target) ||
    ctx.agents.getByName(target) ||
    ctx.agents.list().find((a) => a.name.toLowerCase() === target.toLowerCase());
  if (!dest) return JSON.stringify({ error: `Agent not found: ${target}` });
  if (dest.id === ctx.agentId) {
    return JSON.stringify({ error: 'Cannot send message to self' });
  }
  const msg = ctx.inbox.send(ctx.agentId, dest.id, message.trim());
  // Also drop a system note into the target agent's chat
  ctx.messages?.add({
    agentId: dest.id,
    role: 'system',
    content: `[Message from agent] ${message.trim()}`,
    kind: 'system',
  });
  return JSON.stringify({
    ok: true,
    inboxId: msg.id,
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
      headers: { 'User-Agent': 'GrokBotLocal/0.2' },
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
      headers: { 'User-Agent': 'GrokBotLocal/0.2' },
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
