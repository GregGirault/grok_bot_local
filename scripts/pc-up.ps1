# Met à jour Grok Bot sur CE PC. D'abord preserve-then-fuse.ps1 — pas de git pull auto.
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pc-up.ps1

$ErrorActionPreference = 'Stop'

function Find-Repo {
  $here = Get-Location
  if (Test-Path (Join-Path $here 'package.json')) {
    $n = (Get-Content (Join-Path $here 'package.json') -Raw)
    if ($n -match 'grok-bot-local') { return $here.Path }
  }
  $roots = @($HOME, (Join-Path $HOME 'Documents'), (Join-Path $HOME 'Desktop'), (Join-Path $HOME 'source'), (Join-Path $HOME 'dev'))
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $hits = Get-ChildItem -Path $root -Filter package.json -Recurse -Depth 4 -ErrorAction SilentlyContinue
    foreach ($f in $hits) {
      $txt = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
      if ($txt -and $txt -match '"name"\s*:\s*"grok-bot-local"') {
        return $f.DirectoryName
      }
    }
  }
  return $null
}

$repo = Find-Repo
if (-not $repo) {
  Write-Output "Pas de clone grok-bot-local sur ce PC."
  Write-Output "Le code tourne déjà dans Cursor Cloud. Pour le local :"
  Write-Output "  1. Clone le dépôt dans un dossier"
  Write-Output "  2. Relance ce script depuis ce dossier"
  exit 1
}

Set-Location $repo
Write-Output "Repo : $repo"
Write-Output "Fusion Grok UI : d'abord .\scripts\preserve-then-fuse.ps1 — pas un git pull gpt6-astra."
if (Get-Command git -ErrorAction SilentlyContinue) {
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Output "Working tree sale — git pull ignore (sinon le WIP ASTRA / hardware.ts / models.ts saute)."
    Write-Output "Lance : powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preserve-then-fuse.ps1"
  } else {
    Write-Output "git pull ignore aussi ici : l'historique GitHub gpt6-astra n'est PAS la fusion chrome Grok."
    Write-Output "Si tu veux vraiment tirer une branche, fais-le a la main apres le script preserve."
  }
} else {
  Write-Output "git introuvable — skip pull"
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
  if (-not (Test-Path 'node_modules')) { npm install }
  npm run sync-models
  npm run dev
} else {
  Write-Error "Node/npm introuvable. Installe Node 20+."
  exit 1
}
