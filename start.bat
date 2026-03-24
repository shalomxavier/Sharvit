@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0

echo Starting Firebase Functions emulator...
start "Firebase Functions" cmd /k "cd /d %ROOT%functions && npm run serve"

echo Starting frontend app...
start "Crypto Frontend" cmd /k "cd /d %ROOT%frontend && npm start"

echo.
echo Firebase Functions emulator and frontend are launching in separate terminals.
echo Press any key to exit this launcher.
pause >nul
endlocal
