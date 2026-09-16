/** Fastify JSON body: empty DELETE → `{}`; real POST bodies must still parse. */

export function parseJsonBody(body: unknown): unknown {
  let raw = '';
  if (typeof body === 'string') raw = body;
  else if (Buffer.isBuffer(body)) raw = body.toString('utf8');
  else if (body instanceof Uint8Array) raw = Buffer.from(body).toString('utf8');
  else if (body != null && typeof body === 'object' && !Array.isArray(body)) {
    return body;
  }
  if (raw.length === 0) return {};
  return JSON.parse(raw) as unknown;
}
