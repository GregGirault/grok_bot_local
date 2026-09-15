import type { ToolContext } from './toolContext';

export async function toolWebFetch(url: string, ctx?: ToolContext): Promise<string> {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return JSON.stringify({ error: 'http/https uniquement' });
    if (ctx?.networkMode === 'allowlist') {
      const allow = ctx.networkAllowlist ?? [];
      const ok = allow.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
      if (!ok) return JSON.stringify({ error: `Réseau bloqué par la politique locale : ${u.hostname}` });
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'GrokBotLocal/0.7' } });
    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `Statut ${res.status}\n${stripped.slice(0, 15_000)}`;
  } catch (e) {
    return JSON.stringify({ error: 'web_fetch a échoué', detail: e instanceof Error ? e.message : String(e) });
  }
}

export async function toolWebSearch(query: string, ctx?: ToolContext): Promise<string> {
  const instant = await duckInstant(query);
  const htmlHits = instant.abstract || (instant.related && instant.related.length > 0) ? [] : await duckHtml(query);
  const geminiKey = ctx?.geminiApiKey?.trim();
  let gemini: string | null = null;
  if (geminiKey) {
    gemini = await geminiResearch(query, geminiKey);
  }
  return JSON.stringify(
    {
      ...instant,
      results: htmlHits,
      ...(gemini ? { gemini } : {}),
    },
    null,
    2
  );
}

async function geminiResearch(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Recherche d’information actuelle. Réponds en français, factuel, avec URLs si tu en as. Question : ${query}`,
            },
          ],
        },
      ],
      tools: [{ google_search: {} }],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const retry = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: payload.contents }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!retry.ok) return `Gemini HTTP ${retry.status}`;
      const data = (await retry.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || null;
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function duckInstant(query: string): Promise<{
  heading?: string;
  abstract?: string;
  url?: string;
  related: Array<{ Text?: string; FirstURL?: string }>;
  error?: string;
}> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'GrokBotLocal/0.11' } });
    if (!res.ok) return { related: [], error: `Recherche HTTP ${res.status}` };
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    return {
      heading: data.Heading,
      abstract: data.AbstractText,
      url: data.AbstractURL,
      related: (data.RelatedTopics ?? []).filter((t) => t.Text).slice(0, 5),
    };
  } catch (e) {
    return { related: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function duckHtml(query: string): Promise<Array<{ title: string; url: string }>> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'Mozilla/5.0 GrokBotLocal/0.11' },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const hits: Array<{ title: string; url: string }> = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && hits.length < 6) {
      const href = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (href && title) hits.push({ title, url: href });
    }
    return hits;
  } catch {
    return [];
  }
}
