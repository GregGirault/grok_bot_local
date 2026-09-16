# Delegue vers scripts\update-latest.ps1 (overlay court, sans merge).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$next = Join-Path $here 'update-latest.ps1'
if (-not (Test-Path $next)) {
  Write-Output 'scripts\update-latest.ps1 introuvable'
  exit 1
}
& $next
