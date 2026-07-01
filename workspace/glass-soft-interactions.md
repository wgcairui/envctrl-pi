# envctrl · Glass Soft — 交互效果指南

> 配套 `ui-design-c.html`（8 页面 mockup）和 `glass-soft-interactions.html`（live demo）。本文件讲"为什么这样动"和"动多少"，demo 文件讲"看起来什么样"。

---

## 1 · 动效基础规则

### 1.1 什么时候动

| 触发 | 动效 | 时长 |
|---|---|---|
| 鼠标进入 | 背景颜色 / 浮起 | 150ms |
| 鼠标按下 | 缩放反馈 | 100ms |
| 状态改变（toggle / tab / select） | 颜色 + 位置过渡 | 200ms |
| 页面 / 大区块切换 | 淡入 + 上移 | 300ms |
| 数据更新（数字 / 图表） | 数字滚动 / 路径描边 | 500–800ms |
| 弹层出现（modal / toast） | 缩放 + 淡入 | 250ms (spring) |
| 环境动效（orb / pulse） | 永远 | 2500ms |

### 1.2 永远不会动

- 文字内容（不能 fade out 然后换行）
- 图标颜色单独变（必须跟父级一起过渡）
- 模态框出现时背景滚动（用 `overflow: hidden` 锁 body）
- 主动画没完成时叠加新动画（用 `prefers-reduced-motion` 过滤）

### 1.3 Duration 速查

```
--dur-fast    150ms   颜色、icon、按钮按压
--dur-base    200ms   通用过渡、tab 切换、toggle
--dur-slow    300ms   卡片缩放、page 切换
--dur-breath  2500ms  pulse、浮动 orb、aurora 光斑
```

### 1.4 Easing 速查

```
ease-out                          默认（hover、color）
cubic-bezier(0.4, 0, 0.2, 1)      标准（Material standard）— 通用过渡
cubic-bezier(0.34, 1.56, 0.64, 1) spring — 弹层入场（modal、toast）
linear                            永远、breath、loading spinner
```

---

## 2 · 微交互

### 2.1 Hover

#### 卡片
```css
.card {
  background: var(--glass-1);
  transition: all var(--dur-base) ease-out;
}
.card:hover {
  background: var(--glass-2);
  transform: translateY(-1px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.18);
}
```

#### 设备卡（更明显）
```css
.device-card {
  transition: all var(--dur-base) ease-out;
}
.device-card:hover {
  background: var(--glass-2);
  transform: translateY(-2px);
  box-shadow: var(--shadow-2);
}
/* hover 时高亮 status 点 */
.device-card:hover .status {
  transform: scale(1.3);
  box-shadow: 0 0 12px var(--ok-glow);
}
```

#### 按钮
```css
.btn {
  transition: all var(--dur-fast) ease-out;
}
.btn:hover {
  background: var(--glass-2);
  border-color: var(--glass-border-strong);
}
.btn.primary:hover {
  background: linear-gradient(135deg, rgba(167,139,250,0.65), rgba(244,114,182,0.65));
  transform: translateY(-1px);
}
```

### 2.2 Active（按下）

```css
.btn:active,
.device-card:active,
.toggle:active {
  transform: scale(0.98);
  transition: transform 100ms ease-out;
}
```

### 2.3 Focus

**永远不要删除 `outline`**，改造成有设计感的：

```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
```

> input / toggle / slider 等控件 focus 时还应该改变 border 颜色 + 加 glow：
> ```css
> .input:focus {
>   border-color: var(--accent);
>   background: var(--glass-2);
>   box-shadow: 0 0 0 3px var(--accent-glow);
> }
> ```

### 2.4 Disabled

```css
.btn:disabled,
.input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.3);
}
```

---

## 3 · 状态过渡

### 3.1 Toggle（开关）

```css
.toggle {
  position: relative;
  width: 40px; height: 22px;
  background: var(--glass-1);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  cursor: pointer;
  transition: background var(--dur-base) ease-out;
}
.toggle::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: var(--ink-3);
  border-radius: 50%;
  transition: all var(--dur-base) cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle.on {
  background: linear-gradient(135deg, var(--ok), var(--cyan));
  border-color: transparent;
}
.toggle.on::after {
  left: 20px;
  background: white;
  box-shadow: 0 0 6px rgba(255,255,255,0.5);
}
```

**反馈**：开启时 + 一次轻微的 0.4x 闪亮（用 box-shadow pulse 模拟 LED）：
```css
@keyframes led-on {
  0% { box-shadow: 0 0 0 0 rgba(110,231,183,0.5); }
  100% { box-shadow: 0 0 0 8px rgba(110,231,183,0); }
}
.toggle.on { animation: led-on 600ms ease-out; }
```

