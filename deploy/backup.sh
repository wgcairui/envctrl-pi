#!/usr/bin/env bash
# Hot-backup envctrl SQLite database + config.
#
# - SQLite is backed up via better-sqlite3's online .backup() so the
#   WAL is checkpointed and consistent.
# - Config is just cp'd (small, infrequent writes).
# - Retention: BACKUP_KEEP_DAYS (default 7) — older files are pruned.
#
# Runs as the `envctrl` user; the backup directory must be writable
# by that user (install.sh sets ownership).
#
# Env (optional):
#   BACKUP_DIR=/var/backups/envctrl
#   ENVCTRL_APP_DIR=/opt/envctrl
#   BACKUP_KEEP_DAYS=7

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/envctrl}"
APP_DIR="${ENVCTRL_APP_DIR:-/opt/envctrl}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_SRC="$APP_DIR/data/envctrl.db"
CFG_SRC="$APP_DIR/config/default.yaml"
DB_DST="$BACKUP_DIR/envctrl-$STAMP.db"
CFG_DST="$BACKUP_DIR/config-$STAMP.yaml"

echo "[backup] $(date -Iseconds) → $BACKUP_DIR"

# 1. SQLite online backup via the app's own runner. This checkpoints
#    the WAL and yields a single-file snapshot. We run a tiny Node
#    script inline rather than shell-out to sqlite3 (not always
#    installed on the Pi).
node --enable-source-map -e '
  const Database = require("better-sqlite3");
  const db = new Database(process.env.DB_SRC, { readonly: true });
  const out = process.env.DB_DST;
  db.backup(out);
  db.close();
  console.log("[backup] db → " + out);
' DB_SRC="$DB_SRC" DB_DST="$DB_DST"

# 2. Config copy
if [[ -f "$CFG_SRC" ]]; then
  install -m 0644 "$CFG_SRC" "$CFG_DST"
  echo "[backup] config → $CFG_DST"
fi

# 3. Retention — prune files older than KEEP_DAYS
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'envctrl-*.db' -o -name 'config-*.yaml' \) \
  -mtime "+$KEEP_DAYS" -delete -print | sed 's/^/[backup] prune /'

echo "[backup] done"