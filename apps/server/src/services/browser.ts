/**
 * Playwright browser tools. Loads lazily; returns a clear stub error if playwright
 * is not installed or browsers are missing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

let playwrightModule: any = undefined;
let browserInstance: any = null;
let pageInstance: any = null;
let missing = false;
let lastScreenshotPath: string | null = null;

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
      hint: 'Install: npm i -w @grok-bot/server playwright && npx playwright install chromium',
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
      hint: 'Install: npm i -w @grok-bot/server playwright && npx playwright install chromium',
    });
  }
}

export async function browserScreenshot(dataDir: string, hintPath?: string): Promise<string> {
  try {
    const page = await getPage();
    const dir = path.join(dataDir, 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const fileName = hintPath
      ? path.basename(hintPath).replace(/[^a-zA-Z0-9._-]/g, '_')
      : `shot-${uuid().slice(0, 8)}.png`;
    const full = path.join(dir, fileName.endsWith('.png') ? fileName : `${fileName}.png`);
    await page.screenshot({ path: full, fullPage: false });
    lastScreenshotPath = full;
    return JSON.stringify({
      ok: true,
      path: full,
      url: page.url(),
      title: await page.title(),
    });
  } catch (e) {
    // Fallback: write a tiny 1x1 PNG stub so preview still works offline
    try {
      const dir = path.join(dataDir, 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const full = path.join(dir, `stub-${Date.now()}.png`);
      // Minimal valid 1x1 PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(full, png);
      lastScreenshotPath = full;
      return JSON.stringify({
        ok: true,
        stub: true,
        path: full,
        message: e instanceof Error ? e.message : String(e),
        hint: 'Install Playwright for real screenshots',
      });
    } catch (e2) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        stub: true,
      });
    }
  }
}

export function getLastScreenshotPath(): string | null {
  return lastScreenshotPath;
}

export async function captureDesktopPreview(dataDir: string): Promise<string | null> {
  try {
    if (pageInstance && !pageInstance.isClosed()) {
      const dir = path.join(dataDir, 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const full = path.join(dir, 'preview-live.png');
      await pageInstance.screenshot({ path: full, fullPage: false });
      lastScreenshotPath = full;
      return full;
    }
  } catch {
    // ignore
  }
  if (lastScreenshotPath && fs.existsSync(lastScreenshotPath)) return lastScreenshotPath;
  // Ensure a placeholder exists
  const dir = path.join(dataDir, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const placeholder = path.join(dir, 'preview-placeholder.png');
  if (!fs.existsSync(placeholder)) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(placeholder, png);
  }
  return placeholder;
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
