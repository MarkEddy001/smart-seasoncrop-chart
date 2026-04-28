#!/usr/bin/env bash
# fresh-dev.sh — wipe caches, reinstall deps, start dev server, verify health.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▸ Clearing Vite / TanStack caches…"
rm -rf node_modules/.vite node_modules/.cache .tanstack dist .vite

echo "▸ Removing node_modules and lockfile for a clean install…"
rm -rf node_modules bun.lockb bun.lock

echo "▸ Installing dependencies with bun…"
bun install

LOG_FILE="$(mktemp -t fresh-dev-XXXXXX.log)"
echo "▸ Starting dev server (logs: $LOG_FILE)…"
bun run dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!

cleanup_on_fail() {
  echo "✗ Dev server failed to become healthy. Last 80 log lines:"
  tail -n 80 "$LOG_FILE" || true
  kill "$DEV_PID" 2>/dev/null || true
  exit 1
}

# Vite default port is 5173. Poll for up to ~30s.
URL="http://localhost:5173"
echo "▸ Waiting for $URL to respond…"
for i in $(seq 1 30); do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "✗ Dev server process exited early."
    cleanup_on_fail
  fi
  if curl -sf -o /dev/null "$URL"; then
    echo "✅ Dev server healthy at $URL (pid $DEV_PID)"
    echo "   Logs streaming to: $LOG_FILE"
    echo "   Stop with: kill $DEV_PID"
    exit 0
  fi
  sleep 1
done

cleanup_on_fail
