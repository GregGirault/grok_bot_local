#!/usr/bin/env node
/**
 * Sonde le PC où Node tourne (Windows, macOS, Linux).
 * Usage depuis la racine du projet :  npm run probe-pc
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function sh(cmd, timeout = 8000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function gb(n) {
  return Math.round((Number(n) / 1024 ** 3) * 10) / 10;
}

async function ollamaTags() {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const cpus = os.cpus();
const platform = os.platform();
const facts = {
  capturedAt: new Date().toISOString(),
  source: 'script',
  hostname: os.hostname(),
  platform,
  arch: os.arch(),
  osLabel: `${os.type()} ${os.release()}`,
  cpuModel: cpus[0] ? cpus[0].model.trim() : '',
  cpuCount: cpus.length,
  totalMemGb: gb(os.totalmem()),
  freeMemGb: gb(os.freemem()),
  homedir: os.homedir(),
  gpu: [],
  diskGb: null,
  diskFreeGb: null,
  ollama: { installed: false, reachable: false, models: [] },
  notes: [],
};

if (platform === 'win32') {
  const caption = sh(
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'
  );
  if (caption) facts.osLabel = caption;
  const gpus = sh(
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_VideoController).Name -join \'|\'"'
  );
  if (gpus) facts.gpu = gpus.split('|').map((s) => s.trim()).filter(Boolean);
  const disk = sh(
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$d=Get-CimInstance Win32_LogicalDisk -Filter \\\"DeviceID='C:'\\\"; Write-Output (($d.Size).ToString() + ' ' + ($d.FreeSpace).ToString())\""
  );
  const parts = disk.split(/\s+/).map(Number);
  if (parts.length >= 2 && parts[0] > 0) {
    facts.diskGb = gb(parts[0]);
    facts.diskFreeGb = gb(parts[1]);
  }
} else if (platform === 'darwin') {
  const prod = sh('sw_vers -productName');
  const ver = sh('sw_vers -productVersion');
  if (prod) facts.osLabel = `${prod} ${ver}`.trim();
  const chip = sh('sysctl -n machdep.cpu.brand_string');
  if (chip) facts.cpuModel = chip;
  const gpu = sh('system_profiler SPDisplaysDataType -json');
  if (gpu) {
    try {
      const data = JSON.parse(gpu);
      const cards = data.SPDisplaysDataType || [];
      facts.gpu = cards.map((c) => c.sppci_model || c._name).filter(Boolean);
    } catch {
      facts.gpu = [sh('system_profiler SPDisplaysDataType | grep Chipset')].filter(Boolean);
    }
  }
} else {
  const pretty = sh('sh -c ". /etc/os-release 2>/dev/null; echo \\"$PRETTY_NAME\\""');
  if (pretty) facts.osLabel = pretty;
  const nvidia = sh('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader');
  if (nvidia) facts.gpu = nvidia.split('\n').map((s) => s.trim()).filter(Boolean);
  else {
    const lspci = sh('lspci -mm');
    facts.gpu = lspci
      .split('\n')
      .filter((l) => /VGA|3D|Display/i.test(l))
      .map((l) => l.replace(/^"[^"]+"\s*/, '').trim())
      .filter(Boolean);
  }
  const df = sh('df -kP / | tail -1');
  const cols = df.split(/\s+/);
  if (cols.length >= 4) {
    facts.diskGb = Math.round((Number(cols[1]) / 1024 ** 2) * 10) / 10;
    facts.diskFreeGb = Math.round((Number(cols[3]) / 1024 ** 2) * 10) / 10;
  }
}

const ollamaBin =
  sh(platform === 'win32' ? 'where ollama' : 'command -v ollama') || sh('where ollama');
facts.ollama.installed = Boolean(ollamaBin);
const tags = await ollamaTags();
if (tags) {
  facts.ollama.reachable = true;
  facts.ollama.installed = true;
  facts.ollama.models = (tags.models || []).map((m) => m.name);
}

const host = facts.hostname.toLowerCase();
if (host === 'cursor' || host.includes('cloud') || facts.osLabel.toLowerCase().includes('cursor')) {
  facts.notes.push(
    'Cette sonde a tourné sur la VM cloud Cursor, pas sur ton PC. Relance npm run probe-pc dans un terminal de TON ordinateur (PowerShell, Terminal, ou invite de commandes), dans le dossier du projet.'
  );
}

const outFile = path.join(repoRoot, 'grok-bot-pc.json');
fs.writeFileSync(outFile, JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts, null, 2));
console.log('');
console.log('Fichier écrit :', outFile);
if (facts.notes.length) {
  console.log('');
  for (const n of facts.notes) console.log('ATTENTION :', n);
}
