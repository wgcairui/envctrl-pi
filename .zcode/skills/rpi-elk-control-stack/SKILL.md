---
name: rpi-elk-control-stack
description: Use when working on the envctrl project — a Raspberry Pi 4 environment-control platform with ElysiaJS backend, React + Eden (end-to-end type safety) frontend, multi-serial/Modbus RTU/Modbus TCP/GPIO, and on-device Pi system configuration via a Python privilege shim. Triggers on envctrl-specific tasks like "add a new driver kind", "fix a serial port", "add a Pi Agent endpoint", "deploy to Pi", "the data engine is not sampling", "GPIO interrupt not firing", "Modbus CRC error", "alarm not triggering", "Eden type missing in web", "config.txt overlay", or any change to /Users/cairui/ZCodeProject/envctrl/{src,web,scripts/pi-shim,config,deploy,docs}. Also triggers for new Pi control/SCADA projects considering this stack.
---

# envctrl (Raspberry Pi Elysia + Linux-Kernel Control Stack)

This skill is **specific to the `envctrl` project** in `/Users/cairui/ZCodeProject/envctrl/`. It captures architecture, dependency choices, real traps, and the patterns every change to the project should follow.

If you're starting a NEW project that isn't envctrl, see `rpi-elk-control-stack` at the user level — but you should still consider the envctrl patterns below as a reference implementation.

## When to use

- Any modification to envctrl: new driver, new route, new alarm rule kind, new Pi Agent endpoint, schema change
- Debugging runtime issues: serial port open failures, GPIO not firing, Modbus errors, alarm not triggering, SSE not delivering
- Adding new device types or extending the abstraction
- Deploying to / debugging on the real Pi 4

**Skip for:** unrelated projects, generic Elysia questions, cloud-only IoT.

## Core architecture (one-glance reminder)

```text
Web (React + Eden Treaty + TanStack Query)
   │ HTTP / SSE
Elysia API (src/api/server.ts → type App)
   │
Core (EventBus singleton, process-wide)
   │ DeviceRegistry → Drivers (config-driven factory)
   │ DataEngine (poll loop, inserts samples)
   │ AlarmEngine (token-whitelist predicate, runs actions)
   │ PiAgent → broker → Python shim (root, 11 whitelisted subs)
   │
IOBus (Serial / Gpio / Tcp)  +  SQLite (WAL)  +  PiBroker
```

## Stack lock-in (DO NOT change without strong reason)

