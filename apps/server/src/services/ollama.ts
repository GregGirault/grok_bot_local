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
  id?: string;
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
    finish_reason?: string | null;
  }>;
}

export class OllamaClient {
  constructor(public baseUrl: string) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Ollama tags failed: ${res.status}`);
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
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      stream: true,
    };
    if (opts.tools?.length) body.tools = opts.tools;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama chat failed (${res.status}): ${text.slice(0, 500)}`);
    }
    if (!res.body) throw new Error('No response body from Ollama');

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
          // skip malformed chunks
        }
      }
    }
  }

  /** Non-streaming completion — used by routines */
  async chat(opts: {
    model: string;
    messages: ChatMessageParam[];
    tools?: ToolDef[];
  }): Promise<{ content: string; tool_calls?: ToolCall[] }> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      stream: false,
    };
    if (opts.tools?.length) body.tools = opts.tools;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama chat failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      choices: Array<{
        message: { content?: string; tool_calls?: ToolCall[] };
      }>;
    };
    const msg = data.choices[0]?.message;
    return { content: msg?.content ?? '', tool_calls: msg?.tool_calls };
  }
}
