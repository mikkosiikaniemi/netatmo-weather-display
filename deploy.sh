#!/usr/bin/env bash

set -euo pipefail

# Local-to-Opalstack deployment script.
#
# Usage:
#   OPALSTACK_SSH=user@host OPALSTACK_APP_ROOT=/home/user/apps/netatmo bash deploy.sh
#
# Optional:
#   OPALSTACK_PROJECT_DIR=/home/user/apps/netatmo/myproject
#   OPALSTACK_NODE_SCL=nodejs20
#   DEPLOY_ENV_FILE=.env.deploy

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/.env.deploy}"

if [ -f "$DEPLOY_ENV_FILE" ]; then
  echo "[deploy] Loading deploy variables from $DEPLOY_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

OPALSTACK_SSH="${OPALSTACK_SSH:-}"
OPALSTACK_APP_ROOT="${OPALSTACK_APP_ROOT:-}"
OPALSTACK_PROJECT_DIR="${OPALSTACK_PROJECT_DIR:-}"
OPALSTACK_NODE_SCL="${OPALSTACK_NODE_SCL:-nodejs20}"

if [ -z "$OPALSTACK_SSH" ] || [ -z "$OPALSTACK_APP_ROOT" ]; then
  cat <<'EOF'
Missing required environment variables.

Required:
  OPALSTACK_SSH       SSH target, for example user@example.opalstack.com
  OPALSTACK_APP_ROOT  Opalstack app root, for example /home/user/apps/netatmo

Optional:
  OPALSTACK_PROJECT_DIR  Remote project dir (default: <OPALSTACK_APP_ROOT>/<repo-folder>)
  OPALSTACK_NODE_SCL     Node SCL name to enable on Opalstack (default: nodejs20)
  DEPLOY_ENV_FILE        Path to env file to load first (default: .env.deploy in repo root)

Example:
  # Option 1: from local environment variables
  OPALSTACK_SSH=user@example.opalstack.com \
  OPALSTACK_APP_ROOT=/home/user/apps/netatmo \
  bash deploy.sh

  # Option 2: put values in .env.deploy and run
  bash deploy.sh
EOF
  exit 1
fi

PROJECT_NAME="$(basename "$SCRIPT_DIR")"

if [ -z "$OPALSTACK_PROJECT_DIR" ]; then
  OPALSTACK_PROJECT_DIR="$OPALSTACK_APP_ROOT/$PROJECT_NAME"
fi

echo "[deploy] Local project: $SCRIPT_DIR"
echo "[deploy] Remote SSH target: $OPALSTACK_SSH"
echo "[deploy] Remote app root: $OPALSTACK_APP_ROOT"
echo "[deploy] Remote project dir: $OPALSTACK_PROJECT_DIR"

for cmd in ssh rsync; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[deploy] Error: '$cmd' is required but not installed locally."
    exit 1
  fi
done

echo "[deploy] Ensuring remote project directory exists"
ssh "$OPALSTACK_SSH" "mkdir -p '$OPALSTACK_PROJECT_DIR'"

echo "[deploy] Syncing files to Opalstack"
rsync -az --delete \
  --filter='P backend/.env' \
  --exclude='.git/' \
  --exclude='.github/' \
  --exclude='.vscode/' \
  --exclude='node_modules/' \
  --exclude='backend/node_modules/' \
  --exclude='frontend/node_modules/' \
  --exclude='backend/.env' \
  --exclude='frontend/dist/' \
  --exclude='backend/dist/' \
  "$SCRIPT_DIR/" "$OPALSTACK_SSH:$OPALSTACK_PROJECT_DIR/"

echo "[deploy] Installing dependencies and building on Opalstack"
ssh "$OPALSTACK_SSH" \
  OPALSTACK_PROJECT_DIR="$OPALSTACK_PROJECT_DIR" \
  OPALSTACK_APP_ROOT="$OPALSTACK_APP_ROOT" \
  OPALSTACK_NODE_SCL="$OPALSTACK_NODE_SCL" \
  'bash -s' <<'EOF'
set -euo pipefail

if command -v scl_source >/dev/null 2>&1; then
  set +u
  if ! source scl_source enable "$OPALSTACK_NODE_SCL"; then
    echo "[deploy] Warning: failed to enable $OPALSTACK_NODE_SCL via scl_source; continuing with default Node"
  fi
  set -u
fi

cd "$OPALSTACK_PROJECT_DIR"

npm --prefix frontend ci
npm --prefix backend ci

npm --prefix frontend run build
npm --prefix backend run build

if [ -x "$OPALSTACK_APP_ROOT/stop" ] && [ -x "$OPALSTACK_APP_ROOT/start" ]; then
  "$OPALSTACK_APP_ROOT/stop" || true
  "$OPALSTACK_APP_ROOT/start"
else
  echo "[deploy] Warning: start/stop scripts not found in $OPALSTACK_APP_ROOT; restart manually"
fi
EOF

echo "[deploy] Deployment completed successfully"
