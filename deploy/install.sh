#!/usr/bin/env bash
# Install envctrl on a Raspberry Pi OS system (Bookworm / Trixie).
# Idempotent. Run as root (or via sudo).
#
# Assumes the project is already cloned and built at /opt/envctrl.
# Use scripts/deploy.sh from a dev machine to push source + build in one go.
set -euo pipefail

# 1. System packages
# - python3 + pip are required by the privilege shim (stdlib only).
# - nodejs is NOT installed from apt — we rely on a manually installed
#   /usr/local/bin/node (Node 22+ / 24+) to match package.json engines.
#   apt's `nodejs` is Node 20 (ABI 115) on Bookworm/Trixie, which is
#   incompatible with the prebuilt native modules (better-sqlite3, serialport,
#   onoff) shipped by npm — they'd fail at load with ERR_DLOPEN_FAILED.
echo "==> Installing system packages (python3 only — Node is not from apt)"
apt-get update
apt-get install -y python3 python3-pip

# pigpio is optional. The shim is pure stdlib (json / subprocess / dmesg /
# vcgencmd), and the Node GPIO driver (onoff) talks to /dev/gpiochip* via
# libgpiod — neither path needs pigpiod. We try to install it for backwards
# compat with any older / custom GPIO drivers, but skip silently if the
# package is unavailable (Trixie dropped it from the archive).
if apt-cache show pigpio >/dev/null 2>&1; then
  echo "==> Installing pigpio (optional, for legacy GPIO drivers)"
  apt-get install -y pigpio || echo "pigpio install failed (non-fatal, continuing)"
else
  echo "==> Skipping pigpio (not in repo — envctrl-shim and onoff don't need it)"
fi

# 2. envctrl user
# useradd's -G accepts comma-separated groups on modern shadow-utils.
echo "==> Creating envctrl user (if missing)"
id envctrl &>/dev/null || useradd -r -s /usr/sbin/nologin -G dialout,gpio envctrl

if [[ ! -d /opt/envctrl ]]; then
  echo "Expected /opt/envctrl to exist. Run scripts/deploy.sh from your dev machine first," >&2
  echo "or: git clone <repo> /opt/envctrl && cd /opt/envctrl && bun install && bun run build" >&2
  exit 1
fi

# 3. Install the privilege shim (sudoers rule, /usr/local/libexec/envctrl-shim)
echo "==> Installing privilege shim"
SERVICE_USER=envctrl bash /opt/envctrl/scripts/pi-shim/setup.sh

# 4. systemd unit
echo "==> Installing systemd unit"
install -m 0644 /opt/envctrl/deploy/envctrl.service /etc/systemd/system/envctrl.service
systemctl daemon-reload
systemctl enable envctrl
systemctl restart envctrl

# 5. Backup + key-rotation tooling
echo "==> Installing backup + key-rotation scripts"
install -d -m 0750 -o envctrl -g envctrl /var/backups/envctrl
install -m 0750 /opt/envctrl/deploy/backup.sh                       /usr/local/bin/envctrl-backup
install -m 0750 /opt/envctrl/deploy/restore.sh                      /usr/local/bin/envctrl-restore
install -m 0750 /opt/envctrl/deploy/rotate-encryption-key.sh       /usr/local/bin/envctrl-rotate-encryption-key
install -m 0644 /opt/envctrl/deploy/envctrl-backup.service          /etc/systemd/system/envctrl-backup.service
install -m 0644 /opt/envctrl/deploy/envctrl-backup.timer            /etc/systemd/system/envctrl-backup.timer
systemctl daemon-reload
systemctl enable --now envctrl-backup.timer

echo "==> Done. Tail logs with:  journalctl -u envctrl -f"
