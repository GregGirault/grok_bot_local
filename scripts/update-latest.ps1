# Overlay chrome grok-ui-astra. ASCII. Pas de merge. Pas de reset --hard. data\ intact.
# powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-latest.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\grego\grok_bot_local'
$here = (Get-Location).Path
Write-Output ("Repo : " + $here)
if ((Split-Path -Leaf $here) -ne 'grok_bot_local') {
  Write-Output 'Refuse : cwd n est pas grok_bot_local'
  exit 1
}

$mergeHead = Join-Path $here '.git\MERGE_HEAD'
if (Test-Path $mergeHead) {
  Write-Output 'Merge en cours'
  $u = @(git diff --name-only --diff-filter=U)
  if ($u.Count -gt 0) {
    foreach ($f in $u) {
      $n = [string]$f
      if ($n -match 'hardware\.ts$' -or $n -match 'models\.ts$' -or $n -match '(^|/)data(/|$)') {
        git checkout --ours -- $f
      } else {
        git checkout --theirs -- $f
      }
    }
    git add -A
    git reset HEAD -- data 2>$null
    git commit -m "Fin merge grok-ui-astra (theirs chrome, ours hardware/models)"
    if ($LASTEXITCODE -ne 0) {
      Write-Output 'Commit merge refuse - abort'
      git merge --abort
    }
  } else {
    git merge --abort
    Write-Output 'Merge abort (pas de conflits listes)'
  }
}

$keepDir = Join-Path $env:TEMP 'gb-keep-hw'
New-Item -ItemType Directory -Force -Path $keepDir | Out-Null
foreach ($leaf in @('hardware.ts', 'models.ts')) {
  $src = Join-Path $here ("apps\server\src\services\" + $leaf)
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $keepDir $leaf) -Force
    Write-Output ("Copie : " + $leaf)
  }
}

Write-Output 'git fetch origin grok-ui-astra'
git fetch origin grok-ui-astra
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git log -1 --oneline origin/grok-ui-astra

Write-Output 'Overlay checkout (pas de merge, data\ non touche)'
git checkout origin/grok-ui-astra -- apps/web packages/shared
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git checkout origin/grok-ui-astra -- apps/server
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

foreach ($leaf in @('hardware.ts', 'models.ts')) {
  $saved = Join-Path $keepDir $leaf
  $rel = 'apps/server/src/services/' + $leaf
  $dst = Join-Path $here ("apps\server\src\services\" + $leaf)
  if (Test-Path $saved) {
    Copy-Item -LiteralPath $saved -Destination $dst -Force
    Write-Output ("Restaure working tree : " + $leaf)
  } else {
    git cat-file -e ("HEAD:" + $rel) 2>$null
    if ($LASTEXITCODE -eq 0) {
      git checkout HEAD -- $rel
      Write-Output ("Restaure HEAD : " + $leaf)
    }
  }
}

$chat = Join-Path $here 'apps\web\src\components\ChatView.tsx'
if (-not (Test-Path $chat)) {
  Write-Output 'ChatView.tsx manquant - overlay incomplet'
  git status
  exit 1
}
Write-Output 'OK ChatView.tsx (data\ non touche)'

npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output 'URL LAN (meme Wi-Fi) :'
ipconfig | Select-String 'IPv4'
Write-Output 'PC : http://127.0.0.1:48731'
Write-Output 'API : http://127.0.0.1:48732'
Write-Output 'npm run dev (ports 48731 / 48732, pas de Stop-Process)'
npm run dev
