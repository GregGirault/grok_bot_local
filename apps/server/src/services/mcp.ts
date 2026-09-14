/**
 * MCP config loader + minimal live stdio JSON-RPC transport.
 * Spawns configured command servers and calls tools/list + tools/call.
 */
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { ToolDef } from './ollama';

export interface McpServerEntry {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

export interface McpConfig {
  servers: McpServerEntry[];
}

export interface LoadedMcp {
  config: McpConfig;
  toolDefs: ToolDef[];
  serverNames: string[];
  configPath: string;
}

const EMPTY: LoadedMcp = {
  config: { servers: [] },
  toolDefs: [],
  serverNames: [],
  configPath: '',
};

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class StdioMcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer = '';
  private ready: Promise<void> | null = null;
  liveTools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> =
    [];

  constructor(
    private entry: McpServerEntry,
    private onLog?: (msg: string) => void
  ) {}

  async start(): Promise<void> {
    if (!this.entry.command) throw new Error(`MCP server ${this.entry.name} has no command`);
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      try {
        this.proc = spawn(this.entry.command!, this.entry.args ?? [], {
          env: { ...process.env, ...(this.entry.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString()));
        this.proc.stderr.on('data', (chunk: Buffer) => {
          this.onLog?.(`[mcp:${this.entry.name}] ${chunk.toString().slice(0, 200)}`);
        });
        this.proc.on('error', (err) => reject(err));
        this.proc.on('exit', (code) => {
          for (const [, p] of this.pending) p.reject(new Error(`MCP exited ${code}`));
          this.pending.clear();
          this.proc = null;
          this.ready = null;
        });
        // Initialize then list tools
        void this.request('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'grok-bot-local', version: '0.3.0' },
        })
          .then(async () => {
            this.notify('notifications/initialized', {});
            const listed = (await this.request('tools/list', {})) as {
              tools?: Array<{
                name: string;
                description?: string;
                inputSchema?: Record<string, unknown>;
              }>;
            };
            this.liveTools = listed?.tools ?? [];
            resolve();
          })
          .catch(reject);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    return this.ready;
  }

  private onData(text: string): void {
    this.buffer += text;
    // Content-Length framed or newline JSON
    while (true) {
      if (this.buffer.startsWith('Content-Length:')) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = this.buffer.slice(0, headerEnd);
        const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) {
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }
        const len = Number(lenMatch[1]);
        const bodyStart = headerEnd + 4;
        if (this.buffer.length < bodyStart + len) return;
        const body = this.buffer.slice(bodyStart, bodyStart + len);
        this.buffer = this.buffer.slice(bodyStart + len);
        this.handleMessage(body);
      } else {
        const nl = this.buffer.indexOf('\n');
        if (nl === -1) return;
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (line) this.handleMessage(line);
      }
    }
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as {
        id?: number;
        result?: unknown;
        error?: { message?: string };
      };
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'MCP error'));
        else p.resolve(msg.result);
      }
    } catch {
      // ignore
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin) {
        reject(new Error('MCP process not running'));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      const frame = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
      this.proc.stdin.write(frame);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP timeout: ${method}`));
        }
      }, 15_000);
    });
  }

  private notify(method: string, params: unknown): void {
    if (!this.proc?.stdin) return;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    const frame = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
    this.proc.stdin.write(frame);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.start();
    return this.request('tools/call', { name, arguments: args });
  }

  stop(): void {
    this.proc?.kill();
    this.proc = null;
    this.ready = null;
  }
}

const clients = new Map<string, StdioMcpClient>();

export function loadMcpConfig(projectRoot: string): LoadedMcp {
  const configPath = path.join(projectRoot, 'config', 'mcp.json');
  if (!fs.existsSync(configPath)) return { ...EMPTY, configPath };

  let raw: McpConfig;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as McpConfig;
  } catch (e) {
    console.warn('[mcp] failed to parse config/mcp.json:', e);
    return { ...EMPTY, configPath };
  }

  const allServers = raw.servers ?? [];
  const servers = allServers.filter((s) => s && s.name && !s.disabled);
  const toolDefs: ToolDef[] = [];
  const serverNames: string[] = [];

  for (const server of servers) {
    serverNames.push(server.name);
    const listed = server.tools?.length
      ? server.tools
      : [
          {
            name: 'ping',
            description: `Ping for MCP server "${server.name}"`,
          },
        ];

    for (const t of listed) {
      const fullName = `mcp_${server.name}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      toolDefs.push({
        type: 'function',
        function: {
          name: fullName,
          description:
            t.description || `MCP tool ${t.name} from server "${server.name}"`,
          parameters: (t.parameters as ToolDef['function']['parameters']) || {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      });
    }

    // Eager-start stdio servers when command is set (best-effort)
    if (server.command) {
      void ensureClient(server)
        .then((client) => {
          for (const t of client.liveTools) {
            const fullName = `mcp_${server.name}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
            if (!toolDefs.find((d) => d.function.name === fullName)) {
              toolDefs.push({
                type: 'function',
                function: {
                  name: fullName,
                  description: t.description || `MCP ${t.name}`,
                  parameters: (t.inputSchema as ToolDef['function']['parameters']) || {
                    type: 'object',
                    properties: {},
                    required: [],
                  },
                },
              });
            }
          }
        })
        .catch((e) => console.warn(`[mcp] start ${server.name} failed:`, e));
    }
  }

  if (serverNames.length) {
    console.log(`[mcp] loaded ${serverNames.length} server(s): ${serverNames.join(', ')}`);
  }

  return { config: { servers: allServers }, toolDefs, serverNames, configPath };
}

async function ensureClient(entry: McpServerEntry): Promise<StdioMcpClient> {
  let c = clients.get(entry.name);
  if (!c) {
    c = new StdioMcpClient(entry, (m) => console.log(m));
    clients.set(entry.name, c);
  }
  await c.start();
  return c;
}

export async function executeMcpTool(
  toolName: string,
  argsJson: string,
  loaded: LoadedMcp
): Promise<string> {
  const def = loaded.toolDefs.find((t) => t.function.name === toolName);
  if (!def) {
    return JSON.stringify({ error: `Unknown MCP tool: ${toolName}` });
  }

  // Parse mcp_<server>_<tool>
  const without = toolName.replace(/^mcp_/, '');
  let server: McpServerEntry | undefined;
  let shortTool = without;
  for (const s of loaded.config.servers) {
    const prefix = s.name.replace(/[^a-zA-Z0-9_]/g, '_') + '_';
    if (without.startsWith(prefix)) {
      server = s;
      shortTool = without.slice(prefix.length);
      break;
    }
  }

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    args = {};
  }

  if (server?.command) {
    try {
      const client = await ensureClient(server);
      const result = await client.callTool(shortTool, args);
      return JSON.stringify({ ok: true, live: true, tool: toolName, result });
    } catch (e) {
      return JSON.stringify({
        ok: false,
        live: false,
        tool: toolName,
        error: e instanceof Error ? e.message : String(e),
        message: 'stdio MCP call failed — falling back to stub response',
        args,
      });
    }
  }

  // Built-in echo fallback for demo / url-only servers
  if (shortTool === 'echo' || shortTool === 'ping') {
    return JSON.stringify({
      ok: true,
      live: false,
      localEcho: true,
      tool: toolName,
      echo: args,
      message: `Echo from MCP stub server "${server?.name || 'unknown'}"`,
    });
  }

  return JSON.stringify({
    ok: false,
    stub: true,
    tool: toolName,
    args,
    message:
      'MCP tool registered but no stdio command configured. Set command/args in config/mcp.json.',
    servers: loaded.serverNames,
  });
}

/** @deprecated alias */
export const executeMcpStub = executeMcpTool;

export function saveMcpConfig(projectRoot: string, config: McpConfig): void {
  const configPath = path.join(projectRoot, 'config', 'mcp.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  // Restart clients for changed servers
  for (const c of clients.values()) c.stop();
  clients.clear();
}

export function getMcpConfigRaw(projectRoot: string): McpConfig {
  const configPath = path.join(projectRoot, 'config', 'mcp.json');
  if (!fs.existsSync(configPath)) return { servers: [] };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as McpConfig;
  } catch {
    return { servers: [] };
  }
}
