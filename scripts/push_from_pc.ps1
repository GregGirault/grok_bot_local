# Sync & run GPT-6-ASTRA on PC-PORTABLE
# Live SQLite (old 10 bots): C:\Users\grego\grok_bot_local\data\grok_bot.db
# First npm run dev BACKS UP then WIPES agents and seeds the ASTRA roster.
cd C:\Users\grego\grok_bot_local
if (Test-Path .\data\grok_bot.db) {
  node .\scripts\inspect_live_bots.mjs .\data\grok_bot.db | Out-File -Encoding utf8 .\data\pre-astra-inspect.json
  Write-Host "Inspect dump: data\pre-astra-inspect.json"
}
git fetch origin
git checkout gpt6-astra
git pull origin gpt6-astra
npm install
npm run dev
