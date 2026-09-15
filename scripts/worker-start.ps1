# Cursor My Machines — démarre le worker sur CE PC (pas dans le cloud).
# Coller le bloc du README si tu n’as pas le clone. Sinon :
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\worker-start.ps1
#
# La fenêtre doit rester ouverte : le worker n’existe que tant que ce processus tourne.

$ErrorActionPreference = 'Stop'

function Refresh-AgentPath {
  $candidates = @(
    (Join-Path $HOME '.local\bin'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\bin'),
    (Join-Path $env:LOCALAPPDATA 'Programs\cursor'),
    (Join-Path $env:USERPROFILE '.cursor\bin')
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { $env:Path = "$p;$env:Path" }
  }
}

function Find-Repo {
  $here = Get-Location
  $pkg = Join-Path $here 'package.json'
  if (Test-Path $pkg) {
    $n = Get-Content $pkg -Raw
    if ($n -match 'grok-bot-local') { return $here.Path }
  }
  if ($PSScriptRoot) {
    $root = Split-Path -Parent $PSScriptRoot
    $pkg = Join-Path $root 'package.json'
    if (Test-Path $pkg) {
      $n = Get-Content $pkg -Raw
      if ($n -match 'grok-bot-local') { return $root }
    }
  }
  return $null
}

Refresh-AgentPath

if (-not (Get-Command agent -ErrorAction SilentlyContinue)) {
  Write-Output "Installation du Cursor CLI…"
  irm 'https://cursor.com/install?win32=true' | iex
  Refresh-AgentPath
}

if (-not (Get-Command agent -ErrorAction SilentlyContinue)) {
  Write-Error "La commande 'agent' est introuvable. Ferme PowerShell, rouvre-le, relance ce script."
  exit 1
}

Write-Output "CLI : $(agent --version)"
Write-Output "Machine : $env:COMPUTERNAME"

$repo = Find-Repo
$startArgs = @('worker', 'start', '--name', 'PC-PORTABLE')
if ($repo) {
  Write-Output "Repo : $repo"
  $startArgs += @('--worker-dir', $repo)
} else {
  Write-Output "Pas de clone grok-bot-local — worker sans --worker-dir."
}

Write-Output ""
Write-Output "Lancement : agent $($startArgs -join ' ')"
Write-Output "Laisse cette fenêtre ouverte. Dans Cursor Cloud, choisis ensuite la machine PC-PORTABLE."
Write-Output ""

& agent @startArgs
if ($LASTEXITCODE -ne 0) {
  Write-Output ""
  Write-Output "Échec du worker. Connexion Cursor (navigateur)…"
  & agent login
  & agent @startArgs
}
