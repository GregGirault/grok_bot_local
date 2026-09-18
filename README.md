# Grok Bot Local

Local-first Grok Bot–like assistant — persistent ASTRA Bots + Ollama + tools/plugins + memory + routines + browser/computer + Electron + mobile PWA.

**Stack:** Node 20 · TypeScript · npm workspaces · Fastify · better-sqlite3 · Vite · React · Tailwind · Electron (optional)

See **[docs/PARITY.md](docs/PARITY.md)** for the full feature map (v0.3.0).

---

## English — Install & run

### Prerequisites

- Node.js **20+**
- [Ollama](https://ollama.com) running locally (`http://127.0.0.1:11434`)
- Recommended validated models: `ollama pull granite4:micro` and `ollama pull granite3.3:2b`
- Build tools for native modules (`better-sqlite3`): on Debian/Ubuntu `build-essential python3`

### Install

```bash
cd grok_bot_local
npm install
```

### Develop (API + UI)

```bash
npm run dev
```

- Web UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  
- Health: http://127.0.0.1:8787/health  

### Electron desktop

One-command production desktop:

```bash
npm run desktop
```

Development wrapper with `npm run dev` already running:

```bash
npm run dev:desktop
```

Loads http://127.0.0.1:5173 in development. Production desktop uses http://127.0.0.1:8787.

### Mobile / LAN

```bash
npm run mobile
```

This builds the production UI and exposes it on the local network. The **Settings → Connection** panel shows reachable LAN URLs. The web app includes a manifest, service worker and standalone PWA shell.

### Build & production start

```bash
npm run build
npm run start
```

Electron is optional (`apps/desktop`); core build is shared/server/web.

### Configuration

Settings live in SQLite (`data/grok_bot.db`) and the **Settings** UI:

| Key | Default |
|-----|---------|
| `ollamaBaseUrl` | `http://127.0.0.1:11434` |
| `defaultModel` | `granite4:micro` |
| `workspaceRoot` | `<repo>/workspace` |
| `taskConcurrency` | `2` |
| `theme` / `language` / `accentColor` | dark / en / `#8b5cf6` |

### ASTRA fleet

The application seeds and maintains ten specialized Bots without wiping user data:

- `oracle` — command/orchestration
- `vulcan-forge` — software engineering
- `noesis-grid` — Home Assistant / NOESIS / automation
- `axon-nexus` — Android / phone-PC bridge
- `aegis-ledger` — markets/risk
- `mneme-vault` — persistent memory
- `helios-probe` — sourced research
- `daedalus-core` — Windows/local operations
- `sovereign-mind` — architecture/strategy
- `argos-watch` — QA/testing/regressions

Validated hardware-aware routing uses **granite4:micro** for command/code/research/quality/strategy and **granite3.3:2b** for general workers. Custom Bots keep their own system prompts and may choose their own model.

### Highlights (v0.3)

- **Attachments** — upload images/files in chat (`data/uploads`)
- **Projects** — sidebar Projects page + project-scoped memory
- **Webhooks** — `POST /api/hooks/:routineId` or `/api/hooks/token/:token`
- **13 capability packs / 34 tool memberships** — files, browser, terminal, mail, calendar, GitHub, Slack, Drive, MCP, Linear, CRM, Notes/Notion and X-local
- **41 callable tool definitions** in the validated ASTRA configuration
- **Teach mode** — record a demonstrated workflow and save it as a reusable markdown skill
- **MCP stdio + Streamable HTTP** — live JSON-RPC `initialize`, `tools/list`, `tools/call`
- **Electron** — `apps/desktop` tray-capable wrapper
- **Approvals** — dangerous shell commands require Approve/Deny
- **Auto Review** — Ask/Always/Never plus configurable allow/ask patterns
- **Official-style character picker** — 8 Grok-like SVG shapes and 11 palette colors
- **Mobile/PWA** — responsive 390×844 validation, service worker and offline shell
- **Themes** — light / dark / system + global accent

### Playwright (optional)

```bash
npm i -w @grok-bot/server playwright
npx playwright install chromium
```

Browser tools (`browser_navigate`, `browser_snapshot`, `screenshot`) show a clear install hint if Playwright is missing.

### Push to GitHub

```bash
git remote add origin https://github.com/GregGirault/grok_bot_local.git   # if not set
git push -u origin main
```

---

## Français — Installation & lancement

### Prérequis

- Node.js **20+**
- [Ollama](https://ollama.com) en local
- Modèles validés recommandés : `ollama pull granite4:micro` et `ollama pull granite3.3:2b`

### Développement

```bash
npm install
npm run dev
```

- Interface : http://127.0.0.1:5173  
- API : http://127.0.0.1:8787  

### Electron

```bash
npm run desktop
```

### Mobile

```bash
npm run mobile
```

### Webhooks

```bash
curl -X POST http://127.0.0.1:8787/api/hooks/<routineId>
```

### Projets & pièces jointes

- Page **Projects** dans la barre latérale  
- Bouton 📎 dans le chat pour joindre des fichiers  

---

## Features

- Flotte ASTRA de 10 Bots spécialisés + Bots personnalisés
- Agents CRUD · streaming chat (SSE) · markdown · widgets · tool cards · threads · reactions
- Tools: shell, files, web, browser, screenshot, copy_to/from_workspace, spawn_task, memory, plugins, MCP stdio/HTTP
- Memory tiers + user/project scopes · skills editor · cron routines + webhooks
- Teach → skill · background task pool · auto-review approvals · machines CRUD · Electron · mobile/PWA

### Final validation suite

```bash
node scripts/final-smoke.mjs
node scripts/astra-richness-smoke.mjs
node scripts/astra-model-smoke.mjs
node scripts/astra-ui-smoke.mjs
node scripts/final-browser.mjs
node scripts/final-e2e.mjs
```

Additional fixtures validate remote HTTP MCP and the Electron renderer. The final test matrix also covers 25 MB / 200 MB upload boundaries, the six-file cap, LAN access and approval policies.

## License

MIT
