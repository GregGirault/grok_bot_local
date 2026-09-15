@echo off
REM Preserve SQLite + WIP commit. Run from anywhere; cwd becomes repo root.
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preserve-then-fuse.ps1"
exit /b %ERRORLEVEL%
