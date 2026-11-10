@echo off
setlocal
cd /d "%~dp0"
title GoMingle launcher

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install the LTS from https://nodejs.org and run this again.
  pause
  exit /b 1
)

echo.
echo === GoMingle: installing dependencies (first run takes a few minutes) ===
if not exist "Backend\node_modules" (
  pushd Backend & call npm install --no-audit --no-fund || goto :fail
  popd
)
if not exist "Admin\node_modules" (
  pushd Admin & call npm ci --ignore-scripts --no-audit --no-fund || goto :fail
  popd
)
if not exist "Partner\node_modules" (
  pushd Partner & call npm ci --ignore-scripts --no-audit --no-fund || goto :fail
  popd
)

echo.
echo === Starting the GoMingle API on http://localhost:4000 ===
start "GoMingle API" cmd /k "cd /d %~dp0Backend && npm start"
timeout /t 4 >nul

echo === Starting the Admin Panel on http://localhost:5173 ===
start "GoMingle Admin Panel" cmd /k "cd /d %~dp0Admin && set VITE_MSW_ENABLED=false&& set VITE_API_BASE_URL=http://localhost:4000/admin&& set VITE_AUTH_MODE=api&& set VITE_SHOW_DEMO_CREDENTIALS=true&& npm run dev -- --port 5173 --strictPort"

echo === Starting the Partner Portal on http://localhost:5174 ===
start "GoMingle Partner Portal" cmd /k "cd /d %~dp0Partner && set VITE_ENABLE_MOCKS=false&& set VITE_API_BASE_URL=http://localhost:4000/partner&& set VITE_AUTH_MODE=api&& set VITE_SHOW_DEMO_CREDENTIALS=true&& npm run dev -- --port 5174 --strictPort"

timeout /t 12 >nul
start "" http://localhost:5173
start "" http://localhost:5174
echo.
echo Admin Panel    http://localhost:5173   admin@gomingle.com   / Admin@123
echo Partner Portal http://localhost:5174   partner@gomingle.com / Partner@123
echo Close the three server windows to stop GoMingle.
pause
exit /b 0

:fail
echo.
echo Installing dependencies failed. Check your internet connection and run this again.
pause
exit /b 1
