# AGENTS.md — envctrl 项目

> 给 AI agent 看的项目级 context。**人读 README.md**。本文件描述项目结构、设计系统、
> 测试规范、开发纪律，让任何 agent / 协作者进项目就能干活。

---

## 1 · 项目一句话

**envctrl** = 树莓派环境控制平台。Node 24 + ElysiaJS 后端 + React + Eden(端到端类型)前端。
控制 Modbus RTU/TCP、GPIO 设备，采集传感器，做 token 白名单告警 + LLM Agent。

---

## 2 · 仓库布局

```
envctrl/
├── src/                # 后端(Elysia + drivers + core + Pi agent)
│   ├── api/            # Elysia 路由 + 服务入口
│   │   ├── server.ts   # buildApp() — 导出 App 类型供 Eden 前端消费
│   │   └── routes/     # 每个域一个文件(devices / samples / alarms / control / pi / stream / llmProviders / admin / piAgent)
│   ├── core/           # 设备注册、事件总线、告警引擎
│   ├── drivers/        # Modbus / GPIO / custom 驱动
│   ├── iobus/          # 串口 I/O 抽象层
│   ├── pi/             # Pi 平台自管理(agent / overlays / udev / shim)
│   │   └── agents/     # L1 ChatAgent / L2 DiagnoseAgent / L3 ReActAgent
│   ├── storage/        # SQLite repos(secrets / llmProvider / 设备 / 样本 / 告警 / audit)
│   ├── config/         # 配置加载器
│   ├── shared/         # 跨进程类型(前后端共用)
│   └── index.ts        # 进程入口
│
├── web/                # 前端(React 18 + Vite 5 + Tailwind 3 + Eden Treaty)
│   ├── src/
│   │   ├── App.tsx     # 顶层 + tab 路由
│   │   ├── pages/      # OverviewPage / AlarmsPage / Devices / Pi / PiAgent / Config / Admin
│   │   ├── components/ # 业务组件(Sparkline / TimeSeriesChart / ...)
│   │   ├── hooks/      # useStream / usePostSSE
│   │   ├── design/     # ★ 设计系统(token / animation / aurora)
│   │   └── components/ui/ # ★ 通用组件库(Card / Button / Pill / Toggle / ...)
│   ├── tailwind.config.js
│   └── vite.config.ts  # 代理 /api → localhost:3000
│
├── tests/              # vitest 后端测试(Node 环境,直接跑 .ts)
│   ├── api/            # 路由级 + LLM agent 集成
│   ├── core/           # alarmEngine / conditionParser(白名单)
│   ├── drivers/        # Modbus / GPIO 驱动
│   ├── iobus/          # 串口 + lock
│   ├── storage/        # repo + secrets 加密 + llmProvider
│   ├── config/         # YAML loader
│   ├── shared/         # 类型对齐
│   └── pi/             # LLM agents / llmClient
│
├── web/tests/          # ★ vitest 前端组件测试(jsdom 环境,见 §6)
│
├── scripts/            # predev-check / check-native-abi / rotateKey / pi-shim
├── deploy/             # systemd unit + 安装脚本 + backup / rotation 脚本
├── config/default.yaml # 运行时配置
├── data/               # SQLite DB(WAL)
├── workspace/          # 设计稿 / 交互 demo / 设计规范(不进 build)
└── README.md           # 给人读
```

★ = 新结构,见 §3 / §5 / §6

---

## 3 · 设计系统(Glass Soft)

完整规范见 `workspace/glass-soft-spec.md` + `workspace/glass-soft-interactions.md`。

**核心规则**:

- 所有面板必须 `backdrop-filter: blur(24px) saturate(140%)` + 1px 白边 + inset 阴影 + 多层外阴影
- 数字一律 JetBrains Mono + `tabular-nums`
- 状态 = 颜色 + icon + 文字三重信号
- 语义色 = 12-15% 同色背景 + 30% 同色 border + 主题色字
- 动效用 `transform + opacity`,不用 `top/left/width/height`
- `prefers-reduced-motion` 必须 fallback(规范 §9)

**实施文件**:

- `web/src/design/tokens.css` — CSS 变量(背景 / 玻璃 / 文本 / 语义 / 图表 / 间距 / 圆角 / 阴影 / 动效)
- `web/src/design/animations.css` — keyframes + reduced-motion fallback
- `web/src/design/aurora.tsx` — 背景层(aurora 渐变 + 浮动光斑)
- `web/src/design/index.css` — design 系统入口,在 `index.css` 第一行 import
- `web/tailwind.config.js` — 颜色 / 字体 / 圆角 / 阴影 / 动效的 Tailwind 扩展

