import http from 'node:http';

const port = Number(process.env.MCP_TEST_PORT || 9797);
const sessionId = 'grok-bot-final-mcp-session';

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/mcp') {
    res.writeHead(404).end('not found');
    return;
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let msg;
  try {
    msg = JSON.parse(raw || '{}');
  } catch {
    res.writeHead(400).end('bad json');
    return;
  }

  const headers = {
    'content-type': 'application/json',
    'mcp-session-id': sessionId,
  };

  if (msg.method === 'notifications/initialized') {
    res.writeHead(202, headers).end();
    return;
  }

  let result;
  if (msg.method === 'initialize') {
    result = {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'final-http-mcp', version: '1.0.0' },
    };
  } else if (msg.method === 'tools/list') {
    result = {
      tools: [
        {
          name: 'echo',
          description: 'Final HTTP MCP echo tool',
          inputSchema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message'],
          },
        },
      ],
    };
  } else if (msg.method === 'tools/call') {
    result = {
      content: [
        {
          type: 'text',
          text: `HTTP_MCP_ECHO:${String(msg.params?.arguments?.message || '')}`,
        },
      ],
    };
  } else {
    res.writeHead(200, headers).end(JSON.stringify({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: `Unknown method ${msg.method}` },
    }));
    return;
  }

  res.writeHead(200, headers).end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`FINAL_MCP_HTTP_READY=http://127.0.0.1:${port}/mcp`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
