#!/usr/bin/env bash
# GoMingle launcher for macOS / Linux. Starts the API and both portals.
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }

[ -d Backend/node_modules ] || (cd Backend && npm install --no-audit --no-fund)
[ -d Admin/node_modules ] || (cd Admin && npm ci --ignore-scripts --no-audit --no-fund)
[ -d Partner/node_modules ] || (cd Partner && npm ci --ignore-scripts --no-audit --no-fund)

trap 'kill 0' EXIT
(cd Backend && npm start) &
sleep 3
(cd Admin && VITE_MSW_ENABLED=false VITE_API_BASE_URL=http://localhost:4000/admin \
  VITE_AUTH_MODE=api VITE_SHOW_DEMO_CREDENTIALS=true npm run dev -- --port 5173 --strictPort) &
(cd Partner && VITE_ENABLE_MOCKS=false VITE_API_BASE_URL=http://localhost:4000/partner \
  VITE_AUTH_MODE=api VITE_SHOW_DEMO_CREDENTIALS=true npm run dev -- --port 5174 --strictPort) &

echo
echo "Admin Panel    http://localhost:5173   admin@gomingle.com   / Admin@123"
echo "Partner Portal http://localhost:5174   partner@gomingle.com / Partner@123"
echo "Press Ctrl+C to stop."
wait
