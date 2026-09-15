export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionChunk {
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

export class OllamaClient {
  constructor(public baseUrl: string) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Ollama tags: ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name);
  }

  async health(): Promise<{ reachable: boolean; models?: string[]; error?: string }> {
    try {
      const models = await this.listModels();
      return { reachable: true, models };
    } catch (e) {
      return { reachable: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async *chatStream(opts: {
    model: string;
    messages: ChatMessageParam[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): AsyncGenerator<ChatCompletionChunk> {
    yield* streamOpenAiChat({
      url: `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: opts.model,
        messages: opts.messages,
        stream: true,
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
      },
      signal: opts.signal,
      label: 'Ollama',
    });
  }
}

export class HuggingFaceClient {
  constructor(
    public baseUrl: string,
    public token: string
  ) {}

  get configured(): boolean {
    return Boolean(this.token.trim());
  }

  async health(): Promise<{ reachable: boolean; error?: string }> {
    if (!this.configured) return { reachable: false, error: 'HF_TOKEN absent' };
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { reachable: false, error: `Hugging Face HTTP ${res.status}` };
      return { reachable: true };
    } catch (e) {
      return { reachable: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.configured) return [];
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id)).slice(0, 80);
  }

  async *chatStream(opts: {
    model: string;
    messages: ChatMessageParam[];
    tools?: ToolDef[];
    signal?: AbortSignal;
  }): AsyncGenerator<ChatCompletionChunk> {
    yield* streamOpenAiChat({
      url: `${this.baseUrl.replace(/\/$/, '')}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: {
        model: opts.model,
        messages: opts.messages,
        stream: true,
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
      },
      signal: opts.signal,
      label: 'Hugging Face',
    });
  }
}

async function* streamOpenAiChat(opts: {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  label: string;
}): AsyncGenerator<ChatCompletionChunk> {
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: opts.headers,
    body: JSON.stringify(opts.body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${opts.label} chat (${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.body) throw new Error(`Pas de corps de réponse ${opts.label}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      const payload = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      try {
        yield JSON.parse(payload) as ChatCompletionChunk;
      } catch {
        /* ignore */
      }
    }
  }
}

function lastUser(messages: ChatMessageParam[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

function toolChunk(name: string, args: Record<string, unknown>): ChatCompletionChunk {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: `local_${name}`,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

export class LocalLlm {
  async *chatStream(opts: {
    messages: ChatMessageParam[];
    signal?: AbortSignal;
  }): AsyncGenerator<ChatCompletionChunk> {
    const user = lastUser(opts.messages);
    const lower = user.toLowerCase();
    const afterTool = opts.messages.some((m) => m.role === 'tool');

    if (!afterTool) {
      if (/\b(liste|ls|fichiers|workspace|répertoire|repertoire)\b/.test(lower)) {
        yield toolChunk('list_dir', { path: '.' });
        return;
      }
      if (/\b(lis|ouvre|montre|read)\b.+\.(md|ts|tsx|json|txt)\b/.test(lower) || /\blis le fichier\b/.test(lower)) {
        const m = user.match(/([\w./-]+\.(md|ts|tsx|json|txt))/i);
        yield toolChunk('read_file', { path: m?.[1] ?? 'README.md' });
        return;
      }
      if (/\b(cherche|search|web)\b/.test(lower) && lower.length > 8) {
        yield toolChunk('web_search', { query: user });
        return;
      }
      if (/\b(question|choisis|plutôt|plutot|tu préfères|tu preferes)\b/.test(lower)) {
        yield toolChunk('ask_user', {
          question: 'Comment on avance ?',
          options: ['Oui, continue', 'Montre-moi d’abord un brouillon', 'Stop'],
        });
        return;
      }
    }

    const reply = buildFrenchReply(user, opts.messages);
    for (const piece of chunkText(reply)) {
      if (opts.signal?.aborted) return;
      yield { choices: [{ delta: { content: piece } }] };
      await sleep(18);
    }
  }
}

function buildFrenchReply(user: string, messages: ChatMessageParam[]): string {
  const toolBits = messages.filter((m) => m.role === 'tool').map((m) => m.content).join('\n');
  if (toolBits) {
    const short = toolBits.slice(0, 900);
    return `Voilà ce que je vois :\n\n\`\`\`\n${short}\n\`\`\`\n\nDis-moi la suite — je m’arrête avant tout envoi, paiement ou suppression.`;
  }
  if (!user.trim()) {
    return 'Je t’écoute. Dis-moi le résultat que tu veux, et ce qui reste derrière une approbation.';
  }
  if (/\bstop\b|\barrête|\barrete/.test(user.toLowerCase())) {
    return 'OK, je m’arrête là. Rien d’autre ne part de mon côté.';
  }
  return `Compris.\n\n**Objectif** — ${user.trim().slice(0, 280)}\n\nJe traite ça comme un collègue : je prépare, je montre, je n’agis pas sur ce qui est sensible sans ton feu vert.\n\nOllama n’est pas joignable ici, donc je tourne en mode local (sans grand modèle). Branche Ollama (\`ollama pull qwen2.5:7b\`) pour une vraie boucle d’outils.\n\nTu veux que je :\n1. rédige un brouillon\n2. liste les fichiers du workspace\n3. propose une routine`;
}

function chunkText(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 4) out.push(s.slice(i, i + 4));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
