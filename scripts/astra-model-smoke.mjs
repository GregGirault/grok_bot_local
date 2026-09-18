const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const stamp = Date.now();
const created = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, init = {}, expected = 200) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(init.timeout || 240_000),
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (res.status !== expected) throw new Error(`${init.method || 'GET'} ${path}: ${res.status} ${text}`);
  return body;
}

function doneContent(sse) {
  const blocks = String(sse).split(/\n\n+/);
  for (const block of blocks.reverse()) {
    if (!block.includes('event: done')) continue;
    const line = block.split('\n').find((x) => x.startsWith('data:'));
    if (!line) return '';
    try { return String(JSON.parse(line.slice(5).trim()).content || ''); } catch { return ''; }
  }
  return '';
}

try {
  const agents = await api('/api/agents');
  assert(agents.length === 10, `expected 10 ASTRA bots, got ${agents.length}`);
  assert(agents.every((a) => a.model), 'at least one ASTRA Bot has no model');

  const tagsRes = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(10_000) });
  assert(tagsRes.ok, `Ollama tags HTTP ${tagsRes.status}`);
  const tags = await tagsRes.json();
  const installed = new Set((tags.models || []).map((m) => m.name));
  for (const agent of agents) {
    assert(installed.has(agent.model), `${agent.name} model not installed: ${agent.model}`);
  }
  console.log('PASS astra-model-assignments-installed');

  const unique = [...new Set(agents.map((a) => a.model))];
  const preferredOrder = [
    'qwen2.5-coder:7b',
    'qwen3:8b',
    'qwen2.5:14b',
    'qwen2.5-coder:14b',
    'qwen3:30b',
  ];
  unique.sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));

  for (let index = 0; index < unique.length; index++) {
    const model = unique[index];
    console.log(`TEST model-route-live ${model}`);
    const safe = model.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const marker = `MODEL_OK_${safe}_${stamp}`;
    const agent = await api('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: `model_probe_${index}_${stamp}`,
        title: `Model probe ${model}`,
        description: 'Temporary model routing probe',
        systemPrompt: 'Do not call tools. Follow the requested response format exactly.',
        model,
        modelProvider: 'ollama',
      }),
    }, 201);
    created.push(agent.id);
    assert(agent.model === model, `POST /api/agents did not preserve model ${model}`);

    const started = Date.now();
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        message: `Reply exactly ${marker} and nothing else. Do not use tools.`,
      }),
      signal: AbortSignal.timeout(240_000),
    });
    const sse = await res.text();
    assert(res.ok, `${model} chat HTTP ${res.status}`);
    assert(!sse.includes('event: error'), `${model} emitted SSE error: ${sse.slice(-1200)}`);
    const content = doneContent(sse).trim();
    assert(content.length > 0, `${model} returned empty done content`);
    assert(content.includes(marker), `${model} response missing marker: ${content.slice(0, 500)}`);

    const messages = await api(`/api/agents/${agent.id}/messages`);
    assert(messages.some((m) => m.role === 'assistant' && m.content.includes(marker)), `${model} response not persisted`);
    console.log(`PASS model-route-live ${model} :: ${Date.now() - started}ms`);

    await api(`/api/agents/${agent.id}`, { method: 'DELETE' });
    created.pop();
  }

  console.log(JSON.stringify({ ok: true, uniqueModels: unique, tested: unique.length }, null, 2));
} finally {
  for (const id of created.reverse()) {
    await fetch(`${BASE}/api/agents/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
