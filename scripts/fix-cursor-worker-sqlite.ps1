# Contourne le bug Windows Cursor : better-sqlite3 ABI 127 (Node 22) vs runtime 137 (Node 24).
# Coller le bloc du README si tu n’as pas le clone. Sinon :
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-cursor-worker-sqlite.ps1
#
# Puis relance : agent worker start --name "PC-PORTABLE"
# Un `agent update` peut réécraser le binaire : relance ce script.

$ErrorActionPreference = 'Stop'

function Find-AgentBetterSqlite {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\versions'),
    (Join-Path $env:APPDATA 'Cursor\User\globalStorage\anysphere.cursor-agent-worker\agent-cli\.local\share\cursor-agent\versions')
  )
  $hits = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $hits += Get-ChildItem -Path $root -Recurse -Filter 'better_sqlite3.node' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\better-sqlite3\\build\\Release\\better_sqlite3\.node$' }
  }
  if (-not $hits) { return $null }
  return $hits | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Get-SqliteVersion([string]$nodePath) {
  $pkg = Join-Path (Split-Path (Split-Path (Split-Path $nodePath))) 'package.json'
  if (Test-Path $pkg) {
    return (Get-Content $pkg -Raw | ConvertFrom-Json).version
  }
  return $null
}

$nodeFile = Find-AgentBetterSqlite
if (-not $nodeFile) {
  throw "better_sqlite3.node introuvable sous %LOCALAPPDATA%\cursor-agent. Installe d’abord le CLI (irm 'https://cursor.com/install?win32=true' | iex)."
}

$bsv = Get-SqliteVersion $nodeFile.FullName
if (-not $bsv) { $bsv = '12.12.0' }
Write-Output "Fichier : $($nodeFile.FullName)"
Write-Output "better-sqlite3 déclaré : $bsv"

Copy-Item $nodeFile.FullName "$($nodeFile.FullName).bak-abi127" -Force
Write-Output "Sauvegarde : $($nodeFile.FullName).bak-abi127"

$tmp = Join-Path $env:TEMP ("cursor-better-sqlite3-" + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$tar = Join-Path $tmp 'prebuild.tar.gz'

$candidates = @($bsv, '12.12.0', '12.11.1') | Select-Object -Unique
$downloaded = $false
foreach ($ver in $candidates) {
  $url = "https://github.com/WiseLibs/better-sqlite3/releases/download/v$ver/better-sqlite3-v$ver-node-v137-win32-x64.tar.gz"
  Write-Output "Téléchargement : $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $tar -UseBasicParsing
    $downloaded = $true
    Write-Output "OK version $ver"
    break
  } catch {
    Write-Output "Pas de prebuild v$ver ABI 137, essai suivant…"
  }
}
if (-not $downloaded) {
  throw "Impossible de télécharger un prebuild win32-x64 ABI 137 depuis GitHub."
}

tar -xzf $tar -C $tmp
$fresh = Get-ChildItem $tmp -Recurse -Filter 'better_sqlite3.node' | Select-Object -First 1
if (-not $fresh) { throw "L’archive n’a pas de better_sqlite3.node." }

Copy-Item $fresh.FullName $nodeFile.FullName -Force
Remove-Item $tmp -Recurse -Force
Write-Output "Remplacé par le binaire Node 24 (ABI 137)."
Write-Output ""
Write-Output "Relance dans cette fenêtre :"
Write-Output '  agent worker start --name "PC-PORTABLE"'
