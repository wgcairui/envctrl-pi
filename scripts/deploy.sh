#!/usr/bin/env bash
# scripts/deploy.sh — push envctrl source to a Pi and (re)install the service.
# Run from the repo root on your dev machine.
#
# Usage: scripts/deploy.sh [user@host]
#   default: envctrl@envctrl-pi.local
#
# What it does:
#   1. rsync source to <host>:/opt/envctrl (no node_modules, no dist, no tests)
#   2. SSH in: bun install (prod) + bun run build
#      — native modules (better-sqlite3, serialport, onoff) MUST be built on
#        the target arch; we never sync a foreign node_modules.
#      — falls back to npm ci --omit=dev if bun is not on PATH.
#   3. SSH in: sudo deploy/install.sh  (systemd unit, shim, backup timer)
#
# Requirements on the host:
#   - The user (default: envctrl) has passwordless sudo.
#   - /opt/envctrl exists and is writable by that user. install.sh creates
#     the dir + envctrl user on first run; on subsequent runs the envctrl
#     user is the natural owner.
#   - /usr/local/bin/node is a Node 22+ (Node 24 recommended) install.
#     apt's nodejs is Node 20 (ABI 115) — incompatible with the prebuilt
#     native modules. Install via nvm / n / official tarball.
#   - Either `bun` or `npm` is on PATH.
set -euo pipefail

HOST="${1:-envctrl@envctrl-pi.local}"
REMOTE_DIR="/opt/envctrl"
SERVICE_NAME="envctrl"

# What we never want on the Pi
RSYNC_EXCLUDES=(
  --exclude='.git'
  --exclude='.harness'
  --exclude='.github'
  --exclude='.DS_Store'
  --exclude='node_modules'
  --exclude='web/node_modules'
  --exclude='dist'
  --exclude='web/dist'
  --exclude='data'
  --exclude='tests'
  --exclude='workspace'
  --exclude='*.test.ts'
  --exclude='*.test.tsx'
  --exclude='*.spec.ts'
  --exclude='tsconfig.json'
  --exclude='tsconfig.*.json'
  --exclude='vitest.config.ts'
  --exclude='web/vitest.config.ts'
  --exclude='.prettierrc*'
  --exclude='.eslintrc*'
)

echo "==> [1/3] Syncing source to $HOST:$REMOTE_DIR"
rsync -az --delete "${RSYNC_EXCLUDES[@]}" ./ "$HOST:$REMOTE_DIR/"

echo "==> [2/3] Installing prod deps + building on $HOST"
ssh "$HOST" "set -euo pipefail; cd $REMOTE_DIR && \
  if command -v bun >/dev/null 2>&1; then \
    bun install --frozen-lockfile && bun run build; \
  else \
    echo '   bun not found, falling back to npm'; \
    npm ci --omit=dev --no-audit --no-fund && npm run build; \
  fi"

echo "==> [3/3] Running deploy/install.sh on $HOST"
ssh "$HOST" "sudo bash $REMOTE_DIR/deploy/install.sh"

echo
echo "==> Done. Verify with:"
echo "    ssh $HOST 'systemctl status $SERVICE_NAME && journalctl -u $SERVICE_NAME -n 20 --no-pager'"
