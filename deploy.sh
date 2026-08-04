#!/bin/bash

set -euo pipefail

# Deploy helper for Opalstack-style app layout:
# app root: ~/apps/<appname>
# repo dir: ~/apps/<appname>/myproject

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

echo "[deploy] Project directory: $SCRIPT_DIR"
echo "[deploy] App root: $APP_ROOT"

if command -v scl_source >/dev/null 2>&1; then
  # Opalstack commonly provides Node via software collections.
  source scl_source enable nodejs20
fi

cd "$SCRIPT_DIR"

echo "[deploy] Pulling latest changes"
git pull --ff-only

echo "[deploy] Installing dependencies"
npm run install:all

echo "[deploy] Building project"
npm run build

if [ -x "$APP_ROOT/stop" ] && [ -x "$APP_ROOT/start" ]; then
  echo "[deploy] Restarting app"
  "$APP_ROOT/stop" || true
  "$APP_ROOT/start"
else
  echo "[deploy] Start/stop scripts not found in app root. Restart manually."
fi

echo "[deploy] Done"
