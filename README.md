# envctrl

Raspberry Pi 4 environment control platform built on Node 24 + ElysiaJS + React + Eden (end-to-end type safety).

## What it does

- **设备控制**: Modbus RTU/TCP, GPIO
- **环境监测**: 多传感器采集与时序入库
- **报警/联动**: 阈值规则 + 跨设备联动
- **Web 面板**: React + Eden Treaty，类型从后端单源推导
- **Pi 自管理**: 多串口编排、udev 规则、错误检测（通过 Python 特权 shim）

See full design: `docs/superpowers/specs/2026-06-28-envctrl-design.md`.

## Quick start

```bash
# install deps
bun install

# run dev (server only — frontend via Vite separately)
bun run dev

# run tests
bun test

# production build (server + web)
bun run build
node dist/index.js
```

## Layout

- `src/` — backend (Elysia + drivers + core + Pi agent)
- `web/` — frontend (React + Vite + Tailwind)
- `scripts/pi-shim/` — Python privilege shim (installed on Pi)
- `config/default.yaml` — runtime config
- `deploy/envctrl.service` — systemd unit

## Runtime

- Node.js 24 (Active LTS) — required for native modules (serialport, onoff, better-sqlite3)
- Bun — package manager and test runner only