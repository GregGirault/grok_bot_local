# Feature Gap Map — Grok Bot Local vs Cursor Grok Bot capabilities

Carte d’écart fonctionnel (MVP → parité Phase 1+).  
Open reimplementation — **pas** de reverse-engineering du code propriétaire Cursor.

Légende : **DONE** · **PARTIAL** · **TODO**

| # | Capacité | Statut | Pointeurs |
|---|----------|--------|-----------|
| 1 | Multi-agent team (create/update agents) | **DONE** | `apps/server/src/routes/agents.ts`, `apps/web/src/pages/NewAgentPage.tsx` |
| 1b | SendToAgent / inbox | **DONE** | tool `send_to_agent` · `InboxRepo` · UI inbox in `ChatPage.tsx` · `POST /api/agents/:id/inbox` |
| 1c | Group channels + fan-out | **DONE** | `apps/server/src/routes/channels.ts` · `apps/web/src/pages/ChannelsPage.tsx` |
| 2 | Rich chat markdown | **PARTIAL** | Plain text bubbles; markdown rendering Phase 2 |
| 2b | Widgets (question cards) | **DONE** | tool `ask_user` · SSE `widget` · `POST /api/chat/widget-select` · `ChatPage` buttons |
| 2c | Attachments | **TODO** | Upload / drag-drop files into chat |
| 2d | Streaming tool-call UI | **DONE** | Collapsed tool cards in `ChatPage.tsx` (`kind: tool_card`) |
| 3 | Tools: shell / files / web | **DONE** | `apps/server/src/tools/index.ts` |
| 3b | Screenshot | **PARTIAL** | Stub tool `screenshot` with clear error |
| 3c | Browser (Playwright) | **PARTIAL** | `browser_navigate` / `browser_snapshot` in `services/browser.ts` — works if `playwright` + chromium installed; else clear stub error |
| 3d | CopyToBox / CopyFromBox | **TODO** | Local path copy helpers |
| 4 | Memory tiers + scopes | **PARTIAL** | `tier`/`scope` columns + UI page; full profile sync Phase 2 |
| 4b | RecallMemory search | **DONE** | tool `recall_memory` · `GET /api/memory?q=` · Memory page |
| 4c | Memory UI | **DONE** | `apps/web/src/pages/MemoryPage.tsx` |
| 5 | Skills markdown + frontmatter | **DONE** | `services/skills.ts` · `SkillsPage` · `skills/*.md` |
| 5b | Skill authoring write/delete API | **DONE** | `POST/DELETE /api/skills` (UI list-only Phase 1) |
| 6 | Routines cron | **DONE** | `services/routines.ts` · `RoutinesPage` |
| 6b | Webhook trigger | **TODO** | Simple HTTP wake endpoint |
| 6c | Pause/resume/delete + quiet-if-empty | **PARTIAL** | Pause/resume/delete **DONE**; `quiet_if_empty` column stored, behavior TODO |
| 7 | Background Task / subagents | **DONE** | `TaskRunner` · `POST/GET /api/tasks` · Settings page enqueue |
| 8 | MCP client | **PARTIAL** | Loader + dynamic tool registration from `config/mcp.json` (stubs). Live stdio/SSE transport Phase 2. See format below. |
| 9 | Profile avatar name/title/desc | **DONE** | `avatar_color` / `avatar_shape` · `AgentAvatar` |
| 10 | Projects + project memory | **TODO** | Project folders |
| 11 | Desktop / Electron | **TODO** | Web UI polished (sidebar sections, Hidden chats placeholder, agent chips) |
| 11b | Dark UI polish | **DONE** | `App.tsx` sidebar: Agents / Channels / Memory / Routines / Skills / Settings |
| 12 | Sandboxed shell | **DONE** | Blocklist + workspace cwd in `tools/index.ts` |
| 12b | Confirm destructive actions | **TODO** | UI confirm for rm-like / delete agent |

## Phase 1 shipped this run

- Agent↔agent messaging (API + inbox UI)
- Chat widgets + selection stream
- Tool-call cards (collapsed)
- Memory / Routines / Skills / Channels pages
- Playwright tools (optional install)
- Background tasks API
- MCP config loader (0 servers by default)
- Sidebar polish + avatars

## MCP config format (`config/mcp.json`)

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "disabled": false,
      "tools": [
        {
          "name": "list_files",
          "description": "List files",
          "parameters": {
            "type": "object",
            "properties": { "path": { "type": "string" } },
            "required": ["path"]
          }
        }
      ]
    }
  ]
}
```

Tools are registered as `mcp_<server>_<tool>` stubs until live transport lands.  
Example file: `config/mcp.example.json`.

## Playwright (optional)

```bash
npm i -w @grok-bot/server playwright
npx playwright install chromium
```

Without it, `browser_navigate` / `browser_snapshot` return a clear JSON error (`stub: true`).

## Verify

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787/health  
- Channels: `POST /api/channels` · `POST /api/channels/:id/messages`  
- Tasks: `POST /api/tasks` · `GET /api/tasks`  
- Memory: `GET/POST /api/memory`  
- Inbox: `GET/POST /api/agents/:id/inbox`  
- Widget: agent tool `ask_user` → UI buttons → `POST /api/chat/widget-select`  
- MCP: `GET /api/mcp`