| Concern | Pinned | Why |
|---|---|---|
| Runtime | Node 24+ (currently 26.3.1) | Native modules need Node ABI to match what was used at install time |
| HTTP | Elysia v1.x + `@elysiajs/node` | Default adapter is WebStandard; node adapter must be explicit |
| RPC | `@elysiajs/eden` Treaty | End-to-end types from `src/api/server.ts` |
| Frontend | React 18 + Vite + TanStack Query + Tailwind | Vite alias `@backend` → `../src` for type sharing |
| Serial | `serialport` v13 + parsers | v13 API: `new SerialPort(opts)` + `port.open(cb)`; `lock: true` always |
| Modbus | `modbus-serial` v8 | |
| GPIO | `onoff` v6 | Linux-only; dynamic import + stub on macOS |
| SQLite | `better-sqlite3` v12 | |
| Tests | **vitest** (NOT `bun test`) | Bun runtime cannot load `better-sqlite3` (oven-sh/bun#4290) |
| Pkg manager | bun (`bun install`) | Runtime is still Node |
| Privileged ops | Python shim + sudoers | Never run Elysia as root |

## Multi-UART on Pi 4 (no extra hardware)

```text
dtoverlay=uart0 → /dev/ttyAMA0 → GPIO14/15
dtoverlay=uart2 → /dev/ttyAMA1 → GPIO0/1
dtoverlay=uart3 → /dev/ttyAMA2 → GPIO4/5
dtoverlay=uart4 → /dev/ttyAMA3 → GPIO8/9
dtoverlay=uart5 → /dev/ttyAMA4 → GPIO12/13
```

Edit `/boot/firmware/config.txt` (Bookworm path), reboot. `occupiedGpio()` + `conflictsWith()` helpers in `src/pi/configOps.ts` detect GPIO collisions.

## Privilege isolation (CRITICAL — do not bypass)

**Never run Elysia as root.** The Node process spawns `sudo /usr/local/libexec/envctrl-shim` (Python, line-delimited JSON, EUID check, 11 whitelisted subs). Sudoers rule installed by `scripts/pi-shim/setup.sh`. Any new privileged operation MUST:

1. Add a new sub to `WHITELIST` in `envctrl_shim.py`
2. Implement it as a Python function (no shell, no `os.system`, no `subprocess` with `shell=True` and untrusted input)
3. Add a `register("new-sub")` decorator entry
4. If the sub accepts paths/args, validate them strictly (whitelist, regex, length cap)
5. Re-run `scripts/pi-shim/setup.sh` on Pi to refresh the sudoers rule (currently it doesn't need to — the sudoers rule covers the shim binary which doesn't change; only the shim code needs re-install)
6. Add a JS wrapper in `src/pi/agent.ts` or a new route
7. Test on the Pi, not just macOS

## LLM Agent (L1/L2/L3)

`src/pi/llmClient.ts` + `src/pi/tools.ts` + `src/pi/agents/{chat,diagnose,react}Agent.ts` give the Pi Agent three layers of LLM-mediated interaction. All three use the same tool registry and audit pipeline.

**LLM provider:** Anthropic SDK with `ANTHROPIC_BASE_URL` env override, so **minimax works as a drop-in** by setting `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic` and `ENVCTRL_LLM_MODEL=MiniMax-M2.7-highspeed`. Default model: `claude-haiku-4-5`. Audit: every request/response/tool-call is recorded in the `audit` table with `actor='llm'`.

**Tool catalog (15 total, all routed through PiBroker → shim, no new root paths):**
- 10 **read-only**: `pi_list_serial`, `pi_list_gpiochip`, `pi_read_config`, `pi_dmesg_tail`, `pi_journal_tail`, `pi_vcgencmd`, `pi_config_plan` (dry-run), `pi_read_recent_samples`, `pi_read_recent_alarms`, `device_read`
- 1 **low-risk-write** (auto-execute): `device_control` (toggle a relay/GPIO output)
- 4 **high-risk-write** (require user confirm): `pi_config_apply`, `pi_udev_install`, `pi_service_action` (start/stop/restart), `pi_reboot`

**Safety invariants:**
- No system call bypasses `PiBroker` → shim — the LLM has no way to exec arbitrary commands.
- High-risk tools never auto-execute; the route layers them as `confirm_request` SSE events, the web renders an amber alert with Confirm/Deny buttons, and a separate `POST /api/pi/agent/confirm` runs the actual tool.
- Confirmation timeout (default 60s) auto-aborts with a denial.
- ReAct agents are bounded by `maxSteps` (default 10).
- Every action is recorded in the `audit` table regardless of outcome.

**ReAct ordering gotcha:** `this.pending.set(id, resolve)` must run **before** the `confirm_request` yield so a synchronous `resolveConfirmation()` call from the consumer finds the entry. Don't swap these.

**Web UI:** new `pi-agent` tab (`web/src/pages/PiAgentPage.tsx`) with chat/diagnose mode toggle, real-time LLM status indicator (● ready / ○ not configured), collapsible tool-call details with risk badges, amber confirmation dialogs for high-risk actions, and a live audit log on the right (5s refresh).

**Routes:**
- `GET  /api/pi/agent/status` — LLM configured?
- `POST /api/pi/agent/chat` — L1
- `POST /api/pi/agent/diagnose` — L2
- `POST /api/pi/agent/react` — L3 (SSE stream)
- `POST /api/pi/agent/confirm` — execute high-risk tool
- `GET  /api/pi/agent/audit` — last N llm-* audit entries

## Alarm conditions — NEVER eval

`src/core/conditionParser.ts` is a hand-rolled token-whitelist parser. Allowed tokens: numbers, single/double-quoted strings, identifiers `value`/`true`/`false`, comparators `> < >= <= == === != !==`, `!`, `&&`, `||`, parentheses. Reject everything else at compile time. **Never use `eval`, `new Function`, or `vm`** even with a sandbox — alarm configs come from user-editable YAML.

## Driver pattern

Every device is a `Driver` instance created by `createDriver(config, buses)` in `src/drivers/driver.ts`. The DataEngine doesn't know about hardware — it just calls `driver.readPoints()` on a poll interval. To add a new kind:

1. Create `src/drivers/<kind>.ts` exporting a class that implements the `Driver` interface
2. Add the kind to the `DeviceKind` union in `src/shared/types.ts`
3. Add the case to `createDriver()` switch
4. Update the Zod schema in `src/config/loader.ts` (`ConfigSchema.shape.devices` enum)
5. Add an example to `config/default.yaml`
6. Test in `tests/drivers/`

## End-to-end types

```ts
// src/api/server.ts
export const app = new Elysia({ adapter: node() })
  .use(devicesRoutes(/* deps */))
  // ...
export type App = typeof app
```

```ts
// web/src/api.ts
import { treaty } from '@elysiajs/eden'
import type { App } from '../../../src/api/server.js'
export const api = treaty<App>(window.location.origin)
```

If a new route isn't appearing in the web, you almost certainly forgot to `.use(...)` it in `buildApp()`, or forgot to `export` the App type.

## Native module rebuild reality

`better-sqlite3` and `epoll` (onoff's dep) are N-API native addons. They are compiled against the Node version that was active when `npm install` (or `bun install`) was last run. If you switch Node major versions (22 → 24 → 26), you'll get `NODE_MODULE_VERSION mismatch`. The project has TWO guards:

1. **`scripts/check-native-abi.mjs`** runs as `postinstall` after `bun install` / `npm install`. It tries to require native modules and prints the fix if it can't.
2. **`scripts/predev-check.mjs`** runs at the start of `bun run dev`. If a mismatch is detected it exits with code 1 BEFORE tsx watch boots, so you see a clear error instead of a stack trace 5 seconds later.

**Strong recommendation: keep only ONE Node installation.** Mixing nvm + homebrew is the most common source of these errors. The author of this project removed nvm and now uses only the homebrew Node (`brew install node`).

**WARNING: `brew uninstall nvm` will cascade-uninstall homebrew Node** because nvm's shell script depends on it. If you have both, uninstall nvm FIRST, then `brew install node` to put it back. (Verified in commit history.)

**Critical gotcha:** if the user has multiple Node installations, the `postinstall` ABI check runs under whatever Node invoked the install, but `bun run dev` may run under a different one (PATH ordering). Always do:

```bash
# Use the SAME node for rebuild that you use for dev
node -v
npm rebuild better-sqlite3
bun run dev
```

If `bun run dev` says "command not found: bun", check `echo $PATH` — Bun must be on PATH before the shell can find it. Recommend adding `export PATH="$HOME/.bun/bin:$PATH"` to `~/.zshrc`.

**`engines.node` is `>=22 <27`** to support Node 22 LTS, 24 LTS, and 26 (current Active). Do not pin to a single version.

## Common traps (real bugs from envctrl)

| Symptom | Cause | Fix |
|---|---|---|
| `app.listen()` returns but no port binds | Default adapter is WebStandard | `new Elysia({ adapter: node() })` |
| `new SerialPort(opts, cb)` never calls cb | serialport v13 removed constructor callback | `new SerialPort(opts)` + `port.open(cb)` |
| `bun test` cannot load `better-sqlite3` | Bun N-API gap | Use vitest |
| `onoff` only works on Linux | library is Linux-only | Dynamic import + stub on non-Linux |
| `__dirname` undefined in ESM | CommonJS API gone | `fileURLToPath(new URL('.', import.meta.url))` |
| `app.handle()` for tests, not `app.listen` | Elysia apps don't expose http.Server | `app.handle(new Request(url))` |
| `/openapi` returns 401 when Bearer is on | Auth blanket | Exempt `/openapi*` in `onBeforeHandle` |
| `vite build` from project root fails | config is in web/ | `cd web && bunx vite build` |
| GPIO read returns false on macOS | `onoff` stub mode | Expected; test GPIO on Pi only |
| `lock:true` serial port blocks other processes | By design | Document the lock; tests use `socat` pty pairs |
| `findSchema()` not in dist | tsc doesn't copy non-TS files | Multi-candidate lookup OR copy in postbuild step |
| NODE_MODULE_VERSION mismatch after Node switch | native modules compiled against old Node | `npm rebuild better-sqlite3` (use the same `node` you'll use for dev) |
| `bun run dev` says "command not found: bun" | Bun not on PATH | `export PATH="$HOME/.bun/bin:$PATH"` |
| Rebuild "succeeds" but app still crashes | rebuilt with a different Node than you run with | check `node -v` matches the rebuild Node; multiple Node installs (nvm + homebrew) is the usual cause |
| NODE_MODULE_VERSION mismatch | Different Node than what built the binaries | `npm rebuild better-sqlite3` |
| SSE not receiving | Elysia version of EventSource | Use `new EventSource(url)` in web |
| `vite build` bundles 200kb+ | Eden Treaty + React full | Acceptable; check gzipped size |
| `cd web && vite` doesn't reload | Vite caches aliases | Restart Vite after path alias changes |

## Files of interest (read these first when changing a subsystem)

| Subsystem | File(s) |
|---|---|
| Elysia app & route mount | `src/api/server.ts` |
| Per-feature routes | `src/api/routes/*.ts` |
| LLM agent routes (L1/L2/L3) | `src/api/routes/piAgent.ts` |
| Driver factory | `src/drivers/driver.ts` |
| New driver skeleton | `src/drivers/_template.ts` (when added) |
| Bus abstraction | `src/iobus/types.ts` |
| Core orchestrator | `src/core/deviceRegistry.ts` |
| Polling loop | `src/core/dataEngine.ts` |
| Alarm engine | `src/core/alarmEngine.ts` |
| Token parser | `src/core/conditionParser.ts` |
| Pi config editor | `src/pi/configOps.ts` |
| Pi Agent façade | `src/pi/agent.ts` |
| LLM client (Anthropic SDK wrapper) | `src/pi/llmClient.ts` |
| Tool registry (15 tools) | `src/pi/tools.ts` |
| L1 chat agent | `src/pi/agents/chatAgent.ts` |
| L2 diagnose agent | `src/pi/agents/diagnoseAgent.ts` |
| L3 ReAct agent | `src/pi/agents/reactAgent.ts` |
| Pi Agent Web UI | `web/src/pages/PiAgentPage.tsx` |
| Privilege shim | `scripts/pi-shim/envctrl_shim.py` |
| React entry | `web/src/main.tsx`, `web/src/App.tsx` |
| Eden client | `web/src/api.ts` |
| Config (YAML) | `config/default.yaml` |
| Schema (SQL) | `src/storage/schema.sql` |
| systemd unit | `deploy/envctrl.service` |
| Installer | `deploy/install.sh` |
| Native ABI check | `scripts/check-native-abi.mjs` |

## Build & run

```bash
bun install                # install
bun pm trust epoll         # one-time, allows epoll's native build
npm rebuild better-sqlite3 # if NODE_MODULE_VERSION mismatch

bun run dev                # backend (tsx watch)
bun run dev:web            # frontend (Vite, proxies /api)
bun run test               # vitest (53 tests)
bun run build              # vite build + tsc + schema copy
node dist/index.js         # production single-process
```

## Acceptance

- [ ] `bun run build` produces `dist/index.js` + `web/dist/index.html` + `dist/storage/schema.sql`
- [ ] `node dist/index.js` serves API + SPA on one port
- [ ] `bunx vitest run` → 53 tests pass
- [ ] On Pi: `journalctl -u envctrl -f` shows startup logs
- [ ] `dtoverlay=uart2` enabled, `/dev/ttyAMA1` exists
- [ ] `sudo -n /usr/local/libexec/envctrl-shim < /dev/null` exits 77 (refuses non-sudo)
- [ ] Web UI shows 1+ Modbus RTU, 1+ Modbus TCP, 1+ GPIO out, 1+ GPIO in with live data
- [ ] Alarm `co2_high` triggers at threshold, linked action writes to relay
- [ ] `/openapi` returns Swagger UI; `GET /api/devices` requires Bearer when `ENVCTRL_API_TOKEN` set