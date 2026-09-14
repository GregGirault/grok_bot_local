# Grok Bot Local

Local-first Grok Bot–like assistant — Ollama + tools + memory + routines + Electron desktop.

**Stack:** Node 20 · TypeScript · npm workspaces · Fastify · better-sqlite3 · Vite · React · Tailwind · Electron (optional)

See **[docs/PARITY.md](docs/PARITY.md)** for the full feature map (v0.3.0).

---

## English — Install & run

### Prerequisites

- Node.js **20+**
- [Ollama](https://ollama.com) running locally (`http://127.0.0.1:11434`)
- A model pulled, e.g. `ollama pull qwen2.5:7b`
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

With `npm run dev` already running:

```bash
npm run dev:desktop
```

Loads http://127.0.0.1:5173 in development. Production: point at http://127.0.0.1:8787 (`GROK_BOT_DESKTOP_PROD=1`).

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
| `defaultModel` | `qwen2.5:7b` |
| `workspaceRoot` | `<repo>/workspace` |
| `taskConcurrency` | `2` |
| `theme` / `language` / `accentColor` | dark / en / `#8b5cf6` |

### Highlights (v0.3)

- **Attachments** — upload images/files in chat (`data/uploads`)
- **Projects** — sidebar Projects page + project-scoped memory
- **Webhooks** — `POST /api/hooks/:routineId` or `/api/hooks/token/:token`
- **MCP stdio** — live JSON-RPC client; example `scripts/mcp-echo-server.mjs`
- **Electron** — `apps/desktop` tray-capable wrapper
- **Approvals** — dangerous shell commands require Approve/Deny
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
- Un modèle, ex. `ollama pull qwen2.5:7b`

### Développement

```bash
npm install
npm run dev
```

- Interface : http://127.0.0.1:5173  
- API : http://127.0.0.1:8787  

### Electron

```bash
npm run dev:desktop
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

- Agents CRUD · streaming chat (SSE) · markdown · widgets · tool cards
- Tools: shell, files, web, browser, screenshot, copy_to/from_workspace, spawn_task, memory, MCP
- Memory tiers + user/project scopes · skills editor · cron routines + webhooks
- Background task pool · auto-review approvals · machines CRUD · Electron

## License

MIT
