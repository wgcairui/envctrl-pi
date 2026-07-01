# envctrl · Glass Soft — Design Spec v1.0

> 树莓派 IoT 环境控制平台的完整设计规范。所有页面、组件、状态、间距、动效都基于这份规范产出。
> 配套实现：`workspace/ui-design-c.html`（8 页面 mockup），`workspace/glass-soft-interactions.html`（交互 demo）。

---

## 1 · 设计原则

| 原则 | 含义 |
|---|---|
| **Ambient first** | UI 像空气一样存在——背景是流动的极光，玻璃是透明的，主体永远在前景 |
| **Single hero per view** | 每个页面有 1 个视觉锚点（圆环 / 大数字 / 大图），其它信息围绕它组织 |
| **Data is warm** | 数字不冷：等宽字体 + tabular-nums + 适当留白 + 状态颜色点 |
| **Glass over flat** | 所有面板必须有 backdrop-blur + 1px 白边 + 内辉光 + 多层阴影，**禁止纯色填充** |
| **Honest about state** | 状态必须立刻可读——颜色 + icon + 文字三重信号，缺一不可 |

---

## 2 · 设计令牌（Design Tokens）

### 2.1 颜色 — 背景层

| Token | Value | 用途 |
|---|---|---|
| `--bg-1` | `#1a0b2e` | aurora 渐变起点（深紫） |
| `--bg-2` | `#2d1155` | 紫 |
| `--bg-3` | `#5b1769` | 紫红 |
| `--bg-4` | `#831843` | 玫红 |
| `--bg-5` | `#be185d` | 玫红亮 |

> 背景 = `linear-gradient(135deg, bg-1 0%, bg-2 30%, bg-3 60%, bg-4 90%)` + 4 个 radial-gradient 光斑（粉/青/紫/玫红），blur 80px，3 个 18s 浮动动画。

### 2.2 颜色 — 玻璃层

| Token | Value | 用途 |
|---|---|---|
| `--glass-1` | `rgba(255,255,255,0.08)` | 普通面板、列表项 |
| `--glass-2` | `rgba(255,255,255,0.12)` | 高亮面板、hover |
| `--glass-3` | `rgba(255,255,255,0.18)` | modal、active 强态 |
| `--glass-border` | `rgba(255,255,255,0.18)` | 默认边框 |
| `--glass-border-strong` | `rgba(255,255,255,0.28)` | 强调边框 |

**Glass 三件套（必须同时存在）**：
```css
background: var(--glass-1);
border: 1px solid var(--glass-border);
backdrop-filter: blur(24px) saturate(140%);
box-shadow:
  0 8px 32px rgba(0,0,0,0.25),     /* 外阴影 — 深度 */
  inset 0 1px 0 rgba(255,255,255,0.12); /* 内辉光 — 玻璃感 */
```

### 2.3 颜色 — 文本层

| Token | Value | 用途 |
|---|---|---|
| `--ink` | `#ffffff` | 主文字、标题 |
| `--ink-2` | `rgba(255,255,255,0.75)` | 副文字、表单值 |
| `--ink-3` | `rgba(255,255,255,0.55)` | 弱化、label、meta |
| `--ink-4` | `rgba(255,255,255,0.35)` | 辅助、placeholder |
| `--ink-5` | `rgba(255,255,255,0.20)` | divider、border 弱化 |

### 2.4 颜色 — 语义色

| Token | Value | Glow | 用途 |
|---|---|---|---|
| `--ok` | `#6ee7b7` (mint) | `rgba(110,231,183,0.4)` | 在线、正常、resolved、success |
| `--warn` | `#fcd34d` (amber) | `rgba(252,211,77,0.4)` | 警告、drift、drift 状态 |
| `--crit` | `#fda4af` (soft pink) | `rgba(253,164,175,0.45)` | 严重告警、offline、danger |
| `--info` | `#93c5fd` (sky) | `rgba(147,197,253,0.4)` | 信息、tool call、control |
| `--accent` | `#a5b4fc` (indigo) | `rgba(165,180,252,0.4)` | 选中、链接、CTA 描边 |
| `--hot` | `#f472b6` (hot pink) | `rgba(244,114,182,0.4)` | 高风险、reboot |
| `--cyan` | `#67e8f9` | `rgba(103,232,249,0.4)` | 图表次色、湿度 |

