# Ne rien écraser — à lancer SUR LE PC, dans C:\Users\grego\grok_bot_local,
# AVANT toute copie / overlay / git pull de la fusion Grok UI.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preserve-then-fuse.ps1
#
# Ce script :
#   - refuse de tourner hors grok_bot_local
#   - copie grok_bot.db (+ wal/shm) vers data\backups\
#   - crée la branche backup/pre-fusion-astra
#   - commit le WIP (hardware.ts, models.ts, fichiers sales) s’il y en a
#   - NE supprime PAS la base, NE fait PAS git reset --hard,
#     NE fait PAS git pull origin/gpt6-astra
#
# Coller aussi depuis le README si ce fichier n’est pas encore sur le PC.

$ErrorActionPreference = 'Stop'

$here = (Get-Location).Path
$leaf = Split-Path -Leaf $here
if ($leaf -ne 'grok_bot_local') {
  Write-Error @"
Refuse : cwd n'est pas grok_bot_local.
Lance ce script depuis C:\Users\grego\grok_bot_local
Cwd actuel : $here
"@
  exit 1
}

$pkg = Join-Path $here 'package.json'
if (-not (Test-Path $pkg)) {
  Write-Error "package.json introuvable dans $here"
  exit 1
}
$pkgText = Get-Content $pkg -Raw -ErrorAction Stop
if ($pkgText -notmatch '"name"\s*:\s*"grok-bot-local"') {
  Write-Error "Ce dossier n'est pas grok-bot-local (package.json name incorrect)."
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git introuvable. Installe Git for Windows, puis relance."
  exit 1
}

Write-Output "Repo : $here"
Write-Output "=== git status (avant) ==="
git status
Write-Output ""

$dataDir = Join-Path $here 'data'
$db = Join-Path $dataDir 'grok_bot.db'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $dataDir 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if (Test-Path $db) {
  $dest = Join-Path $backupDir "grok_bot-$stamp.db"
  Copy-Item -LiteralPath $db -Destination $dest -Force
  Write-Output "SQLite copie : $dest"
  foreach ($side in @('wal', 'shm')) {
    $srcSide = Join-Path $dataDir "grok_bot.db-$side"
    if (Test-Path $srcSide) {
      $destSide = Join-Path $backupDir "grok_bot-$stamp.db-$side"
      Copy-Item -LiteralPath $srcSide -Destination $destSide -Force
      Write-Output "SQLite copie : $destSide"
    }
  }
} else {
  Write-Output "Pas de data\grok_bot.db — skip copie (le dossier data\ est intact)."
}

$backupBranch = 'backup/pre-fusion-astra'
$current = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Output "Branche courante : $current"

$created = $false
git show-ref --verify --quiet "refs/heads/$backupBranch"
$branchExists = $LASTEXITCODE -eq 0

if ($current -eq $backupBranch) {
  Write-Output "Deja sur $backupBranch — on n'y touche pas le pointeur."
} elseif (-not $branchExists) {
  git checkout -b $backupBranch
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $created = $true
  Write-Output "Branche creee : $backupBranch (depuis HEAD courant, working tree conserve)."
} else {
  git checkout $backupBranch
  if ($LASTEXITCODE -ne 0) {
    $alt = "backup/pre-fusion-astra-$stamp"
    Write-Output "Checkout $backupBranch refuse (working tree). Branche horodatee : $alt"
    git checkout -b $alt
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $backupBranch = $alt
    $created = $true
  } else {
    Write-Output "Checkout $backupBranch (pas de reset --hard)."
  }
}

$dirty = git status --porcelain
if ($dirty) {
  git add -A
  git commit -m "WIP: état ASTRA local avant fusion Grok UI"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Output "Commit WIP cree sur $backupBranch (hardware.ts / models.ts / diffs inclus)."
} else {
  Write-Output "Working tree propre — pas de commit WIP."
}

Write-Output ""
Write-Output "=== git status (apres) ==="
git status
Write-Output ""
Write-Output "=== HEAD ==="
git log -1 --oneline
Write-Output ""
Write-Output @"
OK. Rien n'a ete wipé. La base live n'a pas ete supprimee. Pas de git pull. Pas de reset --hard.

Suite (sur CE PC, apres ce script) :
  1. NE PAS git pull origin/gpt6-astra — cet historique n'est PAS la fusion Grok UI
     (le cloud Cursor et GitHub n'ont pas le meme graphe de commits).
  2. NE PAS git reset --hard. NE PAS force-push main ni gpt6-astra.
  3. Recopie le projet fusion (chrome Grok officiel + ASTRA 10) PAR-DESSUS ce dossier
     SANS toucher a data\ ni data\grok_bot.db ni data\backups\.
     Les historiques GitHub et Cursor Cloud sont sans ancetre commun : ne PAS
     git push --force. Overlay fichiers apres ce commit WIP.
  4. npm install si besoin, puis :
       npm run dev
     Ports : UI 48731 / API 48732
  5. Si oracle + vulcan-forge sont deja en base, le seed 0.13.0 ne DELETE FROM agents
     (ni messages / memoire de ces bots). Il complete seulement les reglages UI manquants.

Rappel : git pull origin gpt6-astra tout seul NE ramene PAS cette fusion.
Branche de secours : $backupBranch$(if ($created) { ' (nouvelle)' } else { '' })
"@
