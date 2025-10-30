@echo off
cd /d "%~dp0"

rem install deps if missing
if not exist node_modules (
  echo Installing dependencies (npm install)...
  call npm install || goto :err
)

set "PORT=3000"
start "" "http://localhost:%PORT%/"
echo Starting EPJ on http://localhost:%PORT%/
node server.js
goto :eof

:err
echo [ERROR] npm install failed. Check Node.js and internet connection.
pause
