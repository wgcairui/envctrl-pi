# envctrl

Raspberry Pi 4 environment control platform built on Node 24 + ElysiaJS + React + Eden (end-to-end type safety).

## What it does

- **Device control**: Modbus RTU/TCP, GPIO digital in/out
- **Environmental monitoring**: multi-sensor sampling with SQLite time-series storage
- **Alarm/linking logic**: token-whitelist condition evaluator + cross-device actions
- **Web panel**: React + Eden Treaty (single-source-of-truth types from backend)
- **Pi self-management**: multi-UART device-tree overlays, udev rules, error detection — all routed through a small Python privilege shim (no root in the Node process)

See `docs/superpowers/specs/2026-06-28-envctrl-design.md` for the full design.

## Quick start (development)

```bash
# install deps
bun install

# run dev server only (uses tsx watch)
bun run dev

# run tests (vitest, uses Node 24 for native module loading)
bun run test

# run web dev server (Vite, separate terminal — proxies /api to :3000)
bun run dev:web
```

## Production build (single binary process)

```bash
bun run build       # builds web/dist via Vite, then compiles server to dist/
node dist/index.js  # serves API + static web on :3000
```

`src/api/server.ts` automatically serves `web/dist/` if present (via `@elysiajs/static` + SPA fallback).

## Layout

- `src/` — backend (Elysia + drivers + core + Pi agent)
- `web/` — frontend (React + Vite + Tailwind)
- `scripts/pi-shim/` — Python privilege shim (installed on Pi)
- `config/default.yaml` — runtime config
- `deploy/` — systemd unit + install script

## Runtime

- **Node.js 24** (Active LTS) — required for native modules (`serialport`, `onoff`, `better-sqlite3`)
- **Bun** — package manager and test runner

The test runner is **vitest** (not bun's built-in test runner) because Bun's runtime cannot yet load better-sqlite3 (oven-sh/bun#4290).

## Native module ABI trap

`better-sqlite3` and `epoll` (onoff's dep) are N-API native addons. They are **compiled against the Node version that ran `bun install`**. If you switch Node major versions (24 → 26), you get `NODE_MODULE_VERSION mismatch` errors. The project has `scripts/check-native-abi.mjs` running as `postinstall` to detect this and print the fix:

```bash
npm rebuild better-sqlite3
npm rebuild epoll      # only if onoff stopped working
```

DO NOT pin `engines.node` to a single version — the project supports Node 24+.

## Deploy to Raspberry Pi 4

```bash
# On the Pi (Bookworm 64-bit):
git clone <repo> /opt/envctrl
cd /opt/envctrl
bun install
bun run build
sudo bash deploy/install.sh

# Tail logs:
sudo journalctl -u envctrl -f

# Open UI:
# http://<pi-hostname>.local:3000
```

`deploy/install.sh` will:
1. apt-install python3 + pigpio
2. Create `envctrl` user (member of `dialout` + `gpio`)
3. Install the privilege shim at `/usr/local/libexec/envctrl-shim` and the sudoers rule
4. Install + start `envctrl.service` via systemd

## Pi Agent capabilities (Web → /api/pi/*)

**System introspection:**
- `GET /api/pi/info` — model, CPU temp, volts, uptime, load, memory, disk
- `GET /api/pi/overlays` — current dtoverlay list with GPIO mapping
- `GET /api/pi/devices` — `/dev/tty*`, `/dev/gpiochip*`
- `GET /api/pi/logs` — journalctl tail for envctrl

**Configuration:**
- `POST /api/pi/config` — plan / apply dtoverlay changes (dryRun by default; writes `/boot/firmware/config.txt` with timestamped backup; refuses unknown overlays; rejects GPIO conflicts)
- `POST /api/pi/udev` — install / reload udev rules

**LLM integration (`/api/pi/agent/*`):**
- `GET /api/pi/agent/status` — LLM configured?
- `POST /api/pi/agent/chat` — L1 single-shot natural-language → tool call → reply
- `POST /api/pi/agent/diagnose` — L2 read-only multi-turn investigation
- `POST /api/pi/agent/react` — L3 autonomous loop (SSE stream)
- `POST /api/pi/agent/confirm` — execute a high-risk tool the LLM requested
- `GET /api/pi/agent/audit` — recent `llm-*` audit entries

All root operations go through `/usr/local/libexec/envctrl-shim` which:
- Refuses to execute unless invoked via sudo (EUID 0)
- Has a strict whitelist of 11 subcommands
- Does not parse `argv` shell-style — uses JSON-RPC over stdio

## LLM agent (optional)

The Pi Agent supports an optional LLM layer (L1 chat / L2 diagnose / L3 ReAct) using `@anthropic-ai/sdk`. minimax works as a drop-in via `ANTHROPIC_BASE_URL`. To enable:

```bash
# Option A: Anthropic direct
export ANTHROPIC_API_KEY=sk-ant-...

# Option B: minimax
export ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
export ANTHROPIC_API_KEY=${YOUR_MINIMAX_KEY}
export ENVCTRL_LLM_MODEL=MiniMax-M2.7-highspeed

# Restart envctrl
sudo systemctl restart envctrl
```

Open the **pi-agent** tab in the web UI. The status indicator (● / ○) shows whether the LLM is configured. All LLM-initiated actions are recorded in the `audit` table with `actor='llm'`.

**Provider management (cc-switch style):** the **config** tab lists all stored providers. 3 built-in presets (minimax, DeepSeek, Anthropic) are seeded on first boot. Pick one, fill in the apiKey, hit Test, then Activate. Active provider can be switched hot — no restart.

**Safety**: high-risk actions (config apply, udev install, systemctl restart, reboot) require explicit user confirmation via an amber dialog in the web UI. Low-risk actions (toggling a relay/GPIO) auto-execute.

## Encryption at rest (LLM apiKeys)

Provider `apiKey` values are stored encrypted in the `llm_provider` table using **AES-256-GCM** (authenticated encryption with associated data). The key is read from `ENVCTRL_ENCRYPTION_KEY`:

```bash
# Generate a key once
openssl rand -hex 32
# e.g. a1b2c3d4e5f6... (64 hex chars = 32 bytes)

# Persist it
echo "ENVCTRL_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> /etc/envctrl/env
sudo systemctl restart envctrl
```

Accepted formats: 64 hex chars, 32 raw bytes, or any string (hashed via SHA-256 to 32 bytes — deterministic, less secure).

**Dev fallback**: if `ENVCTRL_ENCRYPTION_KEY` is unset, envctrl derives a deterministic key from the hostname and emits a one-time console warning. **Do not use in production.** Existing plaintext keys (from older versions) are automatically re-encrypted on the next save.

**Key rotation**: changing the key invalidates all existing encrypted keys. To migrate, either re-enter keys in the ConfigPage after the rotation, or run a small migration script (not provided — open an issue if needed).

## Security notes

- Alarm conditions are evaluated by a hand-rolled token-whitelist parser (no `eval`, no JS execution). Allowed tokens: numbers, single/double-quoted strings, `value`, `true`, `false`, comparison operators, `&&` `||` `!` and parentheses.
- The Elysia process runs as a non-root user; root is only acquired transiently via the privilege shim for specific allowlisted subcommands.
- `serialport` opens each `/dev/tty*` with `lock: true` (Linux flock), preventing collisions with other processes.

## License

Internal project.