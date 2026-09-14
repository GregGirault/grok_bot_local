import { v4 as uuid } from 'uuid';
import type { Agent } from '@grok-bot/shared';
import type {
  MessageRepo,
  MemoryRepo,
  SettingsRepo,
  AgentRepo,
  InboxRepo,
  MachineRepo,
  ApprovalRepo,
} from '../db/repos';
import { OllamaClient, type ChatMessageParam, type ToolCall } from './ollama';
import { getToolDefs, executeTool, type ToolContext } from '../tools';
import { loadSkills, formatSkillsForPrompt } from './skills';
import type { LoadedMcp } from './mcp';
import type { AttachmentInfo } from '@grok-bot/shared';

export type SseWriter = (event: string, data: unknown) => void;

export interface AgentLoopDeps {
  messages: MessageRepo;
  memory: MemoryRepo;
  settings: SettingsRepo;
  skillsDir: string;
  defaultWorkspace: string;
  dataDir: string;
  agents?: AgentRepo;
  inbox?: InboxRepo;
  machines?: MachineRepo;
  approvals?: ApprovalRepo;
  mcp?: LoadedMcp;
  spawnTask?: (agentId: string, prompt: string, parentId?: string) => { id: string };
}

const MAX_TOOL_ROUNDS = 8;

export async function runAgentChat(
  agent: Agent,
  userMessage: string,
  model: string | undefined,
  write: SseWriter,
  deps: AgentLoopDeps,
  signal?: AbortSignal,
  opts?: {
    attachments?: AttachmentInfo[];
    skipPersistUser?: boolean;
    quietChat?: boolean;
  }
): Promise<void> {
  const settings = deps.settings.getAll();
  const workspaceRoot = settings.workspaceRoot || deps.defaultWorkspace;
  const ollama = new OllamaClient(settings.ollamaBaseUrl);
  const useModel = model || settings.defaultModel;

  // Auto tier promotion
  deps.memory.promoteStale(7);

  write('typing', { active: true });

  let content = userMessage;
  if (opts?.attachments?.length) {
    const paths = opts.attachments.map((a) => `- ${a.name}: ${a.path}`).join('\n');
    content += `\n\n[Attachments]\n${paths}`;
  }

  if (!opts?.skipPersistUser) {
    deps.messages.add({
      agentId: agent.id,
      role: 'user',
      content,
      attachments: opts?.attachments,
    });
  }

  const skills = loadSkills(deps.skillsDir);
  const memoryBlock = deps.memory.formatForPrompt(agent.id);
  const skillsBlock = formatSkillsForPrompt(skills);

  const systemPrompt =
    agent.systemPrompt +
    memoryBlock +
    skillsBlock +
    `\n\nWorkspace root: ${workspaceRoot}\nUse tools when helpful. Current date: ${new Date().toISOString().slice(0, 10)}.`;

  const history = deps.messages.listByAgent(agent.id, 40);
  const llmMessages: ChatMessageParam[] = [{ role: 'system', content: systemPrompt }];

  for (const m of history) {
    if (m.role === 'tool') {
      llmMessages.push({
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId,
        name: m.toolName,
      });
    } else if (m.role === 'user' || m.role === 'assistant') {
      if (m.kind === 'widget' || m.kind === 'approval') continue;
      llmMessages.push({ role: m.role, content: m.content });
    }
  }

  const toolCtx: ToolContext = {
    workspaceRoot,
    dataDir: deps.dataDir,
    agentId: agent.id,
    memory: deps.memory,
    agents: deps.agents,
    inbox: deps.inbox,
    messages: deps.messages,
    machines: deps.machines,
    approvals: deps.approvals,
    mcp: deps.mcp,
    spawnTask: deps.spawnTask,
    onWidget: (widget) => {
      write('widget', widget);
    },
    onApproval: (approval) => {
      write('approval', approval);
    },
  };

  const toolDefs = getToolDefs(deps.mcp);
  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    let assistantText = '';
    const toolCallBuilders: Map<number, { id: string; name: string; arguments: string }> =
      new Map();

    try {
      for await (const chunk of ollama.chatStream({
        model: useModel,
        messages: llmMessages,
        tools: toolDefs,
        signal,
      })) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          if (!opts?.quietChat) write('token', { content: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallBuilders.get(tc.index) ?? {
              id: tc.id || `call_${uuid().slice(0, 8)}`,
              name: '',
              arguments: '',
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            toolCallBuilders.set(tc.index, existing);
          }
        }
      }
    } catch (e) {
      write('typing', { active: false });
      write('error', {
        message: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    const toolCalls: ToolCall[] = [...toolCallBuilders.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        id: v.id,
        type: 'function' as const,
        function: { name: v.name, arguments: v.arguments },
      }));

    if (toolCalls.length === 0) {
      if (!opts?.quietChat) {
        deps.messages.add({
          agentId: agent.id,
          role: 'assistant',
          content: assistantText,
        });
      }
      write('typing', { active: false });
      write('done', { content: assistantText });
      return;
    }

    const assistantRecord =
      assistantText || `(calling ${toolCalls.map((t) => t.function.name).join(', ')})`;
    deps.messages.add({
      agentId: agent.id,
      role: 'assistant',
      content: assistantRecord,
    });

    llmMessages.push({
      role: 'assistant',
      content: assistantText || '',
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      write('tool_call', {
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      });

      const result = await executeTool(tc.function.name, tc.function.arguments, toolCtx);

      write('tool_result', {
        id: tc.id,
        name: tc.function.name,
        result: result.slice(0, 8000),
      });

      deps.messages.add({
        agentId: agent.id,
        role: 'tool',
        content: result,
        kind: 'tool_card',
        toolName: tc.function.name,
        toolCallId: tc.id,
        meta: {
          type: 'tool_card',
          toolName: tc.function.name,
          arguments: tc.function.arguments,
          result: result.slice(0, 8000),
          callId: tc.id,
        },
      });

      if (
        tc.function.name === 'write_memory' ||
        tc.function.name === 'forget_memory' ||
        tc.function.name === 'recall_memory'
      ) {
        write('memory', { entries: deps.memory.list(agent.id) });
      }

      llmMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: tc.id,
        name: tc.function.name,
      });
    }
  }

  write('typing', { active: false });
  write('done', { content: '(max tool rounds reached)' });
}

/** Non-streaming wake for routines / background tasks */
export async function wakeAgent(
  agent: Agent,
  prompt: string,
  deps: AgentLoopDeps,
  opts?: { skipPersistUser?: boolean; quietChat?: boolean }
): Promise<string> {
  let final = '';
  await runAgentChat(
    agent,
    prompt,
    undefined,
    (event, data) => {
      if (event === 'token' && data && typeof data === 'object' && 'content' in data) {
        final += String((data as { content: string }).content);
      }
      if (event === 'done' && data && typeof data === 'object' && 'content' in data) {
        const c = String((data as { content: string }).content);
        if (c) final = c;
      }
    },
    deps,
    undefined,
    opts
  );
  return final;
}
