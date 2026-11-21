@echo off
cd /d "%~dp0"
node scripts\install-camera.mjs %*
if errorlevel 1 (echo Camera setup did not complete. Check your internet connection and retry. & pause & exit /b 1)
echo Camera ready. Open Start-Air-Strings.cmd to play.
pause

