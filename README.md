# envctrl

基于 **Node 24 + ElysiaJS + React + Eden** 的树莓派环境控制平台(Eden 提供端到端类型安全)。

## 功能

- **设备控制**:Modbus RTU/TCP、GPIO 数字输入/输出
- **环境监测**:多传感器采样,SQLite 时序存储
- **告警/联动逻辑**:token 白名单条件求值器 + 跨设备动作
- **Web 面板**:React + Eden Treaty(单一类型源来自后端)
- **树莓派自管理**:多 UART 设备树 overlay、udev 规则、错误检测 — 全部通过小型 Python 特权 shim 路由(Node 进程内不持有 root)

完整设计见 `docs/superpowers/specs/2026-06-28-envctrl-design.md`。

## 快速开始(开发)

```bash
# 安装依赖
bun install

# 仅运行 dev server(使用 tsx watch)
bun run dev

# 运行测试(vitest,使用 Node 24 加载 native 模块)
bun run test

# 运行 web dev server(Vite,独立终端 — 通过 :3000 代理 /api)
bun run dev:web
```

## 生产构建(单一二进制进程)

```bash
bun run build       # 通过 Vite 构建 web/dist,然后编译 server 到 dist/
node dist/index.js  # 在 :3000 同时提供 API 和静态 web
```

`src/api/server.ts` 在 `web/dist/` 存在时自动服务它(通过 `@elysiajs/static` + SPA fallback)。

## 目录结构

- `src/` — 后端(Elysia + drivers + core + Pi agent)
- `web/` — 前端(React + Vite + Tailwind)
- `scripts/pi-shim/` — Python 特权 shim(部署在 Pi 上)
- `config/default.yaml` — 运行时配置
- `deploy/` — systemd unit + 安装脚本

## 运行时

- **Node.js 24**(Active LTS)— native 模块(`serialport`、`onoff`、`better-sqlite3`)需要
- 端口 `:3000`(可通过 `config/default.yaml` 的 `server.port` 修改)
- 数据落地在 `data/envctrl.db`(SQLite + WAL)

## Native 模块 ABI 陷阱

`serialport`、`onoff`、`better-sqlite3` 都是 **native 模块**,带 prebuilt `.node` 二进制。一旦 Node 升级主版本(比如 22 → 24),prebuilt 二进制就跟新 ABI 不兼容,加载时 segfault。

**修复:** 在装好 deps 之后跑 `npm rebuild`(参见 `.github/workflows/test.yml`)。CI 自动做了这件事;本地切换 Node 主版本时也要手动 rebuild。

**不要**让 `postinstall` 静默自动 rebuild — 参见 `scripts/check-native-abi.mjs` 里的 rationale。

## 部署到树莓派 4

在 Pi 上(Bookworm):

```bash
# 1. 克隆 + 构建
git clone <repo> /opt/envctrl && cd /opt/envctrl
bun install && bun run build

# 2. 安装(env 用户 + systemd + 权限 shim + backup timer)
sudo ./deploy/install.sh
```

`install.sh` 会:
- 创建 `envctrl` 系统用户,加入 `dialout,gpio`
- 装 Python 特权 shim 到 `/usr/local/libexec/`
- 装 systemd unit 到 `/etc/systemd/system/envctrl.service`
- 装 backup + restore + rotation 脚本到 `/usr/local/bin/`
- 启用 nightly backup timer(envctrl-backup.timer,每天 03:00)
- 创建 `/var/backups/envctrl/` 目录(0750,envctrl:envctrl 拥有)

日志:`journalctl -u envctrl -f`。

## Pi Agent 能力(Web → `/api/pi/*`)

| Endpoint | 用途 |
|---|---|
| `GET /api/pi/overlays` | 列出已配置的 dtoverlay |
| `POST /api/pi/config` | 安全地增加/移除 dtoverlay(dry-run 验证) |
| `GET /api/pi/udev` | 列出已安装的 udev 规则 |
| `POST /api/pi/udev` | 安装新 udev 规则(写 /etc/udev/rules.d) |
| `POST /api/pi/service` | `systemctl start/stop/restart <unit>` |
| `POST /api/pi/reboot` | 触发重启(需要 confirm) |

所有写操作都通过 **Python 权限 shim**(`scripts/pi-shim/envctrl_shim.py`)以 root 身份执行,Node 进程自身从不持 root。Shim 用严格白名单(只接受特定子命令和参数),由 `setup.sh` 以 `setuid` + 路径白名单方式安装。

## LLM Agent(可选)

`/api/pi/agent` 下暴露三层 agent,使用活动 LLM provider(`/api/llm/providers`)配置:

| Endpoint | Agent | 描述 |
|---|---|---|
| `GET /api/pi/agent/status` | — | 当前 LLM 是否配置好 |
| `POST /api/pi/agent/chat` | L1 ChatAgent | 单轮 NL → tool call → 回复。低风险 write 自动执行,高风险 stage 成 `ConfirmRequest`。 |
| `POST /api/pi/agent/diagnose` | L2 DiagnoseAgent | 只读调查器,最多 8 步,返回 `{summary, findings, suggestions}`。 |
| `POST /api/pi/agent/react` | L3 ReActAgent | 自主循环,通过 **SSE** 流式输出 `AgentStep` 事件。`confirm_request` step 需要 `POST /api/pi/agent/confirm`。 |
| `POST /api/pi/agent/confirm` | — | Resolve 一个待定的 confirmation(approve / deny)。L1(ChatAgent)和 L3(ReActAgent)都路由到这里。 |
| `GET /api/pi/agent/audit` | — | 最近的 LLM 活动(actor='llm') |

