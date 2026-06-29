#!/usr/bin/env bash
# Re-encrypt every llm_provider.api_key with a new ENVCTRL_ENCRYPTION_KEY.
#
# Usage (run as the envctrl user or with sudo -E so the existing
# ENVCTRL_ENCRYPTION_KEY is preserved):
#
#   sudo -E /usr/local/bin/envctrl-rotate-encryption-key.sh
#
# The script will:
#   1. Source /etc/envctrl/env to load ENVCTRL_ENCRYPTION_KEY (the OLD key).
#   2. Prompt for a new key (or read ENVCTRL_NEW_KEY from env).
#   3. Run scripts/rotateKey.ts with both keys set.
#   4. Show a summary. On success, print the exact /etc/envctrl/env line
#      to swap to (the operator updates the file, then restarts the service).
#
# The Node step writes audit rows (key.rotation.start / .completed /
# .failed) and runs in a transaction — any failure rolls back.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/envctrl/env}"
APP_DIR="${APP_DIR:-/opt/envctrl}"

if [[ -r "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

if [[ -z "${ENVCTRL_ENCRYPTION_KEY:-}" ]]; then
  echo "ERROR: ENVCTRL_ENCRYPTION_KEY not set (source $ENV_FILE first)" >&2
  exit 1
fi

OLD_KEY="$ENVCTRL_ENCRYPTION_KEY"

if [[ -z "${ENVCTRL_NEW_KEY:-}" ]]; then
  echo "Generate a new key with:  openssl rand -hex 32"
  read -r -s -p "New ENVCTRL_ENCRYPTION_KEY (64 hex chars recommended): " NEW_KEY
  echo
  if [[ -z "$NEW_KEY" ]]; then
    echo "ERROR: empty key, aborting" >&2
    exit 1
  fi
else
  NEW_KEY="$ENVCTRL_NEW_KEY"
fi

if [[ "$OLD_KEY" == "$NEW_KEY" ]]; then
  echo "ERROR: OLD and NEW keys are identical — nothing to rotate" >&2
  exit 1
fi

echo "==> Rotating ENVCTRL_ENCRYPTION_KEY"
echo "    app dir:    $APP_DIR"
echo "    old key:    ${OLD_KEY:0:6}...${OLD_KEY: -4} (length ${#OLD_KEY})"
echo "    new key:    ${NEW_KEY:0:6}...${NEW_KEY: -4} (length ${#NEW_KEY})"
echo

# cd to the app dir so config/default.yaml paths resolve as expected
cd "$APP_DIR"

ENVCTRL_OLD_KEY="$OLD_KEY" \
  ENVCTRL_NEW_KEY="$NEW_KEY" \
  node --enable-source-map /opt/envctrl/dist/scripts/rotateKey.js

echo
echo "==> Update /etc/envctrl/env so the line:"
echo "    ENVCTRL_ENCRYPTION_KEY=$OLD_KEY"
echo "becomes:"
echo "    ENVCTRL_ENCRYPTION_KEY=$NEW_KEY"
echo
echo "Then: sudo systemctl restart envctrl"