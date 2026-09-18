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

interface NativeToolCall {
  id?: string;
  type?: 'function';
  function: {
    index?: number;
    name: string;
    description?: string;
    arguments?: unknown;
  };
}

interface NativeMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  thinking?: string;
  tool_name?: string;
  tool_calls?: NativeToolCall[];
}

interface NativeChatResponse {
  model?: string;
  message?: NativeMessage;
  done?: boolean;
  done_reason?: string;
}

function unwrapNativeArg(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapNativeArg);
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  if (obj.type === 'string' && typeof obj.content === 'string' && Object.keys(obj).length <= 2) {
    return obj.content;
  }
  if (obj.type === 'number' && typeof obj.content === 'number' && Object.keys(obj).length <= 2) {
    return obj.content;
  }
  if (obj.type === 'boolean' && typeof obj.content === 'boolean' && Object.keys(obj).length <= 2) {
    return obj.content;
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unwrapNativeArg(v)]));
}

function toNativeToolCalls(toolCalls: ToolCall[] | undefined): NativeToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((call, index) => {
    let args: unknown = {};
    try {
      args = JSON.parse(call.function.arguments || '{}');
    } catch {
      args = {};
    }
    return {
      id: call.id,
      type: 'function',
      function: {
        index,
        name: call.function.name,
        arguments: args,
      },
    };
  });
}

function toNativeMessages(messages: ChatMessageParam[]): NativeMessage[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_name: message.name,
        content: message.content,
      };
    }
    return {
      role: message.role,
      content: message.content,
      ...(message.role === 'assistant' && message.tool_calls?.length
        ? { tool_calls: toNativeToolCalls(message.tool_calls) }
        : {}),
    };
  });
}

function fromNativeToolCalls(toolCalls: NativeToolCall[] | undefined): Array<{
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
}> | undefined {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((call, index) => ({
    index: call.function.index ?? index,
    id: call.id || `call_native_${index}`,
    type: 'function',
    function: {
      name: call.function.name,
      arguments: JSON.stringify(unwrapNativeArg(call.function.arguments ?? {})),
    },
  }));
}

export class OllamaClient {
  constructor(public baseUrl: string) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(15_000),
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
      messages: toNativeMessages(opts.messages),
      stream: true,
      think: false,
      keep_alive: '15m',
    };
    if (opts.tools?.length) body.tools = opts.tools;

    const res = await fetch(`${this.baseUrl}/api/chat`, {
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
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as NativeChatResponse;
          const native = chunk.message;
          yield {
            choices: [
              {
                delta: {
                  ...(native?.content ? { content: native.content } : {}),
                  ...(native?.tool_calls?.length
                    ? { tool_calls: fromNativeToolCalls(native.tool_calls) }
                    : {}),
                },
                finish_reason: chunk.done ? chunk.done_reason || 'stop' : null,
              },
            ],
          };
        } catch {
          // skip malformed chunks
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        const chunk = JSON.parse(tail) as NativeChatResponse;
        const native = chunk.message;
        yield {
          choices: [
            {
              delta: {
                ...(native?.content ? { content: native.content } : {}),
                ...(native?.tool_calls?.length
                  ? { tool_calls: fromNativeToolCalls(native.tool_calls) }
                  : {}),
              },
              finish_reason: chunk.done ? chunk.done_reason || 'stop' : null,
            },
          ],
        };
      } catch {
        // ignore malformed tail
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
      messages: toNativeMessages(opts.messages),
      stream: false,
      think: false,
      keep_alive: '15m',
    };
    if (opts.tools?.length) body.tools = opts.tools;

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama chat failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as NativeChatResponse;
    const msg = data.message;
    const calls = fromNativeToolCalls(msg?.tool_calls)?.map((call, index) => ({
      id: call.id || `call_native_${index}`,
      type: 'function' as const,
      function: {
        name: call.function?.name || '',
        arguments: call.function?.arguments || '{}',
      },
    }));
    return { content: msg?.content ?? '', tool_calls: calls };
  }
}