**禁止**:

- 用 `bg-slate-800` / `bg-emerald-400` 这类旧 Tailwind 调色板(已废)
- 数字不带 `font-mono` + tabular-nums
- 任何面板没有 `backdrop-filter`
- 用 `top/left` 做动画

---

## 4 · 跨进程类型契约

后端 `src/api/server.ts` `buildApp` 导出 `App` 类型,前端 `web/src/api.ts` 通过 Eden Treaty 直接消费。
**这是项目唯一的端到端类型源 — 不要在 web/src 自定义重复的 type。**

```ts
// web/src/api.ts — 不要改这个模式
import type { App } from '../../../src/api/server.js'
export const api = treaty<App>(window.location.origin)
```

新增 API 路由: 在 `src/api/routes/<domain>.ts` 加 → 自动出现在 `api.api.<domain>.*`。
新增类型: 加到 `src/shared/types.ts` → 前端通过 Eden 自动可见。

---

## 5 · 后端核心规则

### 5.1 告警条件解析 — 禁止 eval
`src/core/conditionParser.ts` 是自写的 token 白名单解析器(支持数字 / 字符串 / `value` / `true`/`false` / 比较 / `&&` `||` `!` / 括号)。
**永远不要换成 `eval` 或 `new Function`**。

### 5.2 Pi Agent 三层
- L1 `ChatAgent` — 单轮 NL → tool call → 回复,低风险自动执行,高风险 stage 成 `ConfirmRequest`
- L2 `DiagnoseAgent` — 只读调查,最多 8 步
- L3 `ReActAgent` — 自主循环 + SSE 流式 `AgentStep`

### 5.3 静态加密(LLM apiKey)
- AES-256-GCM,key 从 `ENVCTRL_ENCRYPTION_KEY` 读
- 64 hex / 32 字节裸 / 任意字符串(SHA-256 派生成 32 字节)三种格式都接受
- web Admin 页面**只生成 SSH 命令**,不直接轮换 — 写 `/etc/envctrl/env` 需要 root

### 5.4 Native ABI 陷阱
`serialport` / `onoff` / `better-sqlite3` 都是 native。Node 主版本切换(22 → 24)要 `npm rebuild`。
**postinstall 故意不静默自动 rebuild**(见 `scripts/check-native-abi.mjs` rationale)。

### 5.5 SSE 安全
所有 SSE 路由用 `try { controller.enqueue(...) } catch { /* closed */ }` 包好。
`web/hooks/usePostSSE.ts` 显式管理 `AbortController`,组件卸载时关闭。

---

## 6 · 前端核心规则

### 6.1 测试
- vitest 2.1+,jsdom 环境
- 测试文件在 `web/tests/**/*.test.tsx`(或 `web/src/**/*.test.tsx` 同级)
- 使用 `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom/vitest`
- 见 `web/vitest.config.ts` 配置

