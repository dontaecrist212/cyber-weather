@echo off
title Cyber Weather
cd /d "%~dp0"
echo Starting Cyber Weather...
echo Keep this window open while you use the app. Close it to stop the app.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
echo.
echo Cyber Weather stopped. If you see an error above, make sure this file is in the cyber-weather folder next to server.js.
pause
