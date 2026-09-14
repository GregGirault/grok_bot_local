# Grok Bot Local

Local free Grok Bot clone Phase 1 — chat with Ollama, tools, memory, skills, and cron routines.

**Stack:** Node 20 · TypeScript · npm workspaces · Fastify · better-sqlite3 · Vite · React · Tailwind

---

See **[docs/PARITY.md](docs/PARITY.md)** for the feature gap map (DONE / PARTIAL / TODO).

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

### Build & production start

```bash
npm run build
npm run start   # starts API only; serve apps/web/dist with any static host or open via Vite preview
```

Optional: `npm run preview -w @grok-bot/web` for the built UI.

### Configuration

Settings are stored in SQLite (`data/grok_bot.db`) and editable in the **Settings** page:

| Key | Default |
|-----|---------|
| `ollamaBaseUrl` | `http://127.0.0.1:11434` |
| `defaultModel` | `qwen2.5:7b` |
| `workspaceRoot` | `<repo>/workspace` (created at runtime) |

Add markdown skills under `skills/`. Agent tools are scoped to `workspaceRoot`.

### Push to GitHub

```bash
git remote add origin https://github.com/GregGirault/grok_bot_local.git   # if not set
git push -u origin main
```

---

## Français — Installation & lancement

### Prérequis

- Node.js **20+**
- [Ollama](https://ollama.com) en local (`http://127.0.0.1:11434`)
- Un modèle téléchargé, ex. `ollama pull qwen2.5:7b`
- Outils de compilation pour les modules natifs (`better-sqlite3`) : sous Debian/Ubuntu `build-essential python3`

### Installation

```bash
cd grok_bot_local
npm install
```

### Développement (API + UI)

```bash
npm run dev
```

- Interface : http://127.0.0.1:5173  
- API : http://127.0.0.1:8787  
- Santé : http://127.0.0.1:8787/health  

### Build & démarrage

```bash
npm run build
npm run start
```

### Configuration

Les réglages sont dans SQLite (`data/grok_bot.db`), modifiables via la page **Settings** :

| Clé | Défaut |
|-----|--------|
| `ollamaBaseUrl` | `http://127.0.0.1:11434` |
| `defaultModel` | `qwen2.5:7b` |
| `workspaceRoot` | `<repo>/workspace` |

Ajoutez des skills markdown dans `skills/`. Les outils agent sont limités à `workspaceRoot`.

---

## Features

- **Agents CRUD** — default agent `dev`
- **Streaming chat (SSE)** via Ollama OpenAI-compatible API
- **Tools:** `shell` (sandboxed), `read_file`, `write_file`, `list_dir`, `web_fetch`, `web_search`, `write_memory`, `forget_memory`
- **Memory** injected into the system prompt
- **Skills** loaded from `skills/*.md`
- **Routines** — SQLite + `node-cron` wake agents with a prompt
- **Health** — `GET /health` checks Ollama

## License

MIT
