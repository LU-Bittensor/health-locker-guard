#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
npm install
export VITE_GRANT_DEMO=false
exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