> 语义色 **永远配 12-15% 同色背景 + 30% 同色 border**：
> ```css
> background: rgba(110,231,183,0.10);
> border: 1px solid rgba(110,231,183,0.30);
> color: var(--ok);
> ```

### 2.5 图表色板

```css
--chart-1: #a78bfa;  /* 紫 — 温度、primary */
--chart-2: #67e8f9;  /* 青 — 湿度、secondary */
--chart-3: #fcd34d;  /* 琥珀 — PM2.5、warning */
--chart-4: #6ee7b7;  /* 薄荷 — 正常状态 */
--chart-5: #f472b6;  /* 品红 — 高风险 */
--chart-6: #93c5fd;  /* 天蓝 — 信息 */
--chart-threshold: #fda4af;  /* 阈值线、软红 */
```

### 2.6 字体

| 用途 | Font | Weight | Size scale |
|---|---|---|---|
| Display | Inter | 600 | 38 / 32 / 28 / 22 |
| Body | Inter | 400/500 | 14 / 13 / 12 |
| Label | Inter | 500 uppercase | 11 / 10 |
| Number/Code | JetBrains Mono | 500/600 | 56 / 38 / 32 / 28 / 24 / 13 / 12 / 11 / 10 |
| Tabular nums | JetBrains Mono | — | 全部数字、统计 |

**强制规则**：
- 所有数字用 `font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;`
- 所有 metric label 用 uppercase + letter-spacing 0.06em + font-size ≤ 11px
- 行高：display 1.1–1.2 / body 1.5

### 2.7 间距

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
```

| 用途 | Token |
|---|---|
| 内嵌 icon 与文字 | 6 / 8 |
| 表单 label 与 input | 6 |
| 列表项垂直间距 | 10 / 12 |
| 卡片内边距 | 20 / 24 |
| 卡片间距 | 16 / 20 |
| 区块间距 | 24 |
| 大区块间距 | 32 |
| 主页面 padding | 28 / 32 |

### 2.8 圆角

| Token | Value | 用途 |
|---|---|---|
| `--r-sm` | 8px | 按钮、tag、input |
| `--r-md` | 12px | 卡片、stat tile、point card |
| `--r-lg` | 18px | 大卡片、device 卡片、chart card |
| `--r-xl` | 24px | hero、modal、gauge 容器 |
| `--r-pill` | 999px | 胶囊按钮、status pill、tab 组 |

### 2.9 阴影

```css
--shadow-1: 0 4px 16px rgba(0,0,0,0.18);   /* 卡片轻浮 */
--shadow-2: 0 8px 32px rgba(0,0,0,0.25);   /* 大卡片 */
--shadow-3: 0 16px 48px rgba(0,0,0,0.35);  /* modal、hero */
--shadow-inset: inset 0 1px 0 rgba(255,255,255,0.12);  /* 玻璃内辉光 */
```

### 2.10 动效

| 名称 | Duration | Easing | 用途 |
|---|---|---|---|
| `--dur-fast` | 150ms | ease-out | hover 颜色、icon 旋转 |
| `--dur-base` | 200ms | ease-out | 通用过渡、tab 切换 |
| `--dur-slow` | 300ms | ease-out | 卡片缩放、page transition |
| `--dur-breath` | 2500ms | ease-in-out | pulse、orb 浮动 |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` | — | 默认（标准 Material） |
| Easing spring | `cubic-bezier(0.34, 1.56, 0.64, 1)` | — | 弹性入场（modal、toast） |

---

