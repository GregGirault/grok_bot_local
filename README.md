# Grok Bot Local — fusion Grok + GPT-6-ASTRA 10

Clone local de **Grok Bot** (chrome officiel : roster persistant, blobs avec yeux, ordinateur à 3 niveaux, marketplace plugins, MCP, auto-revue, enseigner une tâche, partage de bot, routines, groupes 2–6, PWA, Personnage / Profil, Réglages) — **en français**.

Identité de la flotte : les **10 bots GPT-6-ASTRA** (`oracle`, `vulcan-forge`, `noesis-grid`, `axon-nexus`, `aegis-ledger`, `mneme-vault`, `helios-probe`, `daedalus-core`, `sovereign-mind`, `argos-watch`). Ce n’est plus le roster 12 experts astra/vertex/orion.

La 1ʳᵉ ligne du roster est le prénom (`Oracle`, `Vulcan-Forge`, …). La **2ᵉ ligne** est la spécialité (ORACLE, Code · TS…), visible sans cliquer.

Pas de bouton **Publish** : SQLite + Ollama, inadapté à Vercel.

## Ne rien écraser

Ordre obligatoire **sur le PC** (`C:\Users\grego\grok_bot_local`) : **sauvegarde SQLite + commit git du WIP**, ensuite seulement la fusion chrome Grok. Rien n’est committé sur le portable depuis le cloud (aucun worker Cursor n’est connecté).

`git pull origin gpt6-astra` **seul ne ramène pas cette fusion**. `fusion-grok-astra` non plus (scripts / ancienne UI 0.4.0). L’overlay chrome Grok + ASTRA 10 est la branche GitHub **`grok-ui-astra`**. Ne **jamais** `git push --force` sur GitHub `main`, `gpt6-astra`, ni `backup/pre-fusion-astra`. Ne **jamais** supprimer `data\grok_bot.db`.

### 1. Coller ça dans Windows PowerShell **avant** toute copie de fichiers

Le cwd doit être `C:\Users\grego\grok_bot_local`. Si `scripts\preserve-then-fuse.ps1` est déjà là (fichier **corrigé** : plus de liste `1. NE PAS` hors chaîne, sinon PowerShell plante) :

```powershell
git fetch origin fusion-grok-astra
git checkout origin/fusion-grok-astra -- scripts/preserve-then-fuse.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preserve-then-fuse.ps1
```

