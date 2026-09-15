@echo off
REM Lance depuis le dossier du projet (Windows).
cd /d "%~dp0\.."
where node >nul 2>&1
if %errorlevel%==0 (
  node scripts\probe-pc.mjs
  goto :eof
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0probe-pc.ps1"