## 3 · 布局系统

### 3.1 应用外壳

```
┌─────────┬───────────────────────────────────┐
│         │  topbar (search + actions)        │
│ sidebar │ ─────────────────────────────────  │
│  240px  │                                   │
│  (sticky│            main canvas            │
│   100vh)│       max-width 1480px            │
│         │       padding 28 32               │
│         │                                   │
└─────────┴───────────────────────────────────┘
```

### 3.2 栅格

| 用途 | 列数 | gap |
|---|---|---|
| Live metrics (Overview) | 6 列 | 14 |
| Device cards (Devices) | 3 列 (≥1200) / 2 列 (≥768) | 16 |
| Point cards (Device Detail) | 2 列 | 14 |
| Alarm stat cards | 4 列 | 14 |
| Hero (Overview) | 1.3fr 1fr | 20 |
| Trend + Room map | 2fr 1fr | 20 |
| Pi stat tiles | 3 列 | 16 |
| Pi mini stats | 4 列 | 14 |

### 3.3 断点

```
sm: 640px
md: 768px   (device grid 改 2 列)
lg: 1024px  (agent / config / admin 多列布局激活)
xl: 1200px  (live metrics 缩到 3 列)
2xl: 1480px (主容器 max-width)
```

---

## 4 · 组件库

### 4.1 Card（4 variant）

| Variant | 背景 | 用途 |
|---|---|---|
| `.card` | glass-1 + border | 默认面板 |
| `.card.elev-2` | glass-2 | 高亮面板（如 active provider） |
| `.card.aq-card` | linear-gradient(160deg, ok-glow 10%, glass-1) | 状态强调（AQI、Pi 状态） |
| `.card.hero-greeting` | linear-gradient(135deg, 三色 20%/12%/10%) + 大 blur 光斑 | hero 区（仅 Overview） |

### 4.2 Button（5 variant × 3 size）

| Variant | 用途 |
|---|---|
| `.btn` 默认 | 次要操作 |
| `.btn.primary` | 主操作（紫粉渐变 + 玻璃辉光） |
| `.btn.success` | 确认 / 激活（薄荷青渐变） |
| `.btn.danger` | 危险（reboot、delete） |
| `.btn.ghost` | 文字按钮 / 标签型 |

Size：`.btn` (default 13/18px) / `.btn.sm` (12/12px) / `.btn.icon` (36×36 圆角 10px)

### 4.3 Pill / Chip / Tag

| 元素 | 形态 | 颜色 |
|---|---|---|
| `.pill` 状态 | 胶囊 + 6px 发光点 | ok / warn / crit / info |
| `.chip` 过滤 | 胶囊 + 计数 | 默认 / `.on` 高亮 |
| `.tag` 标签 | 胶囊 1px 边 | ink-3 弱化 |

### 4.4 Icon 系统

- **统一 stroke 2 / stroke-linecap round / stroke-linejoin round**
- 来源：Lucide（已内嵌最常用 20 个）
- 大小：12 (inline meta) / 14 (button) / 16 (card icon) / 18 (stat card) / 32 (hero icon)
- 颜色：跟随 text color，需要强调时改 `style="color: var(--ok)"`

### 4.5 Form

| 元素 | 规范 |
|---|---|
| Label | uppercase 11px JetBrains Mono + letter-spacing 0.06em + color ink-3 |
| Input | glass-1 背景 + glass-border + 圆角 12 + 14px padding + 13px Mono 字体 |
| Focus | border → accent + background → glass-2 + transition 200ms |
| Error | border → crit + 4px crit-glow box-shadow |
| Helper | 11px ink-3，行高 1.5 |

### 4.6 Toggle

```css
.toggle { width:40px; height:22px; border-radius:999px; }
.toggle::after { /* 16px 滑块 */ transition: all 200ms ease-out; }
.toggle.on { background: linear-gradient(135deg, ok, cyan); }
```

### 4.7 Slider

