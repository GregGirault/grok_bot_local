# Feature Gap Map — Grok Bot Local vs Grok Bot capabilities

Carte d’écart détaillée (MVP → parité).  
Open reimplementation inspirée de l’UX Grok Bot — **pas** de reverse-engineering du code propriétaire Cursor. Aucun logo / wordmark Cursor.

Légende : **DONE** · **PARTIAL** · **TODO** · **STUB** (UI présente, backend minimal/absent)

---

## 1. Shell / chrome (design fidelity)

| Surface | Statut | Notes / fichiers |
|---------|--------|------------------|
| Left sidebar dense dark chrome | **DONE** | `App.tsx` — 240px panel, sections |
| Agent list + colored avatars (circle/rounded/square/blob/pebble) | **DONE** | `AgentAvatar.tsx` · `index.css` |
| Sidebar sections (Channels / Memory / Routines / Skills) | **DONE** | `App.tsx` NAV |
| Hidden chats placeholder | **STUB** | Empty state in sidebar |
| Account button bottom-left → Settings | **DONE** | Opens `/settings` |
| Ctrl/, (Cmd+,) → Settings | **DONE** | Keydown in `App.tsx` |
| Right-click agent → Delete confirm | **DONE** | Context menu + modal |
| Chat header clickable → right info pane | **DONE** | `AgentInfoPane.tsx` |
| Info pane: Computer preview | **STUB** | Empty desktop preview card |
| Info pane: Routines / Channels / Members | **PARTIAL** | Routines+Channels live; Members stub |
| Info pane: per-agent gear (avatar/name/title/desc/notifications) | **PARTIAL** | Saves profile fields; notifications UI only |
| Global Settings: General (theme/lang/accent) | **PARTIAL** | UI done; light/system theme TODO |
| Global Settings: Computer (machines list) | **STUB** | Local machine row + “add remote” empty |
| Global Settings: Updates | **STUB** | Version display + check button |
| Electron desktop wrapper | **TODO** | Web-first for now |
| No Cursor trademarks | **DONE** | Generic “G” mark only |

---

## 2. Agents & team

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Create / update / list / delete agents | **DONE** | `routes/agents.ts` · `NewAgentPage` |
| Profile: name, title, description, system prompt | **DONE** | DB + UI |
| Avatar color + shape | **DONE** | `avatar_color` / `avatar_shape` |
| SendToAgent (tool + API + inbox UI) | **DONE** | `send_to_agent` · inbox panel |
| Group channels + fan-out to members | **DONE** | `routes/channels.ts` · `ChannelsPage` |
| Multi-user / org members | **TODO** | Members tab stub |
| Agent presence / typing indicators (multi) | **TODO** | |

---

## 3. Rich chat

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Streaming tokens (SSE) | **DONE** | `routes/chat.ts` · `streamChat` |
| Markdown rendering | **PARTIAL** | Plain `whitespace-pre-wrap`; MD Phase 2 |
| Widget question cards + option click | **DONE** | `ask_user` · `widget-select` · `ChatPage` |
| Tool-call cards (collapsed name + result) | **DONE** | `kind: tool_card` |
| Attachments (images/files) | **TODO** | |
| Message edit / regenerate | **TODO** | |
| Hidden / archive chat | **STUB** | Sidebar placeholder |

---

## 4. Tools

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| shell (sandboxed) | **DONE** | `tools/index.ts` |
| read_file / write_file / list_dir | **DONE** | |
| web_fetch / web_search | **DONE** | |
| write_memory / forget_memory / recall_memory | **DONE** | |
| send_to_agent / ask_user | **DONE** | |
| browser_navigate / browser_snapshot | **PARTIAL** | Playwright optional dep |
| screenshot | **STUB** | Clear error JSON |
| CopyToBox / CopyFromBox analogs | **TODO** | |
| Confirm destructive actions (UI) | **PARTIAL** | Agent delete confirm; shell still blocklist-only |

---

