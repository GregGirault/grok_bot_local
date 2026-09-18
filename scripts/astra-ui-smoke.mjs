import { chromium } from 'playwright';

const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const expectedBots = [
  'oracle',
  'vulcan-forge',
  'noesis-grid',
  'axon-nexus',
  'aegis-ledger',
  'mneme-vault',
  'helios-probe',
  'daedalus-core',
  'sovereign-mind',
  'argos-watch',
];
const expectedShapes = ['circle', 'blob', 'rounded', 'pill', 'triangle', 'hexagon', 'cloud', 'drop'];
const expectedColors = [
  '#F4EFE6', '#7A4A28', '#FF6A00', '#F5C400', '#C6D63C', '#34C759',
  '#2BB3C0', '#2F80ED', '#9B5DE0', '#FF5CA8', '#8E8E93',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const agentsRes = await fetch(`${BASE}/api/agents`);
assert(agentsRes.ok, `GET /api/agents failed: ${agentsRes.status}`);
const agents = await agentsRes.json();
assert(agents.length === 10, `expected 10 visible Bots, got ${agents.length}`);
assert(expectedBots.every((name) => agents.some((a) => a.name === name)), 'visible ASTRA roster mismatch');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

try {
  await page.goto(`${BASE}/chat/${agents.find((a) => a.name === 'oracle').id}`, { waitUntil: 'networkidle' });
  const oracleLink = page.locator(`a[href="/chat/${agents.find((a) => a.name === 'oracle').id}"]`);
  await oracleLink.waitFor({ state: 'visible', timeout: 15_000 });
  for (const agent of agents) {
    const link = page.locator(`a[href="/chat/${agent.id}"]`);
    assert((await link.count()) === 1, `sidebar link missing for ${agent.name}`);
    assert((await link.locator('svg.gb-avatar').count()) === 1, `SVG Grok avatar missing for ${agent.name}`);
  }
  console.log('PASS astra-sidebar-10-bots-svg-avatars');

  await page.goto(`${BASE}/agents/new`, { waitUntil: 'networkidle' });
  for (const shape of expectedShapes) {
    const button = page.getByRole('button', { name: shape, exact: true });
    assert((await button.count()) === 1, `avatar shape missing: ${shape}`);
    assert((await button.locator('svg.gb-avatar').count()) === 1, `avatar preview missing: ${shape}`);
  }
  for (const color of expectedColors) {
    assert((await page.getByRole('button', { name: color, exact: true }).count()) === 1, `avatar color missing: ${color}`);
  }
  console.log('PASS official-avatar-picker-8-shapes-11-colors');

  await page.goto(`${BASE}/settings/connectors`, { waitUntil: 'networkidle' });
  const pluginRes = await fetch(`${BASE}/api/plugins`);
  const plugins = await pluginRes.json();
  assert(plugins.length === 13, `expected 13 plugins, got ${plugins.length}`);
  for (const plugin of plugins) {
    const title = page.getByText(plugin.name, { exact: true }).first();
    await title.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {
      throw new Error(`plugin card missing in UI: ${plugin.name}`);
    });
  }
  console.log('PASS connectors-ui-13-plugins');

  if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, bots: 10, shapes: 8, colors: 11, plugins: 13 }, null, 2));
} finally {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
