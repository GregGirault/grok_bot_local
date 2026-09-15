import type { HostFacts } from '@grok-bot/shared';
import { api } from './api';

type GbHost = {
  probe: () => {
    platform?: string;
    arch?: string;
    hostname?: string;
    cpuModel?: string;
    cpuCount?: number;
    totalMemGb?: number;
  };
};

function gpuName(): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return undefined;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' ? renderer : undefined;
  } catch {
    return undefined;
  }
}

function osLabelFromUa(ua: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return navigator.platform || 'inconnu';
}

export function collectClientHost(): HostFacts {
  const electron = (window as unknown as { gbHost?: GbHost }).gbHost;
  const node = electron?.probe();
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    capturedAt: new Date().toISOString(),
    source: node ? 'electron' : 'browser',
    platform: node?.platform || navigator.platform,
    arch: node?.arch,
    osLabel: node ? `${node.platform} ${node.arch}` : osLabelFromUa(ua),
    hostname: node?.hostname,
    cpuModel: node?.cpuModel,
    cpuCount: node?.cpuCount ?? navigator.hardwareConcurrency,
    totalMemGb: node?.totalMemGb,
    deviceMemoryGb: nav.deviceMemory,
    gpu: gpuName(),
    userAgent: ua,
  };
}

export function reportClientHost(): void {
  const facts = collectClientHost();
  const isPhone = /Android|iPhone|iPad/i.test(facts.userAgent || '');
  if (isPhone && !facts.source?.includes('electron')) return;
  void api.reportHost(facts).catch(() => undefined);
}