- track：4px 高，glass-1 + border
- thumb：16px 圆，渐变紫粉 + accent-glow 阴影
- 拖动：thumb scale 1.15（150ms） + 阴影加深

### 4.8 Tabs / Range tabs

- 容器：glass-1 + pill 圆角 + 3px 内边距
- 项：padding 7×16 / 5×12，hover ink，active glass-2 + inset 阴影

### 4.9 图表

| 图表 | 规范 |
|---|---|
| Ring (AQI, gauge) | 200×200 / 180×180 viewBox，14/12 stroke-width，cap round，drop-shadow 6px |
| Area | 路径 + 渐变 fill (alpha 0.35→0) + 2px stroke + 圆滑 bezier |
| Line | 2px stroke，圆滑，可选 3-2 dasharray 表达"预测" |
| Spark | 80×28 viewBox，1.5px stroke，cap round，无 grid 无 axis |
| Threshold | 1px crit 虚线 + 9px label 右上角 |

---

## 5 · 状态语义

### 5.1 设备

| 状态 | 颜色 | icon | 文字 |
|---|---|---|---|
| `online` | mint 绿点 + glow | ● | "online" |
| `warning` | 琥珀脉动点 | ● (动画) | "drift" / "warn" / 实际原因 |
| `offline` | ink-4 灰点 | ○ | "offline" |

### 5.2 告警

| 严重度 | 颜色 | 用途 |
|---|---|---|
| `critical` | crit 粉 | PM2.5 越界、UART 长时间掉线 |
| `warning` | warn 琥珀 | 短时 timeout、drift、rate elevated |
| `info` | info 天蓝 | 状态变化、备份完成 |
| `resolved` | ok 薄荷 + 50% opacity + 删除线 | 已恢复事件 |

### 5.3 数值

| 状态 | 视觉 |
|---|---|
| `normal` | 默认 ink 白色 |
| `warn` | warn 色字 + warn-glow 边框 + warn-tint 背景 |
| `crit` | crit 色字 + crit-glow 边框 + crit-tint 背景 |

### 5.4 连接

| 状态 | 视觉 |
|---|---|
| `connected` | mint pulse 点 + "live · 47d uptime" |
| `degraded` | warn 静态点 + "live · 2 issues" |
| `disconnected` | crit 静态点 + "offline · last seen 2h" |

### 5.5 LLM Activity

| Action | 颜色 |
|---|---|
| `tool.result` / `tool.confirmed` | mint |
| `tool.call` | amber |
| `tool.denied` / `tool.error` | crit |
| `llm.request` / `llm.response` | ink-3 |

---

## 6 · 内容规范

### 6.1 数字格式

- 温度：1 位小数（`23.5°C`），不要 `23.50`
- 百分比：1 位小数（`68.2%`），整数时省略（`42%`）
- 大数字：千分位（`1,247`），状态文字仍要 1 位
- bytes：`B / KB / MB / GB`，1 位小数
- 时长：`47d 12h` / `6h 22m` / `0.4s` / `142ms`
- Token：`248 in / 312 out`

### 6.2 时间格式

- 全局：`2026-07-01 07:03:42`
- 行内（"x ago"）：`14m ago` / `1h 38m ago` / `2d 4h ago` / `Yesterday 22:14` / `07-01 03:00`
- 倒计时：`expires in 2h 14m`

### 6.3 单位

- 永远跟着数字（`38 μg` 不是 `38ug`），空格分隔
- 度数符号 ° 紧贴数字（`23.5°C`）
- 百分比紧贴数字（`68.2%`）

### 6.4 缩写与命名

- Modbus 总线：`/dev/ttyUSB0 · 19200 baud`（人话 + 数字）
- I²C 设备：`i2c-1 · 0x76`
- 设备名：`KIND-NN · Room`（如 `AC-01 · Living`）

### 6.5 占位文案

