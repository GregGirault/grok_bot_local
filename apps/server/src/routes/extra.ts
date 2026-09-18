import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import type { FastifyInstance } from 'fastify';
import type {
  MachineRepo,
  TeamMemberRepo,
  ProjectRepo,
  ApprovalRepo,
  ChannelRepo,
  AgentRepo,
  MessageRepo,
  MemoryRepo,
  UploadRepo,
  SearchRepo,
  SettingsRepo,
} from '../db/repos';
import {
  captureDesktopPreview,
  browserNavigate,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
} from '../services/browser';
import { runShell, type ToolContext } from '../tools';
import { getMcpConfigRaw, saveMcpConfig, loadMcpConfig, type LoadedMcp } from '../services/mcp';

export function registerExtraRoutes(
  app: FastifyInstance,
  deps: {
    machines: MachineRepo;
    members: TeamMemberRepo;
    projects: ProjectRepo;
    approvals: ApprovalRepo;
    channels: ChannelRepo;
    agents: AgentRepo;
    messages: MessageRepo;
    memory: MemoryRepo;
    uploads: UploadRepo;
    search: SearchRepo;
    dataDir: string;
    version: string;
    settings: SettingsRepo;
    projectRoot: string;
    reloadMcp: () => LoadedMcp;
  }
): void {
  const {
    machines,
    members,
    projects,
    approvals,
    channels,
    agents,
    messages,
    memory,
    uploads,
    search,
    dataDir,
    version,
    settings,
    projectRoot,
    reloadMcp,
  } = deps;

  // —— Global search ——
  app.get('/api/search', async (req, reply) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const query = String(q || '').trim();
    if (query.length < 2) return reply.code(400).send({ error: 'Search query must be at least 2 characters' });
    const n = Math.max(1, Math.min(100, Number(limit) || 50));
    return search.search(query, n);
  });

  // —— Local/mobile access ——
  app.get('/api/network', async (req) => {
    const port = Number(process.env.PORT || 8787);
    const addresses: string[] = [];
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
      }
    }
    return {
      bindHost: process.env.HOST || '127.0.0.1',
      port,
      lanEnabled: (process.env.HOST || '127.0.0.1') === '0.0.0.0',
      urls: [...new Set(addresses)].map((address) => `http://${address}:${port}`),
      requestHost: req.headers.host,
    };
  });

  // —— Machines ——
  app.get('/api/machines', async () => machines.list());
  app.post<{ Body: { name: string; host?: string; path?: string } }>(
    '/api/machines',
    async (req, reply) => {
      const { name, host, path: p } = req.body ?? {};
      if (!name?.trim()) return reply.code(400).send({ error: 'name required' });
      return reply.code(201).send(machines.create(name.trim(), host || 'localhost', p || ''));
    }
  );
  app.patch<{
    Params: { id: string };
    Body: Partial<{ name: string; host: string; path: string }>;
  }>('/api/machines/:id', async (req, reply) => {
    const m = machines.update(req.params.id, req.body ?? {});
    if (!m) return reply.code(404).send({ error: 'Not found' });
    return m;
  });
  app.delete<{ Params: { id: string } }>('/api/machines/:id', async (req, reply) => {
    if (!machines.delete(req.params.id)) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });

  // —— Team members ——
  app.get('/api/members', async () => members.list());
  app.post<{ Body: { name: string; email?: string; role?: string } }>(
    '/api/members',
    async (req, reply) => {
      const { name, email, role } = req.body ?? {};
      if (!name?.trim()) return reply.code(400).send({ error: 'name required' });
      return reply.code(201).send(members.create(name.trim(), email, role || 'member'));
    }
  );
  app.delete<{ Params: { id: string } }>('/api/members/:id', async (req, reply) => {
    if (!members.delete(req.params.id)) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/channels/:id/members', async (req, reply) => {
    if (!channels.get(req.params.id)) return reply.code(404).send({ error: 'Channel not found' });
    const agentMembers = channels.get(req.params.id)!.memberIds
      .map((id) => agents.get(id))
      .filter(Boolean);
    const team = members.listForChannel(req.params.id);
    return { agents: agentMembers, team };
  });
  app.post<{ Params: { id: string }; Body: { agentId?: string; memberId?: string } }>(
    '/api/channels/:id/members',
    async (req, reply) => {
      const ch = channels.get(req.params.id);
      if (!ch) return reply.code(404).send({ error: 'Channel not found' });
      if (req.body?.agentId) {
        if (!agents.get(req.body.agentId)) return reply.code(404).send({ error: 'Agent not found' });
        if (!ch.memberIds.includes(req.body.agentId) && ch.memberIds.length >= 6) {
          return reply.code(409).send({ error: 'Group chats support at most 6 Bots' });
        }
        channels.addMember(req.params.id, req.body.agentId);
      }
      if (req.body?.memberId) {
        if (!members.get(req.body.memberId))
          return reply.code(404).send({ error: 'Member not found' });
        members.addToChannel(req.params.id, req.body.memberId);
      }
      return { ok: true };
    }
  );
  app.delete<{ Params: { id: string; mid: string } }>(
    '/api/channels/:id/members/:mid',
    async (req, reply) => {
      channels.removeMember(req.params.id, req.params.mid);
      members.removeFromChannel(req.params.id, req.params.mid);
      return { ok: true };
    }
  );

  // —— Projects ——
  app.get('/api/projects', async () => projects.list());
  app.post<{
    Body: { slug: string; name: string; path?: string; description?: string };
  }>('/api/projects', async (req, reply) => {
    const { slug, name, path: p, description } = req.body ?? {};
    if (!slug?.trim() || !name?.trim()) {
      return reply.code(400).send({ error: 'slug and name required' });
    }
    if (projects.getBySlug(slug.trim())) {
      return reply.code(409).send({ error: 'slug exists' });
    }
    return reply
      .code(201)
      .send(projects.create(slug.trim(), name.trim(), p || '', description || ''));
  });
  app.patch<{
    Params: { id: string };
    Body: Partial<{ slug: string; name: string; path: string; description: string }>;
  }>('/api/projects/:id', async (req, reply) => {
    const p = projects.update(req.params.id, req.body ?? {});
    if (!p) return reply.code(404).send({ error: 'Not found' });
    return p;
  });
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    if (!projects.delete(req.params.id)) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/projects/:id/memory', async (req, reply) => {
    if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'Not found' });
    return memory.list(undefined, req.params.id);
  });

  // —— Approvals ——
  app.get('/api/approvals', async (req) => {
    const agentId = (req.query as { agentId?: string }).agentId;
    return approvals.listPending(agentId);
  });
  app.post<{ Params: { id: string }; Body: { decision: 'approved' | 'denied' } }>(
    '/api/approvals/:id',
    async (req, reply) => {
      const decision = req.body?.decision;
      if (decision !== 'approved' && decision !== 'denied') {
        return reply.code(400).send({ error: 'decision must be approved|denied' });
      }
      const a = approvals.resolve(req.params.id, decision);
      if (!a) return reply.code(404).send({ error: 'Not found' });

      if (decision === 'approved' && a.toolName === 'shell') {
        const agent = agents.get(a.agentId);
        const s = settings.getAll();
        const ctx: ToolContext = {
          workspaceRoot: s.workspaceRoot || path.join(projectRoot, 'workspace'),
          dataDir,
          agentId: a.agentId,
          memory,
        };
        const result = await runShell(a.command, ctx);
        messages.add({
          agentId: a.agentId,
          role: 'system',
          content: `[Approved shell] ${a.command}\n${result.slice(0, 2000)}`,
          kind: 'system',
        });
        return { ok: true, approval: a, result };
      }
      messages.add({
        agentId: a.agentId,
        role: 'system',
        content: `[Denied shell] ${a.command}`,
        kind: 'system',
      });
      return { ok: true, approval: a };
    }
  );

  // —— Desktop preview ——
  app.get('/api/computer/preview', async (_req, reply) => {
    const file = await captureDesktopPreview(dataDir);
    if (!file || !fs.existsSync(file)) {
      return reply.code(404).send({ error: 'No preview' });
    }
    const buf = fs.readFileSync(file);
    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-store')
      .send(buf);
  });
  app.get('/api/computer/preview.json', async () => {
    const file = await captureDesktopPreview(dataDir);
    return {
      ok: Boolean(file),
      url: file ? `/screenshots/${path.basename(file)}?t=${Date.now()}` : null,
      path: file,
    };
  });
  app.post<{
    Body:
      | { action: 'navigate'; url: string }
      | { action: 'click'; selector: string }
      | { action: 'type'; selector: string; text: string; pressEnter?: boolean }
      | { action: 'press'; key: string }
      | { action: 'snapshot' };
  }>('/api/computer/action', async (req, reply) => {
    const body = req.body;
    if (!body?.action) return reply.code(400).send({ error: 'action required' });
    let raw: string;
    switch (body.action) {
      case 'navigate':
        raw = await browserNavigate(body.url);
        break;
      case 'click':
        raw = await browserClick(body.selector);
        break;
      case 'type':
        raw = await browserType(body.selector, body.text, { pressEnter: Boolean(body.pressEnter) });
        break;
      case 'press':
        raw = await browserPress(body.key);
        break;
      case 'snapshot':
        raw = await browserSnapshot();
        break;
      default:
        return reply.code(400).send({ error: 'unsupported action' });
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { ok: true, result: raw };
    }
  });

  // —— Uploads ——
  app.post('/api/uploads/file', async (req, reply) => {
    const agentId = (req.query as { agentId?: string }).agentId;
    if (agentId && !agents.get(agentId)) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    let part;
    try {
      part = await req.file();
    } catch (e) {
      return reply.code(413).send({
        error: e instanceof Error ? e.message : 'Upload failed',
      });
    }
    if (!part) return reply.code(400).send({ error: 'file required' });

    const safe = path.basename(part.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const full = path.join(dataDir, 'uploads', fileName);
    fs.mkdirSync(path.dirname(full), { recursive: true });

    let size = 0;
    part.file.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    try {
      await pipeline(part.file, fs.createWriteStream(full));
    } catch (e) {
      fs.rmSync(full, { force: true });
      return reply.code(413).send({
        error: e instanceof Error ? e.message : 'Upload stream failed',
      });
    }

    const isVideo = part.mimetype?.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(safe);
    const maxBytes = isVideo ? 200 * 1024 * 1024 : 25 * 1024 * 1024;
    if (part.file.truncated || size > maxBytes) {
      fs.rmSync(full, { force: true });
      return reply.code(413).send({
        error: `File exceeds ${isVideo ? '200 MB video' : '25 MB'} limit`,
      });
    }

    const att = uploads.create(part.filename || safe, full, {
      agentId,
      mime: part.mimetype,
      size,
    });
    return reply.code(201).send({ ...att, url: `/uploads/${fileName}` });
  });

  app.post<{
    Body: { agentId?: string; name: string; contentBase64: string; mime?: string };
  }>('/api/uploads', async (req, reply) => {
    const { agentId, name, contentBase64, mime } = req.body ?? {};
    if (!name || !contentBase64) {
      return reply.code(400).send({ error: 'name and contentBase64 required' });
    }
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safe}`;
    const full = path.join(dataDir, 'uploads', fileName);
    const buf = Buffer.from(contentBase64, 'base64');
    fs.writeFileSync(full, buf);
    const att = uploads.create(name, full, {
      agentId,
      mime,
      size: buf.length,
    });
    return reply.code(201).send({
      ...att,
      url: `/uploads/${fileName}`,
    });
  });

  // —— Check updates ——
  app.get('/api/updates/check', async () => {
    const s = settings.getAll();
    const repo = s.githubRepo || 'GregGirault/grok_bot_local';
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GrokBotLocal' },
      });
      if (res.ok) {
        const data = (await res.json()) as { tag_name?: string; html_url?: string; name?: string };
        return {
          ok: true,
          current: version,
          latest: data.tag_name || data.name,
          url: data.html_url,
          source: 'releases',
        };
      }
      // Fallback to commits
      const c = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GrokBotLocal' },
      });
      if (c.ok) {
        const commits = (await c.json()) as Array<{ sha: string; html_url: string; commit?: { message?: string } }>;
        const latest = commits[0];
        return {
          ok: true,
          current: version,
          latest: latest?.sha?.slice(0, 7),
          url: latest?.html_url,
          message: latest?.commit?.message,
          source: 'commits',
        };
      }
      return {
        ok: false,
        current: version,
        error: `GitHub API ${res.status}`,
        graceful: true,
      };
    } catch (e) {
      return {
        ok: false,
        current: version,
        error: e instanceof Error ? e.message : String(e),
        graceful: true,
      };
    }
  });

  // —— MCP config UI ——
  app.get('/api/mcp/config', async () => getMcpConfigRaw(projectRoot));
  app.put<{ Body: { servers: unknown[] } }>('/api/mcp/config', async (req, reply) => {
    const body = req.body;
    if (!body || !Array.isArray(body.servers)) {
      return reply.code(400).send({ error: 'servers array required' });
    }
    saveMcpConfig(projectRoot, { servers: body.servers as never });
    const loaded = reloadMcp();
    return {
      ok: true,
      servers: loaded.serverNames,
      tools: loaded.toolDefs.map((t) => t.function.name),
    };
  });
  app.post<{ Params: { name: string }; Body: { disabled: boolean } }>(
    '/api/mcp/servers/:name/toggle',
    async (req, reply) => {
      const cfg = getMcpConfigRaw(projectRoot);
      const s = cfg.servers.find((x) => x.name === req.params.name);
      if (!s) return reply.code(404).send({ error: 'Server not found' });
      s.disabled = Boolean(req.body?.disabled);
      saveMcpConfig(projectRoot, cfg);
      const loaded = reloadMcp();
      return { ok: true, servers: loaded.serverNames };
    }
  );

  // —— Skills content ——
  app.get<{ Params: { name: string } }>('/api/skills/:name', async (req, reply) => {
    const skillsDir = path.join(projectRoot, 'skills');
    const safe = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(skillsDir, `${safe}.md`);
    if (!fs.existsSync(file)) return reply.code(404).send({ error: 'Not found' });
    return { name: safe, content: fs.readFileSync(file, 'utf-8') };
  });

  // —— Agent hide ——
  app.post<{ Params: { id: string }; Body: { hidden: boolean } }>(
    '/api/agents/:id/hide',
    async (req, reply) => {
      const a = agents.update(req.params.id, { hidden: Boolean(req.body?.hidden) });
      if (!a) return reply.code(404).send({ error: 'Not found' });
      return a;
    }
  );
  app.get('/api/agents-hidden', async () => agents.listHidden());
}
