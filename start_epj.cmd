@echo off
cd /d "%~dp0"
set "PORT=3000"
start "" "http://localhost:%PORT%/"
node server.js
pause