### 6.2 组件结构
- `web/src/components/ui/` — 通用 UI(Card / Button / Pill / Toggle / Slider / Tabs / Toast / Tooltip / Modal / Skeleton / Pulse / EmptyState / ErrorState)
- `web/src/components/chart/` — 图表(Ring / Sparkline / AreaChart / LineChart / RoomMap)
- `web/src/components/layout/` — 应用外壳(Sidebar / Topbar)
- `web/src/pages/` — 业务页面,**直接消费 ui/ + chart/**

### 6.3 写新页面
1. 看 `workspace/glass-soft-spec.md` §4 组件清单 → 优先用现有组件
2. 复用 `design/Aurora` 做背景
3. 用 `<Card>` 包内容,**禁止** `bg-slate-800 border border-slate-700` 写法
4. 数字用 `<span className="font-mono tabular-nums">`,或封装 `<Metric>` 组件
5. 状态用 `<Pill status="ok|warn|crit|info">`,**禁止** `<span className="text-emerald-400">`
6. 写至少 1 个测试覆盖关键交互

### 6.4 改样式
- 调色板: `tailwind.config.js` 改一次,所有页面同步
- 间距 / 圆角 / 阴影: 同上
- 动效: `design/animations.css` 加 keyframe,组件里 `className="anim-foo"`

---

## 7 · 开发命令

```bash
# 后端开发
bun run dev              # tsx watch src/index.ts (含 predev-check)
bun run dev:server       # 同上,跳过 predev

# 前端开发
bun run dev:web          # vite dev server :5173,代理 /api → :3000

# 构建
bun run build            # vite build + tsc server + tsc scripts
bun run build:web        # 只构建前端
bun run build:server     # 只编译后端 + scripts

# 测试
bun run test             # vitest run(全部)
bun run test:watch       # vitest(交互)
bun run typecheck        # tsc --noEmit(后端)

# 单文件
bunx vitest run tests/storage/secrets.test.ts
```

---

## 8 · 部署

envctrl 跑在 Raspberry Pi 上,systemd unit 名 `envctrl.service`。

**dev 机一条命令部署**(从 repo 根目录):

```bash
scripts/deploy.sh                       # 默认 envctrl@envctrl-pi.local
scripts/deploy.sh pi@192.168.1.42       # 自定义 host
```

内部三步:rsync 源码(过滤 node_modules / dist / tests / workspace) →
在 Pi 上 `bun install --frozen-lockfile` + `bun run build`(native 模块必须
在目标架构编译,不能从外机 sync) → `sudo deploy/install.sh` 装 systemd unit。

**Pi 端要求**(由 install.sh 之前手动准备):

- `/usr/local/bin/node` 是 Node 22+(推荐 24,匹配 `engines`),**不要**装
  apt 的 `nodejs`(Node 20 / ABI 115 跟预编译的 better-sqlite3、serialport、
  onoff 不兼容,会 `ERR_DLOPEN_FAILED`)。
- `bun` 在 PATH 上(否则 deploy.sh 自动 fallback 到 `npm ci --omit=dev`)。
- 部署用户在 Pi 上有 passwordless sudo。

**`deploy/install.sh` 自动做**: 装 `python3`(`pigpio` 可选,缺包不报错,
因为 shim 走 stdlib、Node 走 libgpiod)、创建 `envctrl` 用户(加入 `dialout`
+ `gpio`)、装 Python 权限 shim + sudoers 规则、装 systemd unit、装备份 /
rotate-encryption-key 脚本到 `/usr/local/bin/`、启用 `envctrl-backup.timer`
(每天 03:00 备份到 `/var/backups/envctrl/`,0750,`envctrl:envctrl` 拥有)。

**踩过的坑**(已写进脚本注释):

- systemd `Group=dialout,gpio` 逗号语法不认 → 拆成 `Group=dialout` +
  `SupplementaryGroups=gpio`。
- Pi 端 Node 用 `/usr/local/bin/node` 而非 `/usr/bin/node`。
- native 模块必须在 Pi 上现场 `bun install`,**不要**从 x86_64 dev 机
  rsync `node_modules`。

---

## 9 · 文档位置

| 主题 | 位置 |
|---|---|
| 给人读 | `README.md` |
| 给 agent 看 | 本文件 `AGENTS.md` |
| 设计规范 | `workspace/glass-soft-spec.md` |
| 交互规范 | `workspace/glass-soft-interactions.md` |
| 设计稿(8 页面) | `workspace/ui-design-c.html` |
| 交互 demo(13 节) | `workspace/glass-soft-interactions.html` |
| 设计风格对比 | `workspace/ui-style-comparison.html` |
| 截图 | `workspace/screenshots/*.png` |

---

## 10 · 禁止清单

- ❌ 用 Tailwind 默认调色板(`bg-slate-*` / `text-emerald-*` 等)写新代码 — 改用 design tokens
- ❌ `eval` / `new Function` — 告警条件解析必须走白名单解析器
- ❌ web 进程直接执行加密 key 轮换 / 数据库恢复 — 只生成 SSH 命令
- ❌ 改 native 模块版本不重建 — Node 主版本切换必 `npm rebuild`
- ❌ 把 `src/api/server.ts` 的 `buildApp` 拆分到多个文件 — Eden 类型源必须是单一入口
- ❌ 在 `web/src/` 自定义重复后端类型 — 用 `import type { App } from '...server.js'`
- ❌ SSE handler 不写 `try/catch` enqueue
- ❌ 写新页面不写测试
- ❌ 动画用 `top/left/width/height`(必须 `transform + opacity`)
- ❌ 不写 `prefers-reduced-motion` fallback