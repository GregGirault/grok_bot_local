# Grok Bot — sonde du PC (Windows PowerShell)
# Ce fichier n’existe que dans le dossier du projet (…\scripts\probe-pc.ps1).
# Si tu es dans C:\Users\…, le chemin .\scripts\probe-pc.ps1 n’existe pas :
# colle le bloc PowerShell du README, ou :
#   npm run probe-pc
# depuis la racine du projet.

$ErrorActionPreference = 'Stop'
if ($PSScriptRoot) {
  Set-Location (Split-Path -Parent $PSScriptRoot)
}
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, TotalVisibleMemorySize
$gpu = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace

$payload = [pscustomobject]@{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  source     = 'script'
  hostname   = $env:COMPUTERNAME
  os         = $os.Caption
  osVersion  = $os.Version
  cpu        = $cpu.Name
  cores      = $cpu.NumberOfCores
  threads    = $cpu.NumberOfLogicalProcessors
  cpuMhz     = $cpu.MaxClockSpeed
  ramGb      = [math]::Round(($os.TotalVisibleMemorySize / 1MB), 1)
  gpu        = $gpu
  diskCGb    = if ($disk.Size) { [math]::Round(($disk.Size / 1GB), 1) } else { $null }
  diskCFreeGb= if ($disk.FreeSpace) { [math]::Round(($disk.FreeSpace / 1GB), 1) } else { $null }
}

$json = $payload | ConvertTo-Json -Depth 4
$out = Join-Path (Get-Location) 'grok-bot-pc.json'
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Output $json
Write-Output ""
Write-Output "Fichier écrit : $out"