### 3.2 Tabs / Range tabs

```css
.tab {
  background: transparent; border: 0;
  color: var(--ink-3);
  padding: 7px 16px;
  transition: color var(--dur-fast) ease-out;
}
.tab.on {
  background: var(--glass-2);
  color: var(--ink);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}
```

> 进阶版：滑动的下划线（`::after` + `transform: translateX`）— 大型 tab 群（设备详情页 Live/History/Control/Diagnostics）推荐用。

### 3.3 Pill 状态变化

状态变化时建议**保留旧状态 200ms 再淡出**，避免数字跳变：
```css
.pill {
  transition: all var(--dur-base) ease-out;
}
.pill.ok { animation: pill-flash-ok 800ms ease-out; }
@keyframes pill-flash-ok {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 var(--ok-glow); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 8px transparent; }
  100% { transform: scale(1); }
}
```

### 3.4 Slider

```css
.slider::-webkit-slider-thumb {
  transition: transform var(--dur-fast) ease-out, box-shadow var(--dur-fast) ease-out;
}
.slider:hover::-webkit-slider-thumb {
  transform: scale(1.15);
  box-shadow: 0 0 12px rgba(167,139,250,0.7);
}
.slider:active::-webkit-slider-thumb {
  transform: scale(1.25);
}
```

---

## 4 · 数据动效

### 4.1 数字滚动（counter）

**禁止**直接修改 DOM textContent（会闪）。用 `requestAnimationFrame` 在 ~500ms 内插值：

