/**
 * Playwright browser tools. Loads lazily; returns a clear stub error if playwright
 * is not installed or browsers are missing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let playwrightModule: any = undefined;
let browserInstance: any = null;
let pageInstance: any = null;
let missing = false;

async function loadPlaywright(): Promise<any> {
  if (missing) {
    throw new Error(
      'Playwright is not installed. Run: npm i -w @grok-bot/server playwright && npx playwright install chromium'
    );
  }
  if (playwrightModule) return playwrightModule;
  try {
    playwrightModule = await import('playwright');
    return playwrightModule;
  } catch {
    missing = true;
    throw new Error(
      'Playwright is not installed. Run: npm i -w @grok-bot/server playwright && npx playwright install chromium'
    );
  }
}

async function getPage(): Promise<any> {
  const pw = await loadPlaywright();
  if (!browserInstance) {
    try {
      browserInstance = await pw.chromium.launch({ headless: true });
    } catch (e) {
      throw new Error(
        `Failed to launch Chromium: ${e instanceof Error ? e.message : String(e)}. Try: npx playwright install chromium`
      );
    }
  }
  if (!pageInstance || pageInstance.isClosed()) {
    pageInstance = await browserInstance.newPage();
  }
  return pageInstance;
}

export async function browserNavigate(url: string): Promise<string> {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return JSON.stringify({ error: 'Only http/https URLs allowed' });
    }
  } catch {
    return JSON.stringify({ error: 'Invalid URL' });
  }
  try {
    const page = await getPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await page.title();
    return JSON.stringify({ ok: true, url: page.url(), title });
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
      stub: String(e).includes('not installed'),
    });
  }
}

export async function browserSnapshot(): Promise<string> {
  try {
    const page = await getPage();
    const title = await page.title();
    const url = page.url();
    const text = await page.innerText('body').catch(() => '');
    const links = await page
      .$$eval('a[href]', (els: Element[]) =>
        els.slice(0, 30).map((a) => ({
          text: (a.textContent || '').trim().slice(0, 80),
          href: a.getAttribute('href'),
        }))
      )
      .catch(() => []);
    return JSON.stringify(
      {
        url,
        title,
        text: String(text).replace(/\s+/g, ' ').trim().slice(0, 12_000),
        links,
      },
      null,
      2
    );
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
      stub: String(e).includes('not installed'),
    });
  }
}

export async function closeBrowser(): Promise<void> {
  try {
    await pageInstance?.close().catch(() => undefined);
    await browserInstance?.close().catch(() => undefined);
  } finally {
    pageInstance = null;
    browserInstance = null;
  }
}
