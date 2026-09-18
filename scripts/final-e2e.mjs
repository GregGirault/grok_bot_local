import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const stamp = `e2e_${Date.now()}`;
const created = { agents: [], channels: [] };

async function api(route, init = {}, expected = 200) {
  const res = await fetch(`${BASE}${route}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (res.status !== expected) throw new Error(`${init.method || 'GET'} ${route}: ${res.status} ${text}`);
  return body;
}

async function assertNoHorizontalOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  if (Math.max(dims.doc, dims.body) > dims.innerWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(dims)}`);
  }
}

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
    throw new Error(`${label} was not visible`);
  });
}

async function runDesktop(browser, agent, channel) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(`${BASE}/chat/${agent.id}`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByText('Grok Bot Local', { exact: true }).first(), 'desktop brand');
  await expectVisible(page.locator('textarea[placeholder^="Message"]'), 'desktop chat composer');
  await assertNoHorizontalOverflow(page, 'desktop chat');

  const draft = `DESKTOP_DRAFT_${stamp}`;
  const textarea = page.locator('textarea[placeholder^="Message"]');
  await textarea.fill(draft);
  await page.reload({ waitUntil: 'networkidle' });
  if ((await textarea.inputValue()) !== draft) throw new Error('desktop chat draft did not persist');
  console.log('PASS desktop-chat-draft-responsive');

  await page.keyboard.press('Control+K');
  await expectVisible(page.locator('input[placeholder="Search prior work…"]'), 'desktop global search');
  await page.locator('input[placeholder="Search prior work…"]').fill('Desktop E2E');
  await expectVisible(page.getByText('Desktop E2E Bot', { exact: true }), 'desktop search result');
  console.log('PASS desktop-global-search-shortcut');

  await page.goto(`${BASE}/channels/${channel.id}`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByText(`#${channel.name}`, { exact: true }).first(), 'desktop group title');
  await expectVisible(page.locator('input[placeholder^="Message group"]'), 'desktop group composer');
  await assertNoHorizontalOverflow(page, 'desktop channel');
  console.log('PASS desktop-group-surface');

  await page.keyboard.press('Control+,');
  await page.waitForURL('**/settings/general');
  await page.getByText('Connection', { exact: true }).click();
  await page.waitForURL('**/settings/connection');
  await expectVisible(page.locator('label').filter({ hasText: 'Local shell execution' }).first(), 'desktop execution policy');
  await expectVisible(page.getByText('Mobile access', { exact: true }), 'desktop mobile access panel');
  await assertNoHorizontalOverflow(page, 'desktop settings');
  console.log('PASS desktop-settings-security');

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const reg = await navigator.serviceWorker.ready;
    return { supported: true, active: Boolean(reg.active), scope: reg.scope };
  });
  if (!sw.supported || !sw.active) throw new Error(`PWA service worker not active: ${JSON.stringify(sw)}`);
  await page.reload({ waitUntil: 'networkidle' });
  const pwaState = await page.evaluate(async () => ({
    controller: Boolean(navigator.serviceWorker.controller),
    caches: await caches.keys(),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
  }));
  if (!pwaState.controller) throw new Error(`PWA page is not controlled: ${JSON.stringify(pwaState)}`);
  if (!pwaState.caches.includes('grok-bot-local-v1')) throw new Error(`PWA cache missing: ${JSON.stringify(pwaState)}`);
  if (pwaState.manifest !== '/manifest.webmanifest') throw new Error(`manifest link missing: ${JSON.stringify(pwaState)}`);

  const manifest = await page.request.get(`${BASE}/manifest.webmanifest`);
  if (!manifest.ok()) throw new Error(`manifest HTTP ${manifest.status()}`);
  const manifestJson = await manifest.json();
  if (manifestJson.display !== 'standalone' || manifestJson.name !== 'Grok Bot Local') {
    throw new Error(`manifest content invalid: ${JSON.stringify(manifestJson)}`);
  }
  console.log('PASS pwa-manifest-service-worker-control-cache');

  await context.setOffline(true);
  await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByText('Grok Bot Local', { exact: true }).first(), 'offline PWA brand');
  await expectVisible(page.locator('input[placeholder="Search prior work…"]'), 'offline PWA search shell');
  console.log('PASS pwa-offline-shell');
  await context.setOffline(false);

  const screenshotDir = path.join(process.cwd(), 'data', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'final-desktop-e2e.png'), fullPage: false });

  if (pageErrors.length) throw new Error(`desktop page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function runMobile(browser, agent, channel) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(`${BASE}/chat/${agent.id}`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('button', { name: 'Open navigation' }), 'mobile navigation button');
  await expectVisible(page.locator('textarea[placeholder^="Message"]'), 'mobile composer');
  await assertNoHorizontalOverflow(page, 'mobile chat');

  const draft = `MOBILE_DRAFT_${stamp}`;
  const textarea = page.locator('textarea[placeholder^="Message"]');
  await textarea.fill(draft);
  await page.reload({ waitUntil: 'networkidle' });
  if ((await textarea.inputValue()) !== draft) throw new Error('mobile chat draft did not persist');
  console.log('PASS mobile-390x844-chat-draft');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expectVisible(page.getByRole('link', { name: /Search/ }), 'mobile drawer search link');
  await page.getByRole('link', { name: /Search/ }).click();
  await expectVisible(page.locator('input[placeholder="Search prior work…"]'), 'mobile search page');
  await assertNoHorizontalOverflow(page, 'mobile search');
  console.log('PASS mobile-drawer-navigation');

  await page.goto(`${BASE}/channels/${channel.id}`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByText(`#${channel.name}`, { exact: true }).first(), 'mobile group title');
  await expectVisible(page.locator('input[placeholder^="Message group"]'), 'mobile group composer');
  await assertNoHorizontalOverflow(page, 'mobile channels');
  console.log('PASS mobile-group-responsive');

  await page.goto(`${BASE}/settings/connection`, { waitUntil: 'networkidle' });
  await expectVisible(page.locator('label').filter({ hasText: 'Local shell execution' }).first(), 'mobile execution policy');
  await expectVisible(page.getByText('Mobile access', { exact: true }), 'mobile access panel');
  await assertNoHorizontalOverflow(page, 'mobile settings connection');
  console.log('PASS mobile-settings-responsive');

  await page.goto(`${BASE}/chat/${agent.id}`, { waitUntil: 'networkidle' });
  await page.getByTitle('Agent details').click();
  await expectVisible(page.getByText('Computer', { exact: true }).last(), 'mobile agent info tabs');
  await assertNoHorizontalOverflow(page, 'mobile agent info');
  console.log('PASS mobile-agent-info-overlay');

  const screenshotDir = path.join(process.cwd(), 'data', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'final-mobile-e2e.png'), fullPage: false });

  if (pageErrors.length) throw new Error(`mobile page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

let browser;
try {
  const agents = await api('/api/agents');
  const dev = agents.find((a) => a.name === 'dev');
  if (!dev) throw new Error('default dev Bot missing');

  const agent = await api('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: stamp,
      title: 'Desktop E2E Bot',
      description: `E2E_${stamp}`,
      systemPrompt: 'E2E test Bot.',
    }),
  }, 201);
  created.agents.push(agent.id);

  const channel = await api('/api/channels', {
    method: 'POST',
    body: JSON.stringify({
      name: `e2e-${stamp}`,
      description: `E2E group ${stamp}`,
      memberIds: [dev.id, agent.id],
    }),
  }, 201);
  created.channels.push(channel.id);

  browser = await chromium.launch({ headless: true });
  await runDesktop(browser, agent, channel);
  await runMobile(browser, agent, channel);
  console.log('PASS desktop-and-mobile-playwright-e2e');
} finally {
  await browser?.close().catch(() => undefined);
  for (const id of created.channels.reverse()) {
    await fetch(`${BASE}/api/channels/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  for (const id of created.agents.reverse()) {
    await fetch(`${BASE}/api/agents/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