```js
function animateNumber(el, from, to, duration = 500) {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const val = from + (to - from) * eased;
    el.textContent = val.toFixed(1);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

**触发时机**：SSE 收到新 sample 时，对**变化幅度 > 5%**的数字才动画（避免无意义抖动）。

### 4.2 折线图 path 描边

```js
function animatePath(pathEl, duration = 800) {
  const len = pathEl.getTotalLength();
  pathEl.style.strokeDasharray = len;
  pathEl.style.strokeDashoffset = len;
  pathEl.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  requestAnimationFrame(() => {
    pathEl.style.strokeDashoffset = 0;
  });
}
```

**Area 图**：先画底部的 fill 渐变（fade in 300ms），再描线（500ms）。

### 4.3 圆环进度（AQI / Gauge）

```js
function animateRing(circleEl, fromOffset, toOffset, duration = 1200) {
  circleEl.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  circleEl.setAttribute('stroke-dashoffset', fromOffset);
  requestAnimationFrame(() => {
    circleEl.setAttribute('stroke-dashoffset', toOffset);
  });
}
```

**中心数字**：和环同步滚动（offset 0% → 100% 期间数字 from → to）。

### 4.4 Sparkline 入场

短的 spark 用 200ms 即可；不需要描边动画，直接 fade + 轻微下移：
```css
@keyframes spark-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.spark { animation: spark-in 300ms ease-out; }
```

### 4.5 实时数据进入（push 时）

新 sample 到达时**只在视觉上 +1 帧高亮**，不要闪：
```js
function pulseCell(el) {
  el.classList.remove('flash');
  void el.offsetWidth; // force reflow
  el.classList.add('flash');
}
```
```css
.flash {
  animation: cell-flash 600ms ease-out;
}
@keyframes cell-flash {
  0% { background: rgba(167,139,250,0.18); }
  100% { background: transparent; }
}
```

---

## 5 · 反馈（toast / tooltip / modal）

### 5.1 Toast

入场：右上角 slide-in + fade，spring easing，250ms。
出场：fade + 8px 上移，200ms。
停留：3s（critical 5s，info 2s）。

```css
.toast {
  position: fixed; top: 24px; right: 24px;
  background: var(--glass-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  padding: 12px 16px;
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow-2), var(--shadow-inset);
  animation: toast-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(40px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
```

类型变体（用左边 3px 竖条颜色区分）：`toast.ok / toast.warn / toast.crit / toast.info`。

### 5.2 Tooltip

触发：hover 100ms 后才出现（避免鼠标快速划过闪烁）。
```css
.tooltip {
  position: absolute;
  background: rgba(0,0,0,0.7);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-sm);
  padding: 6px 10px;
  font-size: 11px;
  color: var(--ink);
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: all 150ms ease-out;
}
.trigger:hover .tooltip,
.trigger:focus-visible .tooltip {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 100ms;
}
```

### 5.3 Modal

入场：backdrop 淡入 + 内容 spring 缩放 0.95→1。
```css
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
  animation: backdrop-in 200ms ease-out;
}
.modal-content {
  animation: modal-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes backdrop-in {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

> 锁滚动：`document.body.style.overflow = 'hidden'`。
> 关闭：按 Esc / 点 backdrop / 点 close 按钮。
> 危险 modal（"Restore" / "Reboot"）：primary 按钮 focus 默认选中（防止误触 enter），但要等用户主动 Tab 离开再激活。

---

## 6 · 页面切换

```css
.page {
  display: none;
}
.page.active {
  display: block;
  animation: page-in 300ms ease-out;
}
@keyframes page-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

> Sidebar 激活项：背景立即变化（150ms） + 圆点 200ms 出现（不要延迟）。

---

## 7 · 加载 / 空 / 错误 三态

### 7.1 Loading

**不要**全屏 spinner。用 3 种方案之一：

#### a. Skeleton（适合 list / card grid）
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--glass-1) 0%,
    var(--glass-2) 50%,
    var(--glass-1) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s linear infinite;
  border-radius: var(--r-sm);
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### b. 内联 shimmer（适合数字 / 文本）
跟骨架同色 + shimmer 动画，height: 1em。

#### c. 进度脉冲（适合 hero / 大卡）
卡中央放一个 8px 圆点 + pulse 动画 + "Loading…" 文字。

### 7.2 Empty state

居中显示：
- 大 icon（48px，ink-3 颜色）
- 主标题（14px 600，ink）
- 副说明（12px，ink-3，最多 2 行）
- 可选 action 按钮

```html
<div class="empty-state">
  <div class="empty-icon">📡</div>
  <h3>No devices yet</h3>
  <p>Add a device to start collecting data.</p>
  <button class="btn primary">+ Add device</button>
</div>
```

### 7.3 Error state

跟 empty 同样的结构，但用 crit 色边框 + 警示 icon + 重试按钮：
```html
<div class="error-state">
  <div class="error-icon">⚠</div>
  <h3>Couldn't load devices</h3>
  <p>Connection refused. Check that envctrl is running.</p>
  <button class="btn">Retry</button>
</div>
```

---

## 8 · 状态点（Pulse）

3 种 pulse：

#### 静态（默认）
```css
.pulse-static { background: var(--ok); box-shadow: 0 0 6px var(--ok-glow); }
```

#### 呼吸（在线但有波动）
```css
@keyframes pulse-breath {
  0%, 100% { box-shadow: 0 0 6px var(--ok-glow); }
  50%      { box-shadow: 0 0 12px var(--ok-glow), 0 0 20px rgba(110,231,183,0.2); }
}
.pulse-breath { animation: pulse-breath 2.5s ease-in-out infinite; }
```

#### 警告（warn 状态）
```css
@keyframes pulse-warn {
  0%, 100% { box-shadow: 0 0 6px var(--warn-glow); }
  50%      { box-shadow: 0 0 14px var(--warn-glow); }
}
.pulse-warn { animation: pulse-warn 1.5s ease-in-out infinite; }
```

> 房间里设备位置点（Room Map）用扩散环：
> ```css
> @keyframes ripple {
>   0% { r: 6; opacity: 0.6; }
>   100% { r: 14; opacity: 0; }
> }
> ```
> 配合 SVG `<animate>` 实现，2.5s 一次循环。

---

## 9 · 减少动效（可访问性）

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .orb, .pulse, .ripple { display: none; }
}
```

保留的：
- toggle / slider 颜色过渡（必要反馈）
- focus outline（必要）
- modal/toast 出现（但去掉 spring，去掉 scale）

---

## 10 · 性能规则

1. **永远用 `transform` + `opacity`**，不要动 `top/left/width/height`（除非是 chart 数字本身的属性）
2. **blur 元素不能 transform**（会重绘），用 `will-change: backdrop-filter` 提示
3. **多个 orb / pulse 用 CSS 动画**，不要 JS setInterval
4. **数字滚动 throttle 到 100ms**（不是每个 sample 都重绘）
5. **page 切换时禁用前一页的 transition**，避免重叠

---

## 11 · 不做清单

- ❌ 弹窗抖动 / shake
- ❌ 数字随机翻转
- ❌ 鼠标轨迹粒子
- ❌ 大于 300ms 的遮罩淡入
- ❌ 模态出现时的 parallax
- ❌ 自动播放视频 / 音频
- ❌ 滚动触发的逐字渐入（耗性能且干扰读数）
- ❌ 鼠标移开时还在跑的 transition
