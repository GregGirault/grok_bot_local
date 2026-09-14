#!/usr/bin/env node
/**
 * Minimal MCP stdio echo server for Grok Bot Local testing.
 * Protocol: Content-Length framed JSON-RPC 2.0
 */
import { createInterface } from 'readline';

let buffer = Buffer.alloc(0);

function send(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const len = Number(m[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + len) break;
    const body = buffer.slice(start, start + len).toString('utf8');
    buffer = buffer.slice(start + len);
    handle(JSON.parse(body));
  }
});

function handle(msg) {
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'echo', version: '1.0.0' },
      },
    });
    return;
  }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echo back arguments',
            inputSchema: {
              type: 'object',
              properties: { message: { type: 'string' } },
              required: ['message'],
            },
          },
        ],
      },
    });
    return;
  }
  if (msg.method === 'tools/call') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(msg.params?.arguments ?? {}) }],
      },
    });
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } });
  }
}
