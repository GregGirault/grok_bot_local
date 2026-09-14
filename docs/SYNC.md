# Sync status (box → GitHub → Windows PC)

## Local (this box) — complete
Commits on `main`:
- `2dbc2c0` Add PC sync script
- `52a4f08` Phase 1 + Grok Bot UI chrome
- `3eb5e6e` Phase 1 parity APIs

`npm run build` passes. Playwright optional dep installed; chromium downloaded on box.

## GitHub `origin/main` — partial (MCP push, no git credentials on box)
Pushed via GitHub MCP `push_files` (multiple commits), including:
- docs/PARITY.md, config/mcp.json(+example)
- AgentAvatar, index.css, AgentInfoPane
- tasks/memory routes, package.json files, skill frontmatter, PC script
- browser.ts, tasks.ts services

**Still need full tree push** of remaining Phase 1 + UI files (App.tsx, ChatPage, Settings tabs, Channels/Memory/Routines/Skills pages, repos/schema/tools/agentLoop, etc.).

## Windows PC
Path: `C:\Users\grego\grok_bot_local`

Recommended once remote is complete:
```powershell
cd C:\Users\grego\grok_bot_local
git pull origin main
npm install
npm run build
npm run dev
```

Or apply local bundle from the agent box:
```powershell
git fetch /path/to/grok_bot_local_phase1.bundle main
git merge FETCH_HEAD
```

## Blockers
- `git push` HTTPS has no credentials on the executor box (Username prompt fails).
- cursor-app-control / machineId Shell to the Windows PC was unavailable this run.
- Playwright: works when `playwright` + chromium installed; otherwise tools return clear stub JSON.
