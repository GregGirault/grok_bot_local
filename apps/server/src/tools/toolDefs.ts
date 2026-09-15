import type { ToolDef } from '../services/llm';
import { pluginAllows } from '../services/plugins';

export const BASE_TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Exécute une commande shell dans le workspace. Les commandes dangereuses demandent une approbation.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lit un fichier texte relatif au workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Écrit un fichier dans le workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Liste un dossier du workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Récupère une URL et renvoie le texte.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Recherche web (DuckDuckGo, puis Gemini si une clé est configurée).',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_memory',
      description: 'Enregistre un fait en mémoire (tier profile|log|note).',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          tier: { type: 'string' },
          scope: { type: 'string' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget_memory',
      description: 'Oublie une mémoire par clé.',
      parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Cherche dans la mémoire.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_to_agent',
      description: 'Envoie un message à un autre bot.',
      parameters: {
        type: 'object',
        properties: { agent: { type: 'string' }, message: { type: 'string' } },
        required: ['agent', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Pose une question à choix dans le chat.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_task',
      description: 'Lance une tâche de fond.',
      parameters: {
        type: 'object',
        properties: { prompt: { type: 'string' }, agent: { type: 'string' } },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_routine',
      description: 'Crée une routine planifiée pour ce bot (cron 5 champs).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, cron: { type: 'string' }, prompt: { type: 'string' } },
        required: ['name', 'cron', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_skill',
      description: 'Enregistre une compétence réutilisable (markdown).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse',
      description: 'Ouvre une URL sur l’ordinateur du bot.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_mail',
      description: 'Liste la boîte mail locale.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_mail',
      description: 'Rédige un brouillon. N’envoie rien.',
      parameters: {
        type: 'object',
        properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_mail',
      description: 'Marque un brouillon comme envoyé (local). Demande toujours une approbation.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'Liste l’agenda local.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Ajoute un événement à l’agenda local.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, at: { type: 'string' }, where: { type: 'string' } },
        required: ['title', 'at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'git status dans le workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_post',
      description: 'Écrit dans un salon Slack local.',
      parameters: {
        type: 'object',
        properties: { channel: { type: 'string' }, text: { type: 'string' } },
        required: ['channel', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_list',
      description: 'Liste les serveurs MCP déclarés dans config/mcp.json.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_call',
      description: 'Appelle un outil d’un serveur MCP (stdio si command est configuré).',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string' },
          tool: { type: 'string' },
          arguments: { type: 'object' },
        },
        required: ['server', 'tool'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_secret',
      description: 'Demande un secret masqué (mot de passe, jeton) sans l’écrire dans le chat.',
      parameters: {
        type: 'object',
        properties: { keyName: { type: 'string' }, prompt: { type: 'string' }, plugin: { type: 'string' } },
        required: ['keyName', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_issues',
      description: 'Liste les tickets Linear locaux.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_issue',
      description: 'Crée un ticket Linear local.',
      parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_contacts',
      description: 'Liste les contacts CRM locaux.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_contact',
      description: 'Ajoute un contact au CRM local.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, account: { type: 'string' }, note: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description: 'Liste les notes /workspace/notes.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_note',
      description: 'Enregistre une note markdown dans /workspace/notes.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'x_post',
      description: 'Publie sur le journal X local (/workspace/x). Demande une approbation.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' }, channel: { type: 'string' } },
        required: ['text'],
      },
    },
  },
];

export function getToolDefs(installed?: string[], disabledTools?: string[]): ToolDef[] {
  if (!installed) return BASE_TOOL_DEFS;
  return BASE_TOOL_DEFS.filter((d) => pluginAllows(installed, d.function.name, disabledTools ?? []));
}
