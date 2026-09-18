const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const created = { agents: [], channels: [], routines: [], memories: [] };
let originalSettings;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}, expected = 200) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(init.timeout || 30_000),
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (res.status !== expected) {
    throw new Error(`${init.method || 'GET'} ${path}: expected ${expected}, got ${res.status}: ${text.slice(0, 1000)}`);
  }
  return body;
}

async function poll(fn, predicate, timeoutMs, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${label} timed out; last=${JSON.stringify(last)?.slice(0, 1200)}`);
}

async function cleanup() {
  for (const id of [...created.channels].reverse()) {
    await request(`/api/channels/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  for (const id of [...created.routines].reverse()) {
    await request(`/api/routines/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  for (const id of [...created.memories].reverse()) {
    await request(`/api/memory/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  for (const id of [...created.agents].reverse()) {
    await request(`/api/agents/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (originalSettings) {
    await request('/api/settings', { method: 'PUT', body: JSON.stringify(originalSettings) }).catch(() => undefined);
  }
}

const checks = [];
function pass(name, detail = '') {
  checks.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? ` :: ${detail}` : ''}`);
}

try {
  const health = await request('/health');
  assert(health.ok === true && health.ollama?.reachable === true, 'health/Ollama not ready');
  pass('health', `${health.ollama.models?.length || 0} Ollama models`);

  originalSettings = await request('/api/settings');
  await request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      defaultModel: 'granite4:micro',
      localExecutionPolicy: 'ask',
      autoReviewEnabled: true,
      timezone: 'Europe/Paris',
    }),
  });
  pass('settings-update');

  const alpha = await request('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: `smoke_alpha_${stamp}`,
      title: 'Smoke Alpha',
      description: `final-smoke-${stamp}`,
      systemPrompt: 'When participating in a group test, do not call tools. Reply exactly ALPHA_ACK and nothing else.',
    }),
  }, 201);
  created.agents.push(alpha.id);
  const beta = await request('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: `smoke_beta_${stamp}`,
      title: 'Smoke Beta',
      description: `final-smoke-${stamp}`,
      systemPrompt: 'When participating in a group test, do not call tools. Reply exactly BETA_ACK and nothing else.',
    }),
  }, 201);
  created.agents.push(beta.id);
  const ollamaAgent = await request('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: `smoke_ollama_${stamp}`,
      title: 'Smoke Ollama',
      description: `fresh-ollama-${stamp}`,
      systemPrompt: 'Follow the user response-format instruction exactly. Do not call tools unless explicitly asked.',
    }),
  }, 201);
  created.agents.push(ollamaAgent.id);
  pass('agents-create', `${alpha.id.slice(0, 8)}, ${beta.id.slice(0, 8)}, ${ollamaAgent.id.slice(0, 8)}`);

  const pinned = await request(`/api/agents/${alpha.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned: true }),
  });
  assert(pinned.pinned === true, 'agent pin failed');
  pass('agent-pin');

  const mem = await request('/api/memory', {
    method: 'POST',
    body: JSON.stringify({ agentId: alpha.id, key: `smoke_${stamp}`, value: `MEMORY_${stamp}` }),
  }, 201);
  created.memories.push(mem.id);
  const memSearch = await request(`/api/memory?q=${encodeURIComponent(stamp)}&agentId=${alpha.id}`);
  assert(memSearch.some((m) => m.id === mem.id), 'memory search failed');
  const memPinned = await request(`/api/memory/${mem.id}/pin`, {
    method: 'POST',
    body: JSON.stringify({ pinned: true }),
  });
  assert(memPinned.pinned === true, 'memory pin failed');
  pass('memory-crud-search-pin');

  await request('/api/routines', {
    method: 'POST',
    body: JSON.stringify({ agentId: alpha.id, name: `bad-${stamp}`, cron: 'bad cron', prompt: 'x' }),
  }, 400);
  await request('/api/routines', {
    method: 'POST',
    body: JSON.stringify({ agentId: alpha.id, name: `bad-tz-${stamp}`, cron: '0 9 * * *', prompt: 'x', timezone: 'Mars/Olympus' }),
  }, 400);
  const routine = await request('/api/routines', {
    method: 'POST',
    body: JSON.stringify({
      agentId: alpha.id,
      name: `routine-${stamp}`,
      cron: '0 9 * * *',
      prompt: 'Reply exactly ALPHA_ACK and nothing else. Do not use tools.',
      timezone: 'Europe/Paris',
      enabled: false,
      quietIfEmpty: false,
    }),
  }, 201);
  created.routines.push(routine.id);
  assert(routine.timezone === 'Europe/Paris', 'routine timezone not persisted');
  await request(`/api/routines/${routine.id}/run`, { method: 'POST' });
  const runs = await poll(
    () => request(`/api/routines/runs?routineId=${routine.id}`),
    (items) => items.length > 0,
    120_000,
    'routine run'
  );
  assert(runs.length <= 20, 'routine history exceeds cap');
  pass('routine-validation-timezone-run', `${runs[0].status}`);

  await request('/api/channels', {
    method: 'POST',
    body: JSON.stringify({ name: `bad-${stamp}`, memberIds: [alpha.id] }),
  }, 400);
  const channel = await request('/api/channels', {
    method: 'POST',
    body: JSON.stringify({
      name: `smoke-${stamp}`,
      description: `GROUP_SEARCH_${stamp}`,
      memberIds: [alpha.id, beta.id],
    }),
  }, 201);
  created.channels.push(channel.id);
  assert(channel.memberIds.length === 2, 'group member count wrong');
  const pinnedChannel = await request(`/api/channels/${channel.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned: true }),
  });
  assert(pinnedChannel.pinned === true, 'channel pin failed');

  const userMessage = await request(`/api/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Group smoke test. Reply with your assigned acknowledgement token only.' }),
    timeout: 60_000,
  }, 201);
  const groupMessages = await poll(
    () => request(`/api/channels/${channel.id}/messages`),
    (items) => new Set(items.filter((m) => m.fromAgentId).map((m) => m.fromAgentId)).size >= 2,
    180_000,
    'multi-Bot group responses'
  );
  const responders = new Set(groupMessages.filter((m) => m.fromAgentId).map((m) => m.fromAgentId));
  assert(responders.has(alpha.id) && responders.has(beta.id), 'both Bots did not respond');
  pass('group-multi-bot-parallel', `${groupMessages.length} messages`);

  const reply = await request(`/api/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'thread-smoke', fromAgentId: alpha.id, replyToId: userMessage.id }),
  }, 201);
  assert(reply.replyToId === userMessage.id, 'channel reply/thread failed');
  const reacted = await request(`/api/channels/${channel.id}/messages/${userMessage.id}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ emoji: '👍' }),
  });
  assert(reacted.reactions?.['👍'] === 1, 'channel reaction failed');
  pass('channel-thread-reaction');

  const inbox = await request(`/api/agents/${alpha.id}/inbox`, {
    method: 'POST',
    body: JSON.stringify({ toAgentId: beta.id, message: `INBOX_${stamp}` }),
  }, 201);
  const betaInbox = await request(`/api/agents/${beta.id}/inbox`);
  assert(betaInbox.some((m) => m.id === inbox.id), 'agent inbox delivery failed');
  await request(`/api/agents/${beta.id}/inbox/${inbox.id}/read`, { method: 'POST' });
  pass('agent-inbox');

  const search = await request(`/api/search?q=${encodeURIComponent(`GROUP_SEARCH_${stamp}`)}`);
  assert(search.some((r) => r.type === 'channel' && r.id === channel.id), 'global search failed');
  pass('global-search');

  const ollamaToken = `FINAL_SMOKE_${stamp}`;
  const chatRes = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      agentId: ollamaAgent.id,
      message: `Reply exactly ${ollamaToken} and nothing else.`,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const sse = await chatRes.text();
  assert(chatRes.ok, `fresh Ollama chat HTTP ${chatRes.status}`);
  assert(sse.includes('event: done'), 'fresh Ollama chat did not complete');
  assert(sse.includes(ollamaToken), `fresh Ollama token missing: ${sse.slice(-1500)}`);
  const ollamaMessages = await request(`/api/agents/${ollamaAgent.id}/messages`);
  const persisted = [...ollamaMessages].reverse().find(
    (m) => m.role === 'assistant' && m.content.trim() === ollamaToken
  );
  assert(persisted, 'fresh Ollama response was not persisted');
  pass('fresh-ollama-stream-persist', ollamaToken);
  const reactedDirect = await request(`/api/messages/${persisted.id}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ emoji: '👀' }),
  });
  assert(reactedDirect.reactions?.['👀'] === 1, 'direct message reaction failed');
  await request(`/api/messages/${persisted.id}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ emoji: '👀' }),
  });
  pass('direct-message-reaction');

  console.log(JSON.stringify({ ok: true, stamp, checks }, null, 2));
} catch (error) {
  console.error('FINAL_SMOKE_FAILED', error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