Ou double-clic / `.\scripts\preserve-then-fuse.cmd`. Sinon colle le bloc suivant **tel quel** (même effet : backup SQLite, branche `backup/pre-fusion-astra`, commit WIP s'il y a des fichiers sales - c'est comme ça qu'on ne perd pas `hardware.ts` / `models.ts`). Ne **jamais** coller une liste numerotee `1. 2. 3.` hors `Write-Output` : PowerShell parse `1.` comme un nombre.

```powershell
$ErrorActionPreference = 'Stop'
if ((Split-Path -Leaf (Get-Location).Path) -ne 'grok_bot_local') {
  throw "Lance ce bloc depuis C:\Users\grego\grok_bot_local"
}
git status
$dataDir = Join-Path (Get-Location) 'data'
$db = Join-Path $dataDir 'grok_bot.db'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $dataDir 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (Test-Path $db) {
  Copy-Item $db (Join-Path $backupDir "grok_bot-$stamp.db")
  foreach ($side in @('wal','shm')) {
    $p = Join-Path $dataDir "grok_bot.db-$side"
    if (Test-Path $p) { Copy-Item $p (Join-Path $backupDir "grok_bot-$stamp.db-$side") }
  }
}
$b = 'backup/pre-fusion-astra'
git show-ref --verify --quiet "refs/heads/$b"
if ($LASTEXITCODE -ne 0) { git checkout -b $b } else { git checkout $b }
if (git status --porcelain) {
  git add -A
  git commit -m "WIP: etat ASTRA local avant fusion Grok UI"
}
git status
Write-Output "OK. Pas de pull, pas de reset --hard, base intacte."
Write-Output "NE PAS git pull origin/gpt6-astra - pas la fusion Grok UI."
Write-Output "NE PAS git reset --hard. Overlay ensuite SANS toucher data\"
```

Interdit dans cette étape : `git reset --hard`, `Remove-Item data\grok_bot.db`, `git pull origin gpt6-astra` (cça ne pose pas le chrome Grok et peut coincer le commit WIP).

### 2. Seed `0.13.0` — ne pas détruire `grok_bot.db`

**Sur le PC**, si `data/grok_bot.db` contient déjà `oracle` **et** `vulcan-forge` :

- le seed **ne fait pas** `DELETE FROM agents` (ni `messages` / `memory` liés à ces agents)
- les 10 bots live, leurs messages, mémoires et prompts restent
- seuls les réglages UI **manquants** sont remplis, le plugin **MCP** est ajouté à la liste s’il n’y est pas (les autres plugins restent), le `seedVersion` passe à `0.13.0`, et la 2ᵉ ligne (titre) est alignée sur la spécialité ASTRA
- un appel interne de wipe en présence des sentinelles **lève une erreur** au lieu d’effacer

Vérif : `npm run test:seed`.

**Ne lance pas** l’ancien seed `0.12.1` (il wipait toute la table `agents` dès que la version ne collait pas).

### 3. Ensuite seulement : poser la fusion (`grok-ui-astra`)

Reste sur **`backup/pre-fusion-astra`** (ne merge pas dans `gpt6-astra` / `main`). Dans `C:\Users\grego\grok_bot_local` :

```powershell
git fetch origin grok-ui-astra
git merge origin/grok-ui-astra --allow-unrelated-histories -m "Fusion chrome Grok officiel + ASTRA 10"
```

Des conflits sont **probables**. Politique :

- **Garder OURS** : `apps/server/src/services/hardware.ts`, `apps/server/src/services/models.ts`, tout `data\` (jamais `git checkout` de `data` depuis l’overlay).
- **Prendre THEIRS** : `apps/web/src/App.tsx`, `apps/web/src/components/ChatView.tsx`, `SettingsModal.tsx`, `ProfileEditor.tsx`, `BotAvatar.tsx`, `apps/server/src/db/seed.ts` (0.13 anti-wipe), `packages/shared`, le reste de `apps/web`.
- **Interdit** : `git reset --hard`, `Remove-Item data\grok_bot.db`, `git push --force` sur `main` / `gpt6-astra` / `backup/pre-fusion-astra`.

Si le merge est trop hostile, **sans reset** :

```powershell
git merge --abort
git checkout origin/grok-ui-astra -- apps/web packages/shared
git checkout origin/grok-ui-astra -- apps/server
git checkout HEAD -- apps/server/src/services/hardware.ts apps/server/src/services/models.ts
git add -A
git status
git commit -m "Fusion chrome Grok officiel + ASTRA 10 (checkout overlay, hardware/models conserves)"
```

Ne **jamais** `git checkout origin/grok-ui-astra -- data`.

Puis :

```powershell
npm install
npm run dev
```

Ports **48731** UI / **48732** API. Ne lance **pas** `npm run sync-models` depuis le cloud (gros GGUF). Sur le PC seulement, si un tag ASTRA manque.

Une base **sans** oracle+vulcan-forge (ex. ancien 12 experts astra/vertex) est remplacée par les 10 ASTRA. Une base vide aussi. Le roster live n’est **pas** astra/vertex/12 experts.

## Équipe GPT-6-ASTRA 10 (PC-PORTABLE)

Sonde hardware : Windows 11 Pro, i5-1240P, **63,7 Go RAM**, RTX 2050 + Iris Xe, Ollama local. Groupe seed **ASTRA** : oracle + vulcan-forge + daedalus-core.

| Bot | 2ᵉ ligne (spécialité) | Ollama | Hugging Face (ASTRA) |
| --- | --- | --- | --- |
| Oracle | ORACLE · Orchestration 24/7 | `qwen3:30b` | `hf.co/Qwen/Qwen2.5-14B-Instruct-GGUF` |
| Vulcan-Forge | VULCAN-FORGE · TS / React / Node / Python / PHP | `qwen2.5-coder:14b` | Coder-14B GGUF |
| Noesis-Grid | NOESIS-GRID · HAOS · MYÉLIA · Argos | `qwen2.5:14b` | 7B Instruct GGUF |
| Axon-Nexus | AXON-NEXUS · Android · RFCY90YLP1R | `qwen2.5:14b` | 7B Instruct GGUF |
| Aegis-Ledger | AEGIS-LEDGER · Crypto · freqtrade · Hyperliquid | `qwen2.5:14b` | 7B Instruct GGUF |
| Mneme-Vault | MNEME-VAULT · Mémoire | `qwen2.5:14b` | 7B Instruct GGUF |
| Helios-Probe | HELIOS-PROBE · Recherche | `qwen3:8b` | 14B Instruct GGUF |
| Daedalus-Core | DAEDALUS-CORE · Windows · Ops | `qwen2.5:14b` | 7B Instruct GGUF |
| Sovereign-Mind | SOVEREIGN-MIND · Architecture | `qwen3:30b` | 14B Instruct GGUF |
| Argos-Watch | ARGOS-WATCH · Review · tests | `qwen2.5-coder:7b` | Coder-7B GGUF |

Moteur par défaut : **Ollama**. Hugging Face = `router.huggingface.co` si `HF_TOKEN` est dans Réglages. Si HF échoue, retour sur Ollama. Clé **Gemini** (AI Studio) : même écran, pour renforcer `web_search`. Ce n’est pas Antigravity, et ce n’est pas un mode sans limite.

Sur le PC, **si le projet est cloné** :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pc-up.ps1
```

Ça **ne fait plus** `git pull` (trop dangereux pendant la fusion). `npm run sync-models` puis `npm run dev`. D’abord `preserve-then-fuse.ps1`. Je ne peux pas lancer ça depuis le cloud : `C:\Users\grego` n’est pas cette machine.

### Worker Cursor (`agent worker start`)

Le Cloud Agent tourne **ici** (Linux, 16 Go, pas de GPU). Pour qu’il exécute les commandes **sur PC-PORTABLE** (Ollama, RTX 2050), un worker Cursor doit rester ouvert **sur le PC**. Je ne peux pas le démarrer depuis le cloud : aucun worker n’est connecté.

**Pas dans le terminal de cette conversation.** Si tu vois l’onglet `Travail grokbot`, le prompt `workspace $` et `bash`, tu es sur la machine cloud. `irm` / `iex` / `agent` y échouent : ce n’est pas Windows.

Ouvre **Windows PowerShell sur le portable** (menu Démarrer → `PowerShell`), pas le bash de l’Agent cloud, pas Git Bash. Colle le bloc ci-dessous. **Laisse la fenêtre ouverte.**

```powershell
$ErrorActionPreference = 'Stop'
function Refresh-AgentPath {
  foreach ($p in @(
    (Join-Path $HOME '.local\bin'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\bin'),
    (Join-Path $env:USERPROFILE '.cursor\bin')
  )) { if (Test-Path $p) { $env:Path = "$p;$env:Path" } }
}
Refresh-AgentPath
if (-not (Get-Command agent -ErrorAction SilentlyContinue)) {
  Write-Output "Installation du Cursor CLI…"
  irm 'https://cursor.com/install?win32=true' | iex
  Refresh-AgentPath
}
if (-not (Get-Command agent -ErrorAction SilentlyContinue)) {
  throw "Commande 'agent' introuvable. Ferme PowerShell, rouvre-le, recolle ce bloc."
}
Write-Output "CLI : $(agent --version)"
Write-Output "Laisse cette fenêtre ouverte."
agent worker start --name "PC-PORTABLE"
if ($LASTEXITCODE -ne 0) {
  agent login
  agent worker start --name "PC-PORTABLE"
}
```

Si le projet est cloné : `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\worker-start.ps1` (ajoute `--worker-dir` tout seul).

#### Bug Windows `NODE_MODULE_VERSION 127` vs `137`

Sur Windows, `agent worker start` plante souvent tout de suite : le paquet Cursor embarque `better-sqlite3` compilé pour Node 22 (ABI 127) alors que le runtime du worker est Node 24 (ABI 137). **`npm install` dans `C:\Users\…` ne change rien.** C’est un bug Cursor, pas ton projet.

Toujours dans **Windows PowerShell**, colle ceci, puis relance `agent worker start --name "PC-PORTABLE"` :

```powershell
$ErrorActionPreference = 'Stop'
$nodeFile = Get-ChildItem "$env:LOCALAPPDATA\cursor-agent\versions" -Recurse -Filter 'better_sqlite3.node' |
  Where-Object { $_.FullName -match '\\better-sqlite3\\build\\Release\\' } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $nodeFile) { throw 'better_sqlite3.node introuvable. Installe d’abord le Cursor CLI.' }
$pkg = Join-Path (Split-Path (Split-Path (Split-Path $nodeFile.FullName))) 'package.json'
$bsv = if (Test-Path $pkg) { (Get-Content $pkg -Raw | ConvertFrom-Json).version } else { '12.12.0' }
Copy-Item $nodeFile.FullName "$($nodeFile.FullName).bak-abi127" -Force
$tmp = Join-Path $env:TEMP 'cursor-bsqlite-137'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$tar = Join-Path $tmp 'prebuild.tar.gz'
$ok = $false
foreach ($ver in @($bsv, '12.12.0', '12.11.1')) {
  $url = "https://github.com/WiseLibs/better-sqlite3/releases/download/v$ver/better-sqlite3-v$ver-node-v137-win32-x64.tar.gz"
  try { Invoke-WebRequest -Uri $url -OutFile $tar -UseBasicParsing; $ok = $true; break } catch {}
}
if (-not $ok) { throw 'Téléchargement du prebuild ABI 137 impossible.' }
tar -xzf $tar -C $tmp
$fresh = Get-ChildItem $tmp -Recurse -Filter 'better_sqlite3.node' | Select-Object -First 1
Copy-Item $fresh.FullName $nodeFile.FullName -Force
Write-Output "OK ABI 137 → $($nodeFile.FullName)"
Write-Output 'Relance : agent worker start --name "PC-PORTABLE"'
```

Un `agent update` peut réécraser le fichier : recreer le correctif. Le worker WSL n’est pas un remplacement si Ollama et le GPU sont sur Windows natif.

Ensuite, **nouvelle** tâche Cloud Agent : dans le sélecteur d’environnement, choisis **PC-PORTABLE**. Cette session-ci reste sur le cloud Linux.

Internet : DuckDuckGo + Gemini (si clé) + `web_fetch` pour tous les bots.

Aegis / Meridian : défense et recherche — pas d’exploits, pas d’ordres réels. Le « tout est permis » s’arrête à l’illégal dur (malware, fraude, attaque, CSAM).

Après overlay + `npm run dev` : si oracle + vulcan-forge sont déjà en base, **rien n’est wipé**. Sinon (base vide ou ancien 12 experts), seed ASTRA 10.

## Lancer

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

- Interface : http://127.0.0.1:48731  
- API : http://127.0.0.1:48732  

### Sonde du PC (RAM, GPU, Ollama)

À lancer **sur ton ordinateur**, pas dans le terminal cloud Cursor. **Aucun dossier projet n’est requis.**

Sous Windows, colle ce bloc dans PowerShell (même depuis `C:\Users\…`) :

```powershell
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$gpu = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$ollama = $false
$models = @()
try {
  $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
  $ollama = $true
  $models = @($tags.models | ForEach-Object { $_.name })
} catch {}
$payload = [pscustomobject]@{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  source     = 'paste'
  hostname   = $env:COMPUTERNAME
  os         = $os.Caption
  osVersion  = $os.Version
  cpu        = $cpu.Name
  cores      = $cpu.NumberOfCores
  threads    = $cpu.NumberOfLogicalProcessors
  ramGb      = [math]::Round(($os.TotalVisibleMemorySize / 1MB), 1)
  gpu        = $gpu
  diskCGb    = if ($disk.Size) { [math]::Round(($disk.Size / 1GB), 1) } else { $null }
  diskCFreeGb= if ($disk.FreeSpace) { [math]::Round(($disk.FreeSpace / 1GB), 1) } else { $null }
  ollama     = @{ reachable = $ollama; models = $models }
}
$json = $payload | ConvertTo-Json -Depth 5
$out = Join-Path $HOME 'grok-bot-pc.json'
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Output $json
Write-Output ""
Write-Output "Fichier : $out"
```

Le JSON s’affiche et est aussi écrit dans `C:\Users\<toi>\grok-bot-pc.json`. Colle-le ici pour choisir les modèles.

Si le projet est déjà cloné, depuis **sa racine** : `npm run probe-pc`. Le fichier `.\scripts\probe-pc.ps1` n’existe que dans ce dossier — pas dans `C:\Users\…`.

### Téléphone (iPhone / Android)

Même app, même compte local, même ordinateur. Pas d’App Store : c’est l’app web en mode téléphone (comme Grok Bot mobile : liste des bots, conversation, ordinateur, photo, dictée).

1. Le Mac/PC et le téléphone sont sur le **même Wi-Fi**.
2. Dans Grok Bot (bureau) → ton nom en bas → **Ouvrir sur le téléphone** (copie l’adresse `http://192.168.…:48731`).
3. Ouvre cette adresse dans Safari ou Chrome.
4. **Partager → Sur l’écran d’accueil** (iOS) ou **Installer l’application** (Android).

Tu peux envoyer un texte, dicter, prendre une photo, joindre un fichier, `@everyone`, répondre, réagir, prendre le contrôle de l’ordinateur, gérer les routines. L’app officielle n’édite le planning des routines que sur le bureau ; ici, l’édition reste disponible aussi sur le téléphone.

Ollama est optionnel. **Sans Ollama, il n’y a pas de modèle de langage.** Les bots ne « prennent » pas Grok, ni Qwen, ni un agent caché. Le serveur bascule sur `LocalLlm` (`apps/server/src/services/llm.ts`) : un routeur déterministe écrit à la main. Il reconnaît quelques mots-clés (`liste`, `lis le fichier`, `cherche`, `question`) et émet de faux appels d’outils, sinon il répond un texte français préparé qui reformule l’objectif et dit qu’Ollama n’est pas joignable. Les morceaux partent 4 caractères à la fois (18 ms) pour imiter la frappe. Ce n’est pas une IA.

Avec Ollama en local (`http://127.0.0.1:11434`, modèle par défaut `qwen2.5:7b`), c’est un vrai modèle sur ta machine — toujours pas le Grok cloud.

```bash
ollama pull qwen2.5:7b
```

### Bureau Electron

```bash
npm run dev
npm run dev:desktop
```

## Parité produit

- Onboarding : Continuer en local → Rencontrer un collègue ou créer le tien → Démarrage de l’ordinateur
- Téléphone : liste des bots, conversation plein écran, photo, dictée, ordinateur en fiche, PWA écran d’accueil
- Roster plat (prénoms + spécialité visible, horodatage, groupes mélangés avec avatars empilés), Plugins + compte
- Chat « Message Oracle », widgets mail / agenda / tableau / routine / transfert / secret masqué
- Fils (répondre), réactions 👍 👀 ✅, redirection pendant un tour, Arrêter
- Composer : glisser-déposer, coller une image, 6 fichiers, 25 Mo (200 Mo vidéo), brouillon local
- Cartes fichier et lien dans la transcription
- `@` : bots, groupes, routines, plugins, `@everyone` — `/` compétences
- Cmd+K (messages, fichiers, routines), Cmd+N, Cmd+, Cmd+/
- Ordinateur : icône violette, aperçu « Écran d’Oracle », prise de contrôle, fonds dynamiques, Démarrage / Mise à jour
- Routines : activer, pause, test, édition, suppression, webhook, événements GitHub/Slack, historique (20 runs)
- Enseigner une tâche (10 min) → compétence `/` enregistrée, activable par bot
- Plugins Marketplace / Les tiens : Fichiers, Navigateur, Terminal, Messagerie, Calendrier, GitHub, Slack, Drive, MCP, Linear, CRM, Notes, X
- Profil / Personnage : 8 formes (cercle, blob, carré arrondi, pilule, triangle, hexagone, nuage, goutte), 11 couleurs officielles, rétablir, instructions, routines, ⋯ supprimer
- Réglages téléphone : compte, utilisation %, plugins, examen automatique, fuseau auto, ordinateur du Bot, notifications
- Auto-revue : Exiger une approbation gagne sur Toujours autoriser ; interrupteur d’application
- Approbations : Autoriser une fois, Toujours autoriser, Refuser
- Partage : aperçu puis **Ajouter à Grok Bot**
- Groupes : 2–6 bots, édition du nom et des membres, `@everyone` ou premier bot
- Limites : 50 bots+groupes, 6 bots par groupe, 50 routines par bot

Les données : `data/grok_bot.db`, fichiers : `workspace/`.

## Ce que le cloud a et que le local simule

| Cloud | Local |
| --- | --- |
| VM persistante Cursor | Workspace + instantanés `data/snapshots/durable` |
| Connecteurs OAuth (Gmail, Slack, …) | Fichiers JSON / journaux + secret masqué |
| Marketplace xAI | Catalogue local Marketplace / Les tiens |
| Usage Cursor / SuperGrok | Compteur hebdomadaire local |
| Team Setup admin | `config/team-setup.md` → `workspace/TEAM.md` |
| Apps iOS / Android | PWA téléphone (même serveur local, écran d’accueil) |
| Sign in with Cursor | Continuer en local |

## Licence

MIT
