/**
 * MCP config loader stub.
 * Reads config/mcp.json and registers tool descriptors dynamically.
 * Full MCP stdio/SSE transport is Phase 2 — here we expose listed tools
 * as stubs that report server name + that the connector is not yet live.
 */
import fs from 'fs';
import path from 'path';
import type { ToolDef } from './ollama';

export interface McpServerEntry {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  /** Optional static tool names to advertise before a live session */
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
}

const EMPTY: LoadedMcp = { config: { servers: [] }, toolDefs: [], serverNames: [] };

export function loadMcpConfig(projectRoot: string): LoadedMcp {
  const configPath = path.join(projectRoot, 'config', 'mcp.json');
  if (!fs.existsSync(configPath)) return EMPTY;

  let raw: McpConfig;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as McpConfig;
  } catch (e) {
    console.warn('[mcp] failed to parse config/mcp.json:', e);
    return EMPTY;
  }

  const servers = (raw.servers ?? []).filter((s) => s && s.name && !s.disabled);
  const toolDefs: ToolDef[] = [];
  const serverNames: string[] = [];

  for (const server of servers) {
    serverNames.push(server.name);
    const listed = server.tools?.length
      ? server.tools
      : [
          {
            name: 'ping',
            description: `Stub ping for MCP server "${server.name}" (connector not live yet)`,
          },
        ];

    for (const t of listed) {
      const fullName = `mcp_${server.name}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      toolDefs.push({
        type: 'function',
        function: {
          name: fullName,
          description:
            t.description ||
            `MCP tool ${t.name} from server "${server.name}" (stub — configure live transport in Phase 2)`,
          parameters: (t.parameters as ToolDef['function']['parameters']) || {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      });
    }
  }

  if (serverNames.length) {
    console.log(`[mcp] loaded ${serverNames.length} server(s): ${serverNames.join(', ')}`);
  }

  return { config: { servers }, toolDefs, serverNames };
}

export async function executeMcpStub(
  toolName: string,
  argsJson: string,
  loaded: LoadedMcp
): Promise<string> {
  const def = loaded.toolDefs.find((t) => t.function.name === toolName);
  if (!def) {
    return JSON.stringify({ error: `Unknown MCP tool: ${toolName}` });
  }
  return JSON.stringify({
    ok: false,
    stub: true,
    tool: toolName,
    args: (() => {
      try {
        return JSON.parse(argsJson || '{}');
      } catch {
        return {};
      }
    })(),
    message:
      'MCP connector stub: tool is registered from config/mcp.json but live MCP transport is not enabled yet. See docs/PARITY.md.',
    servers: loaded.serverNames,
  });
}
