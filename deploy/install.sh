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

echo "==> Done. Tail logs with:  journalctl -u envctrl -f"