- 空状态：`"No alarms. 👌"` / `"No backups yet. They appear here after the nightly timer (03:00) runs."`
- 加载：`"Loading…"` 短词，不要 `"Fetching data from server, please wait"`
- 错误：`"Error"` / 具体错误信息 + `console.error` 写 dev

---

## 7 · 可访问性

| 项 | 要求 |
|---|---|
| 文字对比度 | ink 文字 vs 玻璃背景 ≥ 4.5:1（正常文字） / 3:1（标题 18px+） |
| Focus ring | 2px accent 实线 + 2px offset，永不删除 |
| 键盘导航 | tab 顺序遵循视觉顺序；toggle / slider 支持 Space / Arrow |
| 屏幕阅读 | 所有 icon button 加 `aria-label`；图表加 `<title>` |
| `prefers-reduced-motion` | 关掉 pulse / 浮动 orb / page transition，只保留必要状态切换 |

---

## 8 · Tailwind 实施模板

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: { 1: '#1a0b2e', 2: '#2d1155', 3: '#5b1769', 4: '#831843', 5: '#be185d' },
        glass: { 1: 'rgba(255,255,255,0.08)', 2: 'rgba(255,255,255,0.12)', 3: 'rgba(255,255,255,0.18)' },
        ink: { DEFAULT: '#fff', 2: 'rgba(255,255,255,0.75)', 3: 'rgba(255,255,255,0.55)', 4: 'rgba(255,255,255,0.35)', 5: 'rgba(255,255,255,0.20)' },
        ok: '#6ee7b7', warn: '#fcd34d', crit: '#fda4af', info: '#93c5fd', accent: '#a5b4fc', hot: '#f472b6', cyan: '#67e8f9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { sm: 8, md: 12, lg: 18, xl: 24 },
      boxShadow: {
        1: '0 4px 16px rgba(0,0,0,0.18)',
        2: '0 8px 32px rgba(0,0,0,0.25)',
        3: '0 16px 48px rgba(0,0,0,0.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      backdropBlur: { glass: '24px' },
      transitionDuration: { fast: '150ms', base: '200ms', slow: '300ms', breath: '2500ms' },
    },
  },
};
```

---

## 9 · 文件组织建议

```
web/src/
├── design/
│   ├── tokens.css          # 所有 CSS 变量
│   ├── animations.css      # keyframes + 通用 transition
│   └── aurora.tsx          # 背景层（aurora + 3 orb）
├── components/
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Pill.tsx
│   │   ├── Chip.tsx
│   │   ├── Toggle.tsx
│   │   ├── Slider.tsx
│   │   ├── Tabs.tsx
│   │   ├── RangeTabs.tsx
│   │   ├── Icon.tsx        # 统一 Lucide 包装
│   │   ├── Tooltip.tsx
│   │   ├── Toast.tsx
│   │   └── Modal.tsx
│   ├── chart/
│   │   ├── Ring.tsx        # AQI / gauge
│   │   ├── AreaChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── Sparkline.tsx
│   │   └── RoomMap.tsx
│   └── feedback/
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       ├── Skeleton.tsx
│       └── Pulse.tsx       # 状态点动画
├── pages/
│   └── ...（保持现有结构，按 spec 改样式）
```

---

## 10 · 验收清单

每个页面改完自检：

- [ ] 背景有 aurora 渐变 + ≥1 个浮动光斑
- [ ] 所有面板是玻璃（`backdrop-filter: blur` + 1px 白边 + inset 阴影）
- [ ] 数字全是 JetBrains Mono + tabular-nums
- [ ] label 全是 uppercase + ink-3 + 11px
- [ ] 状态用 pill（颜色 + 发光点 + 文字）
- [ ] hover 状态有反馈（背景 + translateY）
- [ ] 焦点态有可见 outline
- [ ] 空 / 加载 / 错误三态都有占位
- [ ] 1440×900 桌面下不出现横向滚动
- [ ] prefers-reduced-motion 下无 pulse / 浮动
