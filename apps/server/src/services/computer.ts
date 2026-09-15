import type { ComputerEvent, ComputerState } from '@grok-bot/shared';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

const MAX_EVENTS = 24;
const events: ComputerEvent[] = [];
const screenUrls = new Map<string, string>();
let takeover = false;
let activeAgentId: string | undefined;
let url: string | undefined;
let image = 'local-1';
let reachable = true;
let setupPhase: ComputerState['setupPhase'] = 'ready';

function wallpaper(): ComputerState['wallpaper'] {
  const h = new Date().getHours();
  if (h < 7) return 'night';
  if (h < 11) return 'dawn';
  if (h < 18) return 'day';
  if (h < 21) return 'dusk';
  return 'night';
}

export function pushComputer(agentId: string, kind: ComputerEvent['kind'], detail: string): ComputerEvent {
  const ev: ComputerEvent = { id: uuid(), agentId, kind, detail, at: new Date().toISOString() };
  events.unshift(ev);
  if (events.length > MAX_EVENTS) events.pop();
  activeAgentId = agentId;
  if (kind === 'navigate') {
    url = detail;
    screenUrls.set(agentId, detail);
  }
  reachable = true;
  return ev;
}

export function setTakeover(on: boolean): void {
  takeover = on;
}

export function getComputer(agentId?: string): ComputerState {
  const filtered = agentId ? events.filter((e) => e.agentId === agentId) : events;
  const latest = filtered[0];
  return {
    active: Boolean(latest) && Date.now() - new Date(latest.at).getTime() < 90_000,
    agentId: latest?.agentId ?? activeAgentId,
    wallpaper: wallpaper(),
    url: (agentId ? screenUrls.get(agentId) : undefined) ?? url,
    events: filtered.slice(0, 16),
    takeover,
    image,
    reachable,
    setupPhase,
  };
}

export function snapshotWorkspace(workspaceRoot: string, dataDir: string): { ok: boolean; path: string } {
  setupPhase = 'updating';
  const dest = path.join(dataDir, 'snapshots', 'durable');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(workspaceRoot, dest, { recursive: true });
  image = `local-${Date.now().toString(36)}`;
  setupPhase = 'ready';
  return { ok: true, path: dest };
}

export function resetWorkspace(workspaceRoot: string, dataDir: string): { ok: boolean } {
  const dest = path.join(dataDir, 'snapshots', 'durable');
  if (!fs.existsSync(dest)) return { ok: false };
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  fs.cpSync(dest, workspaceRoot, { recursive: true });
  events.length = 0;
  screenUrls.clear();
  url = undefined;
  reachable = true;
  setupPhase = 'ready';
  return { ok: true };
}

export function recoverComputer(): void {
  events.length = 0;
  screenUrls.clear();
  takeover = false;
  url = undefined;
  reachable = true;
  setupPhase = 'ready';
}

export function setSetupPhase(phase: ComputerState['setupPhase']): void {
  setupPhase = phase ?? 'ready';
}

export function setComputerReachable(on: boolean): void {
  reachable = on;
}

export function listWorkspaceFiles(workspaceRoot: string, rel = '.'): Array<{ name: string; type: 'dir' | 'file' }> {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, rel || '.');
  if (!target.startsWith(root + path.sep) && target !== root) return [];
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    reachable = false;
    return [];
  }
  reachable = true;
  return fs.readdirSync(target, { withFileTypes: true }).slice(0, 80).map((d) => ({
    name: d.name,
    type: d.isDirectory() ? 'dir' : 'file',
  }));
}
