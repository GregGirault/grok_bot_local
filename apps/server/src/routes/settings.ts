import type { FastifyInstance } from 'fastify';
import type { Settings } from '@grok-bot/shared';
import type { SettingsRepo } from '../db/repos';
import { OllamaClient } from '../services/ollama';
import { loadSkills, writeSkill, deleteSkill } from '../services/skills';
import type { LoadedMcp } from '../services/mcp';

export function registerSettingsRoutes(
  app: FastifyInstance,
  settings: SettingsRepo,
  skillsDir: string,
  version: string,
  mcp: LoadedMcp
): void {
  app.get('/api/settings', async () => settings.getAll());

  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req) => {
    return settings.set(req.body ?? {});
  });

  app.get('/api/skills', async () => {
    return loadSkills(skillsDir).map((s) => ({
      name: s.name,
      description: s.description,
      preview: s.content.slice(0, 200),
      frontmatter: s.frontmatter,
    }));
  });

  app.post<{ Body: { name: string; content: string } }>('/api/skills', async (req, reply) => {
    const { name, content } = req.body ?? {};
    if (!name?.trim() || content === undefined) {
      return reply.code(400).send({ error: 'name and content required' });
    }
    const skill = writeSkill(skillsDir, name.trim(), content);
    return reply.code(201).send({
      name: skill.name,
      description: skill.description,
      preview: skill.content.slice(0, 200),
      frontmatter: skill.frontmatter,
    });
  });

  app.delete<{ Params: { name: string } }>('/api/skills/:name', async (req, reply) => {
    if (!deleteSkill(skillsDir, req.params.name)) {
      return reply.code(404).send({ error: 'Skill not found' });
    }
    return { ok: true };
  });

  app.get('/api/mcp', async () => ({
    servers: mcp.serverNames,
    tools: mcp.toolDefs.map((t) => t.function.name),
    configFormat: 'See config/mcp.example.json and docs/PARITY.md',
  }));

  app.get('/api/models', async (_req, reply) => {
    const s = settings.getAll();
    const client = new OllamaClient(s.ollamaBaseUrl);
    const h = await client.health();
    if (!h.reachable) {
      return reply.code(502).send({ error: h.error, models: [] });
    }
    return { models: h.models ?? [] };
  });

  app.get('/health', async () => {
    const s = settings.getAll();
    const client = new OllamaClient(s.ollamaBaseUrl);
    const ollama = await client.health();
    return {
      ok: ollama.reachable,
      ollama: { ...ollama, baseUrl: s.ollamaBaseUrl },
      version,
    };
  });
}
