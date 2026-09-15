# Télécharge les modèles Ollama manquants de la flotte GPT-6-ASTRA 10.
# SUR LE PC seulement, Ollama ouvert. Ne pas lancer depuis le cloud.
#   npm run sync-models
# ou :
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-models.ps1

$ErrorActionPreference = 'Stop'
try {
  $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 4
} catch {
  Write-Error "Ollama n'est pas joignable. Démarre Ollama, puis relance."
  exit 1
}

$required = @(
  'qwen3:30b',
  'qwen2.5-coder:14b',
  'qwen2.5:14b',
  'qwen3:8b',
  'qwen2.5-coder:7b'
)
$have = @($tags.models | ForEach-Object { $_.name })
$missing = @()
foreach ($r in $required) {
  $ok = $false
  foreach ($h in $have) {
    if ($h -eq $r -or $h.StartsWith($r + '-') -or $h.StartsWith($r + '@')) { $ok = $true; break }
  }
  if (-not $ok) { $missing += $r }
}

if ($missing.Count -eq 0) {
  Write-Output 'Rien à télécharger — la flotte GPT-6-ASTRA 10 a déjà ses tags locaux.'
  exit 0
}

Write-Output ("À tirer : " + ($missing -join ', '))
foreach ($tag in $missing) {
  Write-Output ""
  Write-Output "→ ollama pull $tag"
  ollama pull $tag
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Output ""
Write-Output 'OK.'
