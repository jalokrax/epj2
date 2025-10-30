@echo on
cd /d "%~dp0"

echo ===== EPJ START (simple) =====
echo Current folder: %CD%

rem Check Node and package.json
where node >nul 2>&1 || (echo ERROR: Node.js not in PATH & pause & exit /b 1)
if not exist package.json (echo ERROR: package.json not found & pause & exit /b 1)

rem Install deps if missing
if not exist node_modules (
  echo Installing dependencies...
  call npm install || (echo ERROR: npm install failed & pause & exit /b 1)
)

set "PORT=3000"
echo Starting server on http://localhost:%PORT%/
node server.js

echo.
echo Server stopped. Press any key to close...
pause
