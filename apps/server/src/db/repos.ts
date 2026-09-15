import type {
  BackgroundTask,
  Machine,
  TeamMember,
  Project,
  ApprovalRequest,
  AttachmentInfo,
} from '@grok-bot/shared';
import type { Db } from './schema';
import { nowIso, uuid } from './schema';

export class TaskRepo {
  constructor(private db: Db) {}

  list(): BackgroundTask[] {
    return (this.db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100`).all() as Record<string, unknown>[]).map(
      (r) => this.row(r)
    );
  }

  create(agentId: string, prompt: string, parentTaskId?: string, postToChat = true): BackgroundTask {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO tasks (id, agent_id, prompt, status, parent_task_id, post_to_chat, created_at) VALUES (?, ?, ?, 'queued', ?, ?, ?)`
      )
      .run(id, agentId, prompt, parentTaskId ?? null, postToChat ? 1 : 0, now);
    return this.get(id)!;
  }

  get(id: string): BackgroundTask | undefined {
    const r = this.db.prepare(`SELECT * FROM tasks WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    return r ? this.row(r) : undefined;
  }

  update(id: string, patch: Partial<BackgroundTask>): void {
    const cur = this.get(id);
    if (!cur) return;
    this.db
      .prepare(`UPDATE tasks SET status=?, result=?, error=?, finished_at=? WHERE id=?`)
      .run(patch.status ?? cur.status, patch.result ?? cur.result ?? null, patch.error ?? cur.error ?? null, patch.finishedAt ?? cur.finishedAt ?? null, id);
  }

  nextQueued(): BackgroundTask | undefined {
    const r = this.db.prepare(`SELECT * FROM tasks WHERE status='queued' ORDER BY created_at ASC LIMIT 1`).get() as
      | Record<string, unknown>
      | undefined;
    return r ? this.row(r) : undefined;
  }

  private row(r: Record<string, unknown>): BackgroundTask {
    return {
      id: String(r.id),
      agentId: String(r.agent_id),
      prompt: String(r.prompt),
      status: r.status as BackgroundTask['status'],
      result: r.result ? String(r.result) : undefined,
      error: r.error ? String(r.error) : undefined,
      parentTaskId: r.parent_task_id ? String(r.parent_task_id) : undefined,
      postToChat: Boolean(r.post_to_chat),
      createdAt: String(r.created_at),
      finishedAt: r.finished_at ? String(r.finished_at) : undefined,
    };
  }
}

export class MachineRepo {
  constructor(private db: Db) {}
  list(): Machine[] {
    return (this.db.prepare(`SELECT * FROM machines ORDER BY created_at`).all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      host: String(r.host),
      path: String(r.path),
      createdAt: String(r.created_at),
    }));
  }
  get(id: string): Machine | undefined {
    return this.list().find((m) => m.id === id);
  }
  create(name: string, host = 'localhost', path = ''): Machine {
    const id = uuid();
    const now = nowIso();
    this.db.prepare(`INSERT INTO machines (id, name, host, path, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, name, host, path, now);
    return { id, name, host, path, createdAt: now };
  }
  update(id: string, patch: Partial<Machine>): Machine | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    this.db
      .prepare(`UPDATE machines SET name=?, host=?, path=? WHERE id=?`)
      .run(patch.name ?? cur.name, patch.host ?? cur.host, patch.path ?? cur.path, id);
    return this.get(id);
  }
  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM machines WHERE id=?`).run(id).changes > 0;
  }
}

export class TeamMemberRepo {
  constructor(private db: Db) {}
  list(): TeamMember[] {
    return (this.db.prepare(`SELECT * FROM team_members ORDER BY created_at`).all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: r.email ? String(r.email) : undefined,
      role: String(r.role),
      createdAt: String(r.created_at),
    }));
  }
  create(name: string, email?: string, role = 'membre'): TeamMember {
    const id = uuid();
    const now = nowIso();
    this.db.prepare(`INSERT INTO team_members (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, name, email ?? null, role, now);
    return { id, name, email, role, createdAt: now };
  }
  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM team_members WHERE id=?`).run(id).changes > 0;
  }
}

export class ProjectRepo {
  constructor(private db: Db) {}
  list(): Project[] {
    return (this.db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
      path: String(r.path),
      description: String(r.description),
      createdAt: String(r.created_at),
    }));
  }
  create(slug: string, name: string, path = '', description = ''): Project {
    const id = uuid();
    const now = nowIso();
    this.db.prepare(`INSERT INTO projects (id, slug, name, path, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, slug, name, path, description, now);
    return { id, slug, name, path, description, createdAt: now };
  }
  update(id: string, patch: Partial<Project>): Project | undefined {
    const cur = this.list().find((p) => p.id === id);
    if (!cur) return undefined;
    this.db
      .prepare(`UPDATE projects SET slug=?, name=?, path=?, description=? WHERE id=?`)
      .run(patch.slug ?? cur.slug, patch.name ?? cur.name, patch.path ?? cur.path, patch.description ?? cur.description, id);
    return this.list().find((p) => p.id === id);
  }
  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM projects WHERE id=?`).run(id).changes > 0;
  }
}

export class ApprovalRepo {
  constructor(private db: Db) {}
  list(agentId?: string): ApprovalRequest[] {
    const rows = (
      agentId
        ? this.db.prepare(`SELECT * FROM approvals WHERE agent_id=? AND status='pending' ORDER BY created_at DESC`).all(agentId)
        : this.db.prepare(`SELECT * FROM approvals WHERE status='pending' ORDER BY created_at DESC`).all()
    ) as Record<string, unknown>[];
    return rows.map((r) => this.row(r));
  }
  create(agentId: string, toolName: string, command: string): ApprovalRequest {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(`INSERT INTO approvals (id, agent_id, tool_name, command, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
      .run(id, agentId, toolName, command, now);
    return { id, agentId, toolName, command, status: 'pending', createdAt: now };
  }
  resolve(id: string, status: 'approved' | 'denied'): ApprovalRequest | undefined {
    this.db.prepare(`UPDATE approvals SET status=?, resolved_at=? WHERE id=?`).run(status, nowIso(), id);
    const r = this.db.prepare(`SELECT * FROM approvals WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    return r ? this.row(r) : undefined;
  }
  private row(r: Record<string, unknown>): ApprovalRequest {
    return {
      id: String(r.id),
      agentId: String(r.agent_id),
      toolName: String(r.tool_name),
      command: String(r.command),
      status: r.status as ApprovalRequest['status'],
      createdAt: String(r.created_at),
      resolvedAt: r.resolved_at ? String(r.resolved_at) : undefined,
    };
  }
}

export class UploadRepo {
  constructor(private db: Db) {}
  add(agentId: string | undefined, name: string, filePath: string, mime?: string, size?: number, url?: string): AttachmentInfo {
    const id = uuid();
    this.db
      .prepare(`INSERT INTO uploads (id, agent_id, name, path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, agentId ?? null, name, filePath, mime ?? null, size ?? null, nowIso());
    return { id, name, path: filePath, mime, size, url };
  }
  get(id: string): AttachmentInfo | undefined {
    const r = this.db.prepare(`SELECT * FROM uploads WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    const filePath = String(r.path);
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return {
      id: String(r.id),
      name: String(r.name),
      path: filePath,
      mime: r.mime ? String(r.mime) : undefined,
      size: r.size ? Number(r.size) : undefined,
      url: `/uploads/${fileName}`,
    };
  }
  list(q?: string): AttachmentInfo[] {
    const rows = this.db.prepare(`SELECT * FROM uploads ORDER BY created_at DESC LIMIT 50`).all() as Record<string, unknown>[];
    return rows
      .map((r) => this.get(String(r.id))!)
      .filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));
  }
}

export class ShareRepo {
  constructor(private db: Db) {}
  create(agentId: string, payload: string): { token: string } {
    const token = uuid().slice(0, 12);
    this.db.prepare(`INSERT INTO shares (id, agent_id, payload, created_at) VALUES (?, ?, ?, ?)`).run(token, agentId, payload, nowIso());
    return { token };
  }
  get(token: string): { token: string; agentId: string; payload: string } | undefined {
    const r = this.db.prepare(`SELECT * FROM shares WHERE id=?`).get(token) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return { token: String(r.id), agentId: String(r.agent_id), payload: String(r.payload) };
  }
}

export class SecretRepo {
  constructor(private db: Db) {}
  put(pluginSlug: string | undefined, keyName: string, value: string): { id: string } {
    const id = uuid();
    this.db
      .prepare(`INSERT INTO secrets (id, plugin_slug, key_name, value, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, pluginSlug ?? null, keyName, value, nowIso());
    return { id };
  }
  list(): Array<{ id: string; pluginSlug?: string; keyName: string; createdAt: string }> {
    return (this.db.prepare(`SELECT id, plugin_slug, key_name, created_at FROM secrets ORDER BY created_at DESC`).all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      pluginSlug: r.plugin_slug ? String(r.plugin_slug) : undefined,
      keyName: String(r.key_name),
      createdAt: String(r.created_at),
    }));
  }
}

export { AgentRepo, MessageRepo } from './reposAgents';
export { MemoryRepo, RoutineRepo } from './reposMemory';
export { SettingsRepo, InboxRepo, ChannelRepo } from './reposSettings';
