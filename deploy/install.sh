#!/usr/bin/env bash
# Install envctrl on a Raspberry Pi OS (Bookworm) system.
# Idempotent. Run as root or via sudo.
set -euo pipefail

# 1. System packages
echo "==> Installing system packages"
apt-get update
apt-get install -y python3 pigpio python3-pip nodejs npm

# 2. Build envctrl (assumes you've cloned it into /opt/envctrl)
echo "==> Installing envctrl user"
id envctrl &>/dev/null || useradd -r -s /usr/sbin/nologin -G dialout,gpio envctrl

if [[ ! -d /opt/envctrl ]]; then
  echo "Expected /opt/envctrl (run after 'git clone <repo> /opt/envctrl && cd /opt/envctrl && bun install && bun run build')"
  exit 1
fi

# 3. Install the privilege shim
echo "==> Installing privilege shim"
SERVICE_USER=envctrl bash /opt/envctrl/scripts/pi-shim/setup.sh

# 4. systemd unit
echo "==> Installing systemd unit"
install -m 0644 /opt/envctrl/deploy/envctrl.service /etc/systemd/system/envctrl.service
systemctl daemon-reload
systemctl enable envctrl
systemctl restart envctrl

# 5. Backup + rotation tooling
echo "==> Installing backup + key-rotation scripts"
install -d -m 0750 -o envctrl -g envctrl /var/backups/envctrl
install -m 0750 /opt/envctrl/deploy/backup.sh            /usr/local/bin/envctrl-backup
install -m 0750 /opt/envctrl/deploy/restore.sh           /usr/local/bin/envctrl-restore
install -m 0750 /opt/envctrl/deploy/rotate-encryption-key.sh /usr/local/bin/envctrl-rotate-encryption-key
install -m 0644 /opt/envctrl/deploy/envctrl-backup.service /etc/systemd/system/envctrl-backup.service
install -m 0644 /opt/envctrl/deploy/envctrl-backup.timer   /etc/systemd/system/envctrl-backup.timer
systemctl daemon-reload
systemctl enable --now envctrl-backup.timer

echo "==> Done. Tail logs with:  journalctl -u envctrl -f"