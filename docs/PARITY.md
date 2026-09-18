# Feature Gap Map — Grok Bot Local vs Grok Bot capabilities

Carte d’écart détaillée (MVP → parité).  
Open reimplementation inspirée de l’UX Grok Bot — **pas** de reverse-engineering du code propriétaire Cursor. Aucun logo / wordmark Cursor.

Légende : **DONE** · **PARTIAL** · **TODO** · **STUB** (UI présente, backend minimal/absent)

**Version:** 0.3.0

---

## 1. Shell / chrome (design fidelity)

| Surface | Statut | Notes / fichiers |
|---------|--------|------------------|
| Left sidebar dense dark chrome | **DONE** | `App.tsx` — 240px panel, sections |
| Agent list + Grok-style SVG character avatars | **DONE** | 8 shapes · 11 colors · `BotAvatar.tsx` · `CharacterPicker.tsx` |
| Sidebar sections (Channels / Projects / Memory / Routines / Skills) | **DONE** | `App.tsx` NAV |
| Hidden chats | **DONE** | DB `agents.hidden` · sidebar Hidden section · hide/unhide |
| Account button bottom-left → Settings | **DONE** | Opens `/settings` |
| Ctrl/, (Cmd+,) → Settings | **DONE** | Keydown in `App.tsx` |
| Right-click agent → Delete / Hide | **DONE** | Context menu + modal |
| Chat header clickable → right info pane | **DONE** | `AgentInfoPane.tsx` |
| Info pane: Computer preview | **DONE** | Polling `/api/computer/preview` · Playwright/placeholder |
| Info pane: Routines / Channels / Members | **DONE** | Members CRUD + channel membership |
| Info pane: per-agent gear + notifications | **DONE** | `notify_on_updates` persisted & honored |
| Global Settings: General (theme/lang/accent) | **DONE** | CSS vars + localStorage + settings API |
| Global Settings: Computer (machines CRUD) | **DONE** | SQLite `machines` |
| Global Settings: Updates | **DONE** | GitHub releases/commits check (graceful fail) |
| Electron desktop wrapper | **DONE** | `apps/desktop` · `npm run dev:desktop` |
| No Cursor trademarks | **DONE** | Generic “G” mark only |
| i18n FR/EN main chrome | **DONE** | `lib/i18n.ts` |

---

## 2. Agents & team

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Create / update / list / delete agents | **DONE** | `routes/agents.ts` |
| Profile: name, title, description, system prompt | **DONE** | |
| Avatar color + shape | **DONE** | |
| SendToAgent (tool + API + inbox UI) | **DONE** | |
| Group channels + fan-out to members | **DONE** | |
| Multi-user / org members | **DONE** | `team_members` table · Info pane · Channels attach |
| Agent presence / typing indicators | **DONE** | SSE `typing` + UI dots while streaming |
| ASTRA 10 specialized Bot roster | **DONE** | `db/astraRoster.ts` + anti-wipe seed |
| Per-Bot Ollama routing | **DONE** | Hardware-validated `granite4:micro` / `granite3.3:2b` |

---

## 3. Rich chat

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Streaming tokens (SSE) | **DONE** | |
| Markdown rendering | **DONE** | `react-markdown` + `remark-gfm` |
| Widget question cards + option click | **DONE** | |
| Tool-call cards (collapsed name + result) | **DONE** | |
| Attachments (images/files) | **DONE** | `data/uploads` · `/api/uploads` |
| Message edit / regenerate | **DONE** | `PATCH /api/messages/:id` · `POST /api/chat/regenerate` |
| Hidden / archive chat | **DONE** | Hide agent chat end-to-end |

---

## 4. Tools

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| shell (sandboxed) | **DONE** | |
| read_file / write_file / list_dir | **DONE** | |
| web_fetch / web_search | **DONE** | |
| write_memory / forget_memory / recall_memory | **DONE** | |
| send_to_agent / ask_user | **DONE** | |
| browser_navigate / browser_snapshot | **DONE** | Playwright optional; clear install hint |
| screenshot | **DONE** | `page.screenshot` → `data/screenshots` |
| copy_to_workspace / copy_from_workspace | **DONE** | Machine-aware CopyToBox/FromBox analogs |
| Confirm destructive actions (UI) | **DONE** | Dangerous shell → approval widget + banner |
| spawn_task | **DONE** | Nested background task tool |
| create_routine / save_skill | **DONE** | Bots can create reusable automation/skills |
| mail / calendar / Git / Slack / Linear / CRM / Notes / X-local | **DONE** | Local capability packs, independently toggleable |
| Plugin catalog / per-tool toggles | **DONE** | 13 packs · 34 memberships in validated config |

---

