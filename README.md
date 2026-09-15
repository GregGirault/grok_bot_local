# GPT-6-ASTRA — Grok Bot Local 0.4.0

Pont local 24/7 (Ollama + Hugging Face + outils + mémoire) pour Gregory / GregGirault.

UI: **http://127.0.0.1:43123**  
API: **http://127.0.0.1:8787** (`/health`)

## Lancer

```bash
npm install
npm run dev
```

Ollama doit tourner (`http://127.0.0.1:11434`). Au démarrage l’app profile CPU/RAM/GPU, liste les modèles Ollama, scanne le cache Hugging Face, et **auto-pull** les modèles recommandés **sur la machine qui exécute le process**.

```bash
# Optionnel
export GEMINI_API_KEY=...          # ou ANTIGRAVITY_API_KEY — fallback recherche
export GROK_BOT_ROOT=C:\Users\grego\grok_bot_local
```

Sur **PC-PORTABLE** (Windows, `C:\Users\grego`):

```powershell
cd C:\Users\grego\grok_bot_local
git fetch origin
git checkout gpt6-astra
# ou: git pull origin gpt6-astra
npm install
npm run dev
```

**Avant le premier lancement ASTRA** (pour photographier tes 10 bots live) :

```powershell
node scripts/inspect_live_bots.mjs C:\Users\grego\grok_bot_local\data\grok_bot.db
```

Le premier `npm run dev` **sauvegarde** les agents existants dans `data/backups/pre-astra-agents-*.json`, **EFFACE tous les agents SQLite** (y compris l’ancien `dev` et les 10 bots live) puis sème les 10 spécialistes ASTRA.

## Les 10 bots live n’étaient PAS dans git

Source de vérité des 10 bots existants: SQLite sur le laptop

`C:\Users\grego\grok_bot_local\data\grok_bot.db`

Ce cloud agent n’a **pas** ouvert un shell Windows sur le worker PC-PORTABLE (`05d18a92-26fe-4043-9b4b-e498c253457b`, eligibleForSubagent) — pas d’outil Task/computerUse ici. Les 10 bots n’ont donc **pas** été inspectés ligne à ligne. Le seed ASTRA **remplace** ce qu’il y a dans la DB au premier `openDatabase` (version `gpt6-astra-v1`).

Aucun `ollama pull` n’a été exécuté **sur PC-PORTABLE** depuis ce VM. Les pulls ont lieu uniquement là où tu lances `npm run dev`.

## Roster GPT-6-ASTRA

| Visible | Domaine | Modèle visé |
|---------|---------|-------------|
| GPT-6-ASTRA — Commandement · ORACLE · Orchestration 24/7 | command | qwen2.5:14b / 7b |
| VULCAN-FORGE — Code Total | code | qwen2.5-coder:14b / 7b |
| NOESIS-GRID — Maison Vivante | HAOS | qwen2.5:7b |
| AXON-NEXUS — Mobile & Pont PC | axon-android RFCY90YLP1R | qwen2.5:7b (14B AXON-intent) |
| AEGIS-LEDGER — Marchés | freqtrade / Hyperliquid | qwen2.5:7b |
| MNEME-VAULT — Mémoire Absolue | MNEME | qwen2.5:7b + nomic-embed-text |
| HELIOS-PROBE — Recherche Web | DDG + Wiki + Jina + Gemini | qwen2.5:14b / 7b |
| DAEDALUS-CORE — Système & Ops | Windows / Codex failover | qwen2.5:7b |
| SOVEREIGN-MIND — Stratégie | architecture / arbitrage IA | qwen2.5:14b / 7b |
| ARGOS-WATCH — Qualité | review / tests | qwen2.5-coder:7b |

Hardware conservateur: **7B confirmé**, **14B si VRAM ≥ 12 Go** (ou RAM ≥ 32 Go CPU offload). **Pas de 32B/70B** tant que `nvidia-smi` ne prouve pas la VRAM.

Hugging Face: `ollama pull hf.co/{org}/{model}` + import GGUF depuis `~/.cache/huggingface` et `C:\Users\grego\.cache\huggingface`.

## Internet

Chaque bot a `web_search` (DuckDuckGo Instant + HTML + Wikipedia + Jina) et `web_fetch` (Jina puis HTML). Si les hits sont maigres et `GEMINI_API_KEY` / `ANTIGRAVITY_API_KEY` est défini → fallback Gemini. Pas de jailbreak criminel ; travail technique légitime débloqué.

## Ports

Historique grok_bot: 5173 UI / 8787 API. Ici: **43123** UI (évite 3000/5173/8080) et **8787** API.

## Structure

```
apps/server   Fastify + SQLite + Ollama
apps/web      Vite React 43123
apps/desktop  Electron (pointe 43123 en dev)
packages/shared
skills/       markdown skills
data/         grok_bot.db (gitignored)
```
