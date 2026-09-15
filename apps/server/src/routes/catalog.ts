import type { FastifyInstance } from 'fastify';
import type { AgentRepo, SettingsRepo } from '../db/repos';
import type { Db } from '../db/schema';
import { applyResolvedModels } from '../db/schema';
import { profileHardware } from '../services/hardware';
import {
  buildModelCatalog,
  importLocalGguf,
  pickModelForTier,
  pullOllamaModel,
} from '../services/models';
import type { AstraModelKey } from '../db/astraRoster';

export function registerCatalogRoutes(
  app: FastifyInstance,
  deps: {
    settings: SettingsRepo;
    agents: AgentRepo;
    db: Db;
    dataDir: string;
  }
): void {
  const { settings, db, dataDir } = deps;

  app.get('/api/hardware', async () => profileHardware(dataDir));

  app.get('/api/models/catalog', async () => {
    const s = settings.getAll();
    const hw = await profileHardware(dataDir);
    return buildModelCatalog(s.ollamaBaseUrl, hw, false);
  });

  app.post<{ Body: { name: string } }>('/api/models/pull', async (req, reply) => {
    const name = req.body?.name?.trim();
    if (!name) return reply.code(400).send({ error: 'name required' });
    const s = settings.getAll();
    const result = await pullOllamaModel(s.ollamaBaseUrl, name);
    if (!result.ok) return reply.code(502).send(result);
    const hw = await profileHardware(dataDir);
    const catalog = await buildModelCatalog(s.ollamaBaseUrl, hw, false);
    applyResolvedModels(db, (_domain, key) =>
      pickModelForTier(key as AstraModelKey, hw.recommendedTier, catalog.installed)
    );
    return { ...result, catalog };
  });

  app.post<{ Body: { path: string; name: string } }>('/api/models/hf-import', async (req, reply) => {
    const gguf = req.body?.path?.trim();
    const name = req.body?.name?.trim();
    if (!gguf || !name) return reply.code(400).send({ error: 'path and name required' });
    const result = await importLocalGguf(gguf, name);
    if (!result.ok) return reply.code(502).send(result);
    return result;
  });
}
