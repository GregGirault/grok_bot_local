import { v4 as uuid } from 'uuid';
import { normalizeModelProvider, resolveAgentModel, type Agent, type AttachmentInfo } from '@grok-bot/shared';
import type { MessageRepo, MemoryRepo, SettingsRepo, AgentRepo, InboxRepo, MachineRepo, ApprovalRepo, RoutineRepo } from '../db/repos';
import { OllamaClient, HuggingFaceClient, LocalLlm, type ChatMessageParam, type ToolCall } from './llm';
import { getToolDefs, executeTool, type ToolContext } from '../tools';
import { loadSkills, formatSkillsForPrompt } from './skills';
import { pushComputer } from './computer';
import { foldRuntimeKernel } from './promptKernel';

export type SseWriter = (event: string, data: unknown) => void;

export interface AgentLoopDeps {
  messages: MessageRepo;
  memory: MemoryRepo;
  settings: SettingsRepo;
  skillsDir: string;
  defaultWorkspace: string;
  dataDir: string;
  projectRoot?: string;
  agents?: AgentRepo;
  inbox?: InboxRepo;
  machines?: MachineRepo;
  approvals?: ApprovalRepo;
  spawnTask?: (agentId: string, prompt: string, parentId?: string) => { id: string };
  routines?: RoutineRepo;
}

const MAX_TOOL_ROUNDS = 16;

type LlmMode = 'ollama' | 'huggingface' | 'local';

function isoWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function maybeRemember(memory: MemoryRepo, agentId: string, userMessage: string): void {
  if (userMessage.length < 20) return;
  if (
    !/\b(souviens|rappelle|je m['’]appelle|mon projet|j['’]utilise|je préfère|je prefere|n['’]aime pas|stack|HAOS|freqtrade|habitude)\b/i.test(
      userMessage
    )
  ) {
    return;
  }
  memory.write(agentId, `dit-${new Date().toISOString().slice(0, 16)}`, userMessage.slice(0, 800), 'note', 'agent');
}

export async function runAgentChat(
  agent: Agent,
  userMessage: string,
  model: string | undefined,
  write: SseWriter,
  deps: AgentLoopDeps,
  signal?: AbortSignal,
  opts?: { attachments?: AttachmentInfo[]; skipPersistUser?: boolean; quietChat?: boolean; replyToId?: string }
): Promise<void> {
  const settings = deps.settings.getAll();
  const workspaceRoot = settings.workspaceRoot || deps.defaultWorkspace;
  const ollama = new OllamaClient(settings.ollamaBaseUrl);
  const health = await ollama.health();
  const hfToken = (settings.huggingfaceToken || process.env.HF_TOKEN || '').trim();
  const hfBase = settings.huggingfaceBaseUrl || 'https://router.huggingface.co/v1';
  const hf = hfToken ? new HuggingFaceClient(hfBase, hfToken) : null;
  const local = new LocalLlm();
  const ollamaModel = (model && model.trim()) || resolveAgentModel(agent.model, settings.defaultModel);
  const hfModel = agent.hfModel?.trim() || '';
  const provider = normalizeModelProvider(agent.modelProvider);

  let llmMode: LlmMode = 'local';
  let useModel = ollamaModel;
  switch (provider) {
    case 'huggingface':
      if (hf && hfModel) {
        llmMode = 'huggingface';
        useModel = hfModel;
      } else if (health.reachable) {
        llmMode = 'ollama';
        useModel = ollamaModel;
      }
      break;
    case 'ollama':
      if (health.reachable) {
        llmMode = 'ollama';
        useModel = ollamaModel;
      } else if (hf && hfModel) {
        llmMode = 'huggingface';
        useModel = hfModel;
      }
      break;
    default: {
      const _never: never = provider;
      throw new Error(`Provider inconnu: ${_never}`);
    }
  }

  deps.memory.promoteStale(7);
  deps.agents?.setPresence(agent.id, 'thinking', 'Lit le message');
  write('presence', { presence: 'thinking', action: 'Lit le message' });
  write('typing', { active: true });

  let content = userMessage;
  if (opts?.attachments?.length) {
    content += `\n\n[Pièces jointes]\n${opts.attachments.map((a) => `- ${a.name}: ${a.path}`).join('\n')}`;
  }
  if (!opts?.skipPersistUser) {
    deps.messages.add({ agentId: agent.id, role: 'user', content, attachments: opts?.attachments, replyToId: opts?.replyToId });
    deps.agents?.update(agent.id, { lastPreview: userMessage.slice(0, 140), unread: false, attention: 'none' });
    const weekStart = isoWeekStart();
    const usage = { ...(settings.weeklyUsage ?? { messages: 0, tools: 0, weekStart: '' }) };
    if (usage.weekStart !== weekStart) {
      usage.messages = 0;
      usage.tools = 0;
      usage.weekStart = weekStart;
    }
    usage.messages += 1;
    deps.settings.set({ weeklyUsage: usage });
  }

  const skills = loadSkills(deps.skillsDir);
  const systemPrompt =
    `${foldRuntimeKernel(agent.systemPrompt)}\n\nTu réponds toujours en français.\n` +
    `Moteur : ${llmMode === 'huggingface' ? 'Hugging Face' : llmMode === 'ollama' ? 'Ollama' : 'LocalLlm'} · modèle ${useModel}. Ce n’est pas Grok cloud.\n` +
    `Pour toute info récente, cours, CVE, documentation ou actualité : web_search puis web_fetch. N’invente pas de chiffres.\n` +
    deps.memory.formatForPrompt(agent.id) +
    formatSkillsForPrompt(skills) +
    `\n\nRacine du workspace : ${workspaceRoot}\nDate : ${new Date().toISOString().slice(0, 10)}.`;

  const history = deps.messages.listByAgent(agent.id, 80);
  const llmMessages: ChatMessageParam[] = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    if (m.role === 'tool') {
      llmMessages.push({ role: 'tool', content: m.content, tool_call_id: m.toolCallId, name: m.toolName });
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
    spawnTask: deps.spawnTask,
    onWidget: (widget) => write('widget', widget),
    onApproval: (approval) => write('approval', approval),
    installedPlugins: settings.installedPlugins ?? ['files', 'browser', 'terminal'],
    pluginDisabledTools: settings.pluginDisabledTools ?? [],
    autoReviewRules: settings.autoReviewRules ?? [],
    autoReviewEnforced: settings.autoReviewEnforced !== false,
    allowCloudAgents: settings.allowCloudAgents !== false,
    networkMode: settings.networkMode ?? 'allow-all',
    networkAllowlist: settings.networkAllowlist ?? [],
    actionRecording: Boolean(settings.actionRecording),
    localPolicy: settings.localComputerPolicy ?? 'ask',
    geminiApiKey: settings.geminiApiKey || process.env.GEMINI_API_KEY,
    skillsDir: deps.skillsDir,
    projectRoot: deps.projectRoot,
    routines: deps.routines,
  };

  const toolDefs = getToolDefs(toolCtx.installedPlugins, toolCtx.pluginDisabledTools);
  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    let assistantText = '';
    const toolCallBuilders: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      const stream =
        llmMode === 'local'
          ? local.chatStream({ messages: llmMessages, signal })
          : llmMode === 'huggingface' && hf
            ? hf.chatStream({ model: useModel, messages: llmMessages, tools: toolDefs, signal })
            : ollama.chatStream({ model: useModel, messages: llmMessages, tools: toolDefs, signal });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          assistantText += delta.content;
          if (!opts?.quietChat) write('token', { content: delta.content });
        }
        if (delta.tool_calls) {
          deps.agents?.setPresence(agent.id, 'working', 'Utilise l’ordinateur');
          write('presence', { presence: 'working', action: 'Utilise l’ordinateur' });
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
      if (
        llmMode === 'huggingface' &&
        health.reachable &&
        !assistantText &&
        toolCallBuilders.size === 0
      ) {
        llmMode = 'ollama';
        useModel = ollamaModel;
        rounds -= 1;
        continue;
      }
      write('typing', { active: false });
      deps.agents?.setPresence(agent.id, 'blocked', 'Erreur');
      write('error', { message: e instanceof Error ? e.message : String(e) });
      return;
    }

    const toolCalls: ToolCall[] = [...toolCallBuilders.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({ id: v.id, type: 'function' as const, function: { name: v.name, arguments: v.arguments } }));

    if (toolCalls.length === 0) {
      if (!opts?.quietChat) {
        deps.messages.add({ agentId: agent.id, role: 'assistant', content: assistantText });
        deps.agents?.update(agent.id, { lastPreview: assistantText.slice(0, 140) });
      }
      deps.agents?.setPresence(agent.id, 'done', '');
      write('presence', { presence: 'done', action: '' });
      write('typing', { active: false });
      write('done', { content: assistantText, llmMode });
      maybeRemember(deps.memory, agent.id, userMessage);
      setTimeout(() => deps.agents?.setPresence(agent.id, 'idle', ''), 2500);
      return;
    }

    deps.messages.add({
      agentId: agent.id,
      role: 'assistant',
      content: assistantText || `(appel ${toolCalls.map((t) => t.function.name).join(', ')})`,
    });
    llmMessages.push({ role: 'assistant', content: assistantText || '', tool_calls: toolCalls });

    for (const tc of toolCalls) {
      write('tool_call', { id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
      pushComputer(agent.id, 'status', tc.function.name);
      const result = await executeTool(tc.function.name, tc.function.arguments, toolCtx);
      write('tool_result', { id: tc.id, name: tc.function.name, result: result.slice(0, 8000) });
      write('computer', { kind: 'status', detail: tc.function.name });
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
      llmMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.function.name });
    }
  }

  write('typing', { active: false });
  deps.agents?.setPresence(agent.id, 'idle', '');
  write('done', { content: '(nombre max d’outils atteint)' });
}

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
