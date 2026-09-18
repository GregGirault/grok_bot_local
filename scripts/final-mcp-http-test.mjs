import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadMcpConfig, executeMcpTool, getMcpConfigRaw, saveMcpConfig, closeMcpClients } = require('../apps/server/dist/services/mcp.js');

const ROOT = process.cwd();
const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const PORT = Number(process.env.MCP_TEST_PORT || 9797);
const original = getMcpConfigRaw(ROOT);
const remote = {
  name: 'final_http',
  url: `http://127.0.0.1:${PORT}/mcp`,
  disabled: false,
  tools: [
    {
      name: 'echo',
      description: 'Final HTTP MCP echo tool',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

async function putConfig(config) {
  const res = await fetch(`${BASE}/api/mcp/config`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT /api/mcp/config ${res.status}: ${text}`);
  return JSON.parse(text);
}

try {
  const config = { servers: [...original.servers.filter((s) => s.name !== remote.name), remote] };
  const apiReload = await putConfig(config);
  if (!apiReload.servers.includes(remote.name)) throw new Error('server API did not load remote MCP');

  const loaded = loadMcpConfig(ROOT);
  const tool = 'mcp_final_http_echo';
  if (!loaded.toolDefs.some((t) => t.function.name === tool)) throw new Error('remote MCP tool was not registered');
  const result = JSON.parse(await executeMcpTool(tool, JSON.stringify({ message: 'REMOTE_OK' }), loaded));
  const text = JSON.stringify(result);
  if (!result.ok || !result.live || result.transport !== 'http' || !text.includes('HTTP_MCP_ECHO:REMOTE_OK')) {
    throw new Error(`remote MCP call failed: ${text}`);
  }
  console.log('PASS remote-http-mcp-initialize-tools-list-tools-call');
} finally {
  saveMcpConfig(ROOT, original);
  await putConfig(original).catch(() => undefined);
  if (typeof closeMcpClients === 'function') closeMcpClients();
}