Web 端的 Pi Agent 页面有三个 tab:`chat` / `diagnose` / `react`。ReAct tab 接 SSE 流并实时渲染 step(包括 Confirm/Deny 按钮)。

## 静态加密(LLM apiKey)

Provider 的 `apiKey` 用 **AES-256-GCM**(带关联数据的认证加密)加密后存到 `llm_provider` 表。key 从 `ENVCTRL_ENCRYPTION_KEY` 读取:

```bash
# 生成 key
openssl rand -hex 32
# e.g. a1b2c3d4e5f6... (64 个十六进制字符 = 32 字节)

# 持久化
echo "ENVCTRL_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> /etc/envctrl/env
sudo systemctl restart envctrl
```

接受的格式:64 个十六进制字符、32 字节裸数据,或任意字符串(经 SHA-256 哈希成 32 字节 — 可复现但安全性较低)。

**开发回退**:如果 `ENVCTRL_ENCRYPTION_KEY` 未设,envctrl 会基于 hostname 推导一个固定 key,并打印一次性 console warning。**生产环境请勿使用。** 旧版存留的明文 key 会在下次保存时自动重新加密。

### 轮换加密 key

Web **Admin** 页面(`/admin` tab)会生成你要执行的精确 SSH 命令。粘贴新 key 进去会得到类似:

```bash
sudo -E /usr/local/bin/envctrl-rotate-encryption-key
# 等价于:
ENVCTRL_OLD_KEY='<old>' \
ENVCTRL_NEW_KEY='<new>' \
/opt/envctrl/node_modules/.bin/tsx /opt/envctrl/scripts/rotateKey.ts
```

这个脚本在单一事务内重新加密所有 `llm_provider.api_key` 行 — 任何 decrypt/encrypt 失败都回滚整个数据库。成功后,更新 `/etc/envctrl/env` 把 `ENVCTRL_ENCRYPTION_KEY=<new>`,然后 `sudo systemctl restart envctrl`。

**web 服务自身从不执行轮换** — 重新加密需要写 `/etc/envctrl/env`,只有 root 能做,我们不想让 web 漏洞有能力轮换 key。Admin 页面是一个**命令生成器** — 通过 SSH 复制粘贴运行。

也可以直接运行脚本:

```bash
# 手动,带提示:
sudo -E /usr/local/bin/envctrl-rotate-encryption-key

# 或者非交互式(CI / 脚本化轮换):
ENVCTRL_OLD_KEY="$(grep ^ENVCTRL_ENCRYPTION_KEY= /etc/envctrl/env | cut -d= -f2)" \
ENVCTRL_NEW_KEY="$(openssl rand -hex 32)" \
sudo -E /usr/local/bin/envctrl-rotate-encryption-key
```

轮换后,audit 表会写入 `key.rotation.start` / `.completed` / `.failed` 行,供合规查询。

## 备份

每日 SQLite 数据库 + config 的热备份通过 systemd timer 运行(`envctrl-backup.timer`,默认 03:00)。文件落地在 `/var/backups/envctrl/`,7 天保留期。`install.sh` 自动启用 timer。

手动操作:

```bash
# 立即创建一份
sudo -u envctrl /usr/local/bin/envctrl-backup
# 或通过 web Admin → Backups → "Create now" 按钮

# 恢复(停止服务,替换数据,启动)
sudo /usr/local/bin/envctrl-restore /var/backups/envctrl/envctrl-20260101T030000Z.db
# 可选第二参数:config 备份
```

Web **Admin → Backups** 卡片列出、下载,并生成恢复命令 — 跟轮换一样的"单向 SSH"模式,web 进程永不直接修改 live 数据库。

## 安全说明

- 告警条件用自写的 token 白名单解析器求值(无 `eval`、无 JS 执行)。允许的 token:数字、单/双引号字符串、`value`、`true`、`false`、比较运算符、`&&` `||` `!` 和括号。
- Elysia 进程以非 root 用户运行;root 只通过权限 shim 临时获取,仅用于特定的 allowlisted 子命令。
- `serialport` 用 `lock: true` 打开每个 `/dev/tty*`(Linux flock),防止与其他进程冲突。
- Admin API 的 rotation/restore 端点**只生成** SSH 命令,永不执行 — web 进程无能力修改 `/etc/envctrl/env` 或停止服务。
- `web/hooks/usePostSSE.ts` 显式管理 `AbortController`,确保组件卸载时关闭 SSE 读取器。

## 开发

```bash
# Type-check(后端)
bunx tsc --noEmit -p tsconfig.json
# Type-check(scripts/)
bunx tsc --noEmit -p tsconfig.scripts.json

# 测试
bunx vitest run
bunx vitest run tests/storage/secrets.test.ts   # 单个文件

# Web
bun run dev:web                                  # Vite dev server
bun run build:web                                # 产出 web/dist/
```

CI 跑在 GitHub Actions(`.github/workflows/test.yml`):push 到 main 或 PR 触发;node 24 + bun,rebuild native,tsc,vitest,vite build。

## 许可证

MIT — 详见 [LICENSE](./LICENSE)。
