import type { FastifyInstance } from 'fastify';
import type { Settings } from '@grok-bot/shared';
import type { SettingsRepo } from '../db/repos';
import { OllamaClient } from '../services/ollama';
import { loadSkills } from '../services/skills';

export function registerSettingsRoutes(
  app: FastifyInstance,
  settings: SettingsRepo,
  skillsDir: string,
  version: string
): void {
  app.get('/api/settings', async () => settings.getAll());

  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req) => {
    return settings.set(req.body ?? {});
  });

  app.get('/api/skills', async () => {
    return loadSkills(skillsDir).map((s) => ({
      name: s.name,
      preview: s.content.slice(0, 200),
    }));
  });

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
