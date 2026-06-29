#!/usr/bin/env bash
# Restore envctrl from a backup file. Stops the service, replaces the
# database and config, restarts the service.
#
# Usage:
#   sudo /usr/local/bin/envctrl-restore.sh /var/backups/envctrl/envctrl-20260101T030000Z.db
#
# Optional 2nd arg: a config backup file to also restore.
#   sudo /usr/local/bin/envctrl-restore.sh /var/backups/envctrl/envctrl-...db \
#        /var/backups/envctrl/config-20260101T030000Z.yaml

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.db> [<config.yaml>]" >&2
  exit 1
fi

DB_BACKUP="$1"
CFG_BACKUP="${2:-}"
APP_DIR="${ENVCTRL_APP_DIR:-/opt/envctrl}"
DB_TARGET="$APP_DIR/data/envctrl.db"
CFG_TARGET="$APP_DIR/config/default.yaml"

if [[ ! -f "$DB_BACKUP" ]]; then
  echo "ERROR: backup file not found: $DB_BACKUP" >&2
  exit 1
fi

echo "==> Restore target"
echo "    db backup:     $DB_BACKUP"
echo "    db target:     $DB_TARGET"
[[ -n "$CFG_BACKUP" ]] && echo "    cfg backup:    $CFG_BACKUP" && echo "    cfg target:    $CFG_TARGET"

read -r -p "Type 'yes' to continue: " confirm
[[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }

echo "==> Stopping envctrl.service"
systemctl stop envctrl || true

# Move current out of the way rather than overwrite — safer if you
# need to roll back manually.
if [[ -f "$DB_TARGET" ]]; then
  mv "$DB_TARGET" "${DB_TARGET}.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
fi
install -m 0644 "$DB_BACKUP" "$DB_TARGET"

if [[ -n "$CFG_BACKUP" && -f "$CFG_BACKUP" ]]; then
  if [[ -f "$CFG_TARGET" ]]; then
    mv "$CFG_TARGET" "${CFG_TARGET}.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  install -m 0644 "$CFG_BACKUP" "$CFG_TARGET"
fi

echo "==> Starting envctrl.service"
systemctl start envctrl
systemctl status envctrl --no-pager || true