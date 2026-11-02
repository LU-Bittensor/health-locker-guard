#!/usr/bin/env bash
# Run the current frontend source with real account/API access.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

command -v npm >/dev/null || { echo "Install Node.js and npm first." >&2; exit 1; }
if [ ! -x node_modules/.bin/vite ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

export VITE_GRANT_DEMO=false
echo "Starting the current MediLink frontend at http://127.0.0.1:5173"
echo "Keep the backend running in another terminal. Press Ctrl+C to stop the frontend."
# --force refreshes Vite's dependency cache; dev serves source, not an old build.
# Keep this origin consistent with the registered Epic callback URL.
exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --force