## 5. Memory

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Key/value persist per agent | **DONE** | `MemoryRepo` |
| Tiers: profile / log / note | **PARTIAL** | Columns + UI; no auto-promotion |
| Scopes: agent / user | **PARTIAL** | Stored; user-global aggregation light |
| RecallMemory search | **DONE** | tool + `GET /api/memory?q=` |
| Memory UI page (list/add/forget) | **DONE** | `MemoryPage.tsx` |
| Project-scoped memory | **TODO** | |

---

## 6. Skills

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Load markdown from `skills/` | **DONE** | `services/skills.ts` |
| YAML frontmatter | **DONE** | name/description |
| Skills UI list | **DONE** | `SkillsPage.tsx` |
| Write / delete skill API | **DONE** | `POST/DELETE /api/skills` |
| In-UI skill authoring editor | **TODO** | |

---

## 7. Routines

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Cron scheduler | **DONE** | `node-cron` · `RoutineScheduler` |
| Create / pause / resume / delete / run-now | **DONE** | `RoutinesPage` |
| Quiet-if-empty | **PARTIAL** | Column stored; skip-empty behavior TODO |
| Webhook / event trigger | **TODO** | |
| Routine run history UI | **TODO** | `last_run_at` only |

---

## 8. Tasks / subagents

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Background enqueue + list | **DONE** | `TaskRunner` · `/api/tasks` · Settings→Tasks |
| Report back into chat thread | **PARTIAL** | Result on task record; no auto chat post |
| Nested Task tool for agents | **TODO** | |
| Parallel worker pool limits | **TODO** | Serial queue |

---

## 9. MCP connectors

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| `config/mcp.json` loader | **DONE** | `services/mcp.ts` |
| Dynamic tool registration (stubs) | **DONE** | `mcp_<server>_<tool>` |
| Live stdio / SSE MCP transport | **TODO** | |
| Connectors settings UI | **PARTIAL** | Status in Connection settings |

Format: see `config/mcp.example.json`.

---

## 10. Computer / browser / box

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Playwright navigate + snapshot | **PARTIAL** | Optional `playwright` |
| Desktop / computer preview pane | **STUB** | Info pane Computer tab |
| Registered machines list | **STUB** | Settings→Computer |
| Auto-review safety gate | **STUB** | Documented; not wired |
| Local box filesystem (workspace) | **DONE** | `workspaceRoot` sandbox |

---

## 11. Projects

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Create / join project folders | **TODO** | |
| Project memory | **TODO** | |

---

## 12. Security

| Capacité | Statut | Pointeurs |
|----------|--------|-----------|
| Shell sandbox + blocklist | **DONE** | |
| Path escape prevention | **DONE** | `resolveSafe` |
| Destructive confirm UI | **PARTIAL** | Agent delete; more TODO |
| Sandboxed browser | **PARTIAL** | Headless chromium when installed |

---

## Phase 1 + design fidelity shipped

- Full Phase 1 APIs (inbox, widgets, channels, memory/routines/skills UI, tasks, MCP loader, Playwright tools)
- Grok Bot–like chrome: sidebar, avatars (blob/pebble), account→settings, Ctrl+,, agent context delete, chat→right info pane, Settings General/Computer/Connection/Tasks/Updates
- Default model `qwen2.5:7b`

## Verify

| What | Where |
|------|--------|
| UI | http://127.0.0.1:5173 |
| API health | http://127.0.0.1:8787/health |
| Channels | `POST /api/channels` · `POST /api/channels/:id/messages` |
| Tasks | `POST /api/tasks` · `GET /api/tasks` |
| Memory | `GET/POST /api/memory` |
| Inbox | `GET/POST /api/agents/:id/inbox` |
| Widget select | `POST /api/chat/widget-select` |
| MCP | `GET /api/mcp` |
| Settings | `/settings/general` · `/settings/computer` · … |

### Playwright (optional)

```bash
npm i -w @grok-bot/server playwright
npx playwright install chromium
```

### Pull on Windows PC

```powershell
cd C:\Users\grego\grok_bot_local
git pull origin main
npm install
npm run build
npm run dev
```
