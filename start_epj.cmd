@echo on
cd /d "%~dp0"

echo ===== EPJ START SCRIPT =====
echo Current folder: %CD%

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found in PATH. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

:: Check npm and package.json
if not exist package.json (
  echo ERROR: package.json not found in %CD%
  pause
  exit /b 1
)

:: Install dependencies if missing
if not exist node_modules (
  echo Installing dependencies... this may take a moment.
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

set "PORT=3000"
echo Starting EPJ on port %PORT%...
start "" "http://localhost:%PORT%/"
node server.js

echo.
echo Server stopped or closed. Press any key to exit...
pause
