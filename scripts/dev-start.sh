#!/usr/bin/env bash
#
# Per-boot startup for the local Workout Web dev stack.
#
# The committed .cursor/environment.json runs the emulators / api / vite as
# named `terminals` (best for repo-file-managed environments: visible logs,
# individually restartable). This script is the equivalent `start` command for
# DB-managed environments, where `terminals` are not available. It launches the
# same three services in the background, is idempotent (won't start a service
# that is already up), waits for the emulators to be ready, then returns.
set -euo pipefail

cd "$(dirname "$0")/.."

LOG_DIR="/tmp/workout-web"
mkdir -p "$LOG_DIR"

# A service is "up" if the port answers at all (any HTTP status counts;
# only a refused/failed connection is treated as down).
up() { curl -s -o /dev/null "$1" 2>/dev/null; }

# Firebase Auth + Firestore emulators (Emulator UI on :4000).
if up http://127.0.0.1:4000/; then
  echo "dev-start: emulators already running"
else
  echo "dev-start: starting emulators..."
  nohup npm run emulators >"$LOG_DIR/emulators.log" 2>&1 &
fi

# Wait for the Auth emulator so the API has something to talk to.
for _ in $(seq 1 90); do
  if up http://127.0.0.1:9099/; then break; fi
  sleep 1
done
up http://127.0.0.1:9099/ && echo "dev-start: auth emulator ready" || echo "dev-start: WARN auth emulator not ready yet"

# Local auth API (/api/*) on :3000. It waits for the emulators internally.
if up http://127.0.0.1:3000/api/login; then
  echo "dev-start: api already running"
else
  echo "dev-start: starting api..."
  nohup npm run dev:api >"$LOG_DIR/api.log" 2>&1 &
fi

# Vite dev server on :5173.
if up http://127.0.0.1:5173/; then
  echo "dev-start: vite already running"
else
  echo "dev-start: starting vite..."
  nohup npm run dev -- --host >"$LOG_DIR/vite.log" 2>&1 &
fi

echo "dev-start: done (logs in $LOG_DIR)"
