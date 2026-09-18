import path from 'node:path';
import browser from '../apps/server/dist/services/browser.js';

const BASE = process.env.GROK_BOT_URL || 'http://127.0.0.1:8787';
const stamp = `browser_${Date.now()}`;

async function request(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function parse(raw, label) {
  const value = JSON.parse(raw);
  if (value?.error) throw new Error(`${label}: ${value.error}`);
  return value;
}

let agent;
try {
  agent = await request(`${BASE}/api/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: stamp,
      title: 'Browser Final',
      description: 'persistent browser final test',
      systemPrompt: 'Reply exactly BROWSER_ACK and nothing else. Do not use tools.',
    }),
  });

  parse(await browser.browserNavigate(`${BASE}/chat/${agent.id}`), 'navigate chat');
  parse(await browser.browserType('textarea', `PERSIST_DRAFT_${stamp}`), 'type draft');
  console.log('PASS browser-type');

  await browser.closeBrowser();
  parse(await browser.browserNavigate(`${BASE}/chat/${agent.id}`), 'reopen chat');
  parse(await browser.browserClick('textarea'), 'click textarea');
  parse(await browser.browserPress('Enter'), 'press Enter');
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const afterReopen = parse(await browser.browserSnapshot(), 'snapshot after reopen');
  if (!String(afterReopen.text || '').includes(`PERSIST_DRAFT_${stamp}`)) {
    throw new Error(`persistent draft did not survive Chromium restart: ${JSON.stringify(afterReopen).slice(0, 1500)}`);
  }
  console.log('PASS persistent-browser-profile-draft');

  const shot = parse(
    await browser.browserScreenshot(path.join(process.cwd(), 'data'), 'final-browser.png'),
    'screenshot'
  );
  if (!shot.ok || shot.stub) throw new Error(`screenshot was not live: ${JSON.stringify(shot)}`);
  console.log(`PASS browser-screenshot :: ${shot.path}`);

  parse(await browser.browserNavigate(`${BASE}/search`), 'navigate search');
  parse(
    await browser.browserType('input[placeholder="Search prior work…"]', 'Browser Final'),
    'type search'
  );
  await new Promise((resolve) => setTimeout(resolve, 700));
  const searchSnapshot = parse(await browser.browserSnapshot(), 'search snapshot');
  if (!String(searchSnapshot.text || '').includes('Browser Final')) {
    throw new Error(`search result missing: ${JSON.stringify(searchSnapshot).slice(0, 1500)}`);
  }
  const clicked = parse(await browser.browserClick('a[href="/channels"]'), 'click channels');
  if (!String(clicked.url || '').includes('/channels')) {
    throw new Error(`click did not navigate to channels: ${JSON.stringify(clicked)}`);
  }
  console.log('PASS browser-navigate-type-click-snapshot');
} finally {
  await browser.closeBrowser().catch(() => undefined);
  if (agent?.id) {
    await fetch(`${BASE}/api/agents/${agent.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