## 5. Memory

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Key/value persist per agent | **DONE** | |
| Tiers: profile / log / note | **DONE** | Auto note→log after 7 days; pin→profile |
| Scopes: agent / user / project | **DONE** | User-global aggregation in prompt |
| RecallMemory search | **DONE** | |
| Memory UI page (list/add/forget/pin) | **DONE** | |
| Project-scoped memory | **DONE** | Via projects + `project_id` |

---

## 6. Skills

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Load markdown from `skills/` | **DONE** | |
| YAML frontmatter | **DONE** | |
| Skills UI list | **DONE** | |
| Write / delete skill API | **DONE** | |
| In-UI skill authoring editor | **DONE** | Create/edit markdown + frontmatter |
| Teach by demonstration → skill | **DONE** | Bot info pane + `/api/teach/*` |

---

## 7. Routines

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Cron scheduler | **DONE** | |
| Create / pause / resume / delete / run-now | **DONE** | |
| Quiet-if-empty | **DONE** | Skip post when output empty / “(no change)” |
| Webhook / event trigger | **DONE** | `POST /api/hooks/:routineId` · `/api/hooks/token/:token` |
| Routine run history UI | **DONE** | Table of runs on Routines page |

---

## 8. Tasks / subagents

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Background enqueue + list | **DONE** | |
| Report back into chat thread | **DONE** | Auto system message on completion |
| Nested Task tool for agents | **DONE** | `spawn_task` |
| Parallel worker pool limits | **DONE** | Configurable concurrency (default 2) |

---

## 9. MCP connectors

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| `config/mcp.json` loader | **DONE** | |
| Dynamic tool registration | **DONE** | |
| Live stdio MCP transport | **DONE** | JSON-RPC tools/list + tools/call · `scripts/mcp-echo-server.mjs` |
| Streamable HTTP MCP transport | **DONE** | initialize + notifications/initialized + tools/list + tools/call |
| Connectors settings UI | **DONE** | Enable/disable · edit mcp.json · show tools |

---

## 10. Computer / browser / box

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Playwright navigate + snapshot | **DONE** | Persistent Chromium profile |
| Browser click / type / select / keypress / back | **DONE** | Agent tools + manual Computer pane controls |
| Desktop / computer preview pane | **DONE** | Polling endpoint |
| Registered machines list | **DONE** | Settings→Computer CRUD |
| Auto-review safety gate | **DONE** | Approvals table + API + UI banner |
| Local box filesystem (workspace) | **DONE** | |

---

## 11. Projects

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Create / join project folders | **DONE** | CRUD slug/name/path/description |
| Project memory | **DONE** | Scoped list/add on Projects page |
| Projects UI in sidebar | **DONE** | `/projects` |

---

## 12. Security

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Shell sandbox + blocklist | **DONE** | |
| Path escape prevention | **DONE** | |
| Destructive confirm UI | **DONE** | Auto-review approvals |
| Sandboxed browser | **DONE** | Headless chromium when installed |

---

## 13. Mobile / PWA / validation

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Responsive mobile 390×844 | **DONE** | Playwright E2E |
| Mobile drawer / chat / groups / settings / Bot info | **DONE** | `final-e2e.mjs` |
| PWA manifest + service worker | **DONE** | `public/manifest.webmanifest` · `public/sw.js` |
| Offline application shell | **DONE** | Runtime E2E verified |
| LAN mode | **DONE** | `npm run mobile` / `start:lan` · `/api/network` |
| Electron production renderer | **DONE** | Native Electron test hook verifies root/brand/health |

---

## Honest leftovers

| Item | Why |
|------|-----|
| True arbitrary OS GUI automation outside browser | Local clone currently automates persistent Chromium + shell/files; arbitrary desktop GUI control would require OS-specific accessibility/input APIs |
| Electron auto-update binary channel | Optional package; “Check for updates” hits GitHub API only |
| Multi-user auth / real org SSO | Local stub members only (by design for local-first) |
| Proprietary xAI/Cursor cloud infrastructure | Local equivalent by design; not the vendor's private cloud/runtime |

## Verify

| What | Where |
|------|--------|
| UI | http://127.0.0.1:5173 |
| API health | http://127.0.0.1:8787/health |
| Desktop | `npm run desktop` |
| Mobile/LAN | `npm run mobile` |
| Webhooks | `POST /api/hooks/:routineId` |
| Projects | `/projects` · `GET/POST /api/projects` |
| Attachments | chat 📎 · `POST /api/uploads` |
| Approvals | banner in chat · `POST /api/approvals/:id` |
| MCP echo | `config/mcp.json` echo server · `scripts/mcp-echo-server.mjs` |
| Final regression | `final-smoke.mjs` · `astra-richness-smoke.mjs` · `astra-model-smoke.mjs` · `astra-ui-smoke.mjs` · `final-browser.mjs` · `final-e2e.mjs` |

### Playwright (optional)

```bash
npm i -w @grok-bot/server playwright
npx playwright install chromium
```
