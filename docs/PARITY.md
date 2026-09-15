# GPT-6-ASTRA 0.4.0

Copied from grok_bot_local v0.3.0 (GregGirault) then:

- Per-agent `model` / `hfModel` / `domain` / `specialty` / `effort`
- Wipe+seed 10 ASTRA bots (`gpt6-astra-v1`) including undeletable `dev`
- Hardware profiler + Ollama/HF catalog + `/api/pull`
- Web search: DDG HTML + Instant + Wikipedia + Jina + Gemini fallback
- Specialty always visible in sidebar
- UI port 43123, API 8787

Live 10 bots were in `C:\Users\grego\grok_bot_local\data\grok_bot.db` — not git.
Wipe now writes `data/backups/pre-astra-agents-*.json` first. `scripts/inspect_live_bots.mjs` dumps names/prompts without deleting.
