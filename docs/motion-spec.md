# HarryXin Motion Spec

## 1. Motion principles

- 视觉语义：**实验室启动 / signal acquire**。克制、精确、可中断，不做全屏加载器。
- 不新增永久外框、区块底色或遮罩背景；沿用现有透明区块与连续网格背景。
- 动画只使用 `opacity`、`transform`；标题始终以完整字形淡入，不使用会切断下伸笔画的 `clip-path`。不动画尺寸、布局、滤镜或大面积阴影。
- 沿用现有缓动：`--ease: cubic-bezier(.2,.7,.2,1)`；强调动作使用 `--ease-spring: cubic-bezier(.16,1,.3,1)`。
- 页面入场与滚动显现必须是两个独立状态机。动画结束后移除临时 `will-change`，不得留下持续运行的 rAF。

## 2. Laboratory boot timeline（0–900ms）

完整导航与刷新时播放一次；BFCache 返回、页内锚点跳转不重播。首帧初态必须由 `<head>` 中的 prepaint class 建立，避免先显示再隐藏。

| 时间 | 对象 | 动作 |
|---|---|---|
| 首次绘制前 | 页面 | `<head>` 设置 `motion-enabled motion-preload`；双 rAF 后切换为 `is-entering`，内容保持可访问 |
| 0–180ms | 现有网格与氛围层 | 淡入至既有环境亮度，不创建新背景 |
| 80–320ms | H/X 装饰、顶栏与顶部线条 | 顶栏 `translateY(-10px) → 0`、淡入；现有 chrome 同步启动 |
| 220–560ms | 栏目标签与主标题 | 完整字形 `translateY(22px) → 0` 并淡入；每个可见帧都必须保留字母下伸笔画 |
| 360–680ms | 发音与简介 | 依次淡入并上移 |
| 520–800ms | 社交入口 | 四项依次上移、淡入，stagger 55ms |
| 700–900ms | 页面 | 所有对象 settle；移除 `is-entering` 与临时合成提示，保留 `is-entered` |

实现约束：

- 使用双 `requestAnimationFrame` 或一次明确的 style flush 后再从 `is-entering` 切换到 `is-entered`，不能复用当前单 rAF 的脆弱触发。
- 无 JS 时内容默认可见；JS 只做渐进增强。
- 滚动显现保持 one-shot；使用 `threshold: .12`、底部 `rootMargin: -14%`，让区块进入可读区域后再播放。

## 3. Navigable block states

适用对象：`.fact-link`、块级 `.card` 链接、`.show-feature`、`.social`、`.signal-link`、`.rlcard-project-links a`、`.footer-social`。导航与正文文本链接使用同一状态语义的轻量版本。

| 状态 | 视觉与时序 |
|---|---|
| **Default** | `translateY(0) scale(1)`；保持现有透明背景与边线，不补永久容器背景 |
| **Hover** | 仅 `pointer:fine`：220ms 内上移 4px、缩放至 1.006，临时高光淡入；项目卡片可叠加不超过 2° 的指针倾斜 |
| **Pressed** | 80–100ms 内回落至 `translateY(0) scale(.985)`；松开或取消立即返回 Default/Hover |
| **Focus** | `:focus-visible` 显示 2px accent outline、3px offset；可同步 accent 边线，但不得依赖 Hover 才可见 |
| **Leaving** | 所有已标记目标的普通主键／Enter 激活均触发：选中块缩至 .985，扫描层显示目标文字，420ms 后在当前标签页导航 |

交互规则：

- 每个块的整块可点击区域保持原生 `<a>` 语义。
- 已标记的站内及外部目标，普通左键点击或键盘 Enter 均拦截一次并添加 `is-leaving`；420ms 后使用原始 URL 在当前标签页导航。
- 下载、页内 hash、Meta/Ctrl/Shift/Alt 点击及非主键点击不得延迟，保持浏览器原生行为。
- `pageshow`（包括 BFCache）必须清除 `is-leaving`、禁用状态和临时 inline style。

```mermaid
stateDiagram-v2
    [*] --> Boot: full navigation / reload
    [*] --> Default: reduced motion, no JS, or BFCache
    Boot --> Default: 900ms settled
    Default --> Hover: pointerenter (fine pointer)
    Hover --> Default: pointerleave
    Default --> Focus: focus-visible
    Hover --> Focus: keyboard focus
    Focus --> Default: blur
    Default --> Pressed: primary pointerdown
    Hover --> Pressed: primary pointerdown
    Focus --> Pressed: Enter
    Pressed --> Default: cancel or non-route activation
    Pressed --> Leaving: marked destination
    Leaving --> [*]: navigate at 420ms
```

## 4. Reduced motion and accessibility

- `@media (prefers-reduced-motion: reduce)` 下：首帧直接进入最终视觉状态，不播放 boot、scroll reveal、位移、缩放或 420ms 离场等待。
- Hover/Pressed 可保留即时颜色与边线变化；Focus outline 始终保留。
- 动画期间不得锁定滚动、遮挡链接或改变 tab order；不使用 `aria-hidden` 隐藏真实内容。
- 主标题不得使用 `clip-path`、mask 或容器裁切；所有浏览器统一使用 `opacity + transform`。

## 5. Test matrix

| 场景 | 验收标准 |
|---|---|
| Desktop Chrome/Edge，fine pointer | 0–900ms 顺序正确；Hover、Pressed、Leaving 可中断且无跳帧 |
| Safari/Firefox | 主标题无 `clip-path`；动画全过程字形、焦点与导航完整 |
| Mobile/touch | 不出现粘滞 Hover；轻触有 Pressed 反馈，布局无位移 |
| Keyboard only | Tab 顺序不变；所有跳转块都有清晰 Focus；Enter 导航正常 |
| Reduced motion | 首帧全部可见；无位移、缩放、stagger 或 420ms 延迟 |
| 普通刷新、硬刷新、缓存命中 | 每次完整导航只播一次 boot；无 FOUC/先显示后隐藏 |
| 非零滚动位置刷新 | 当前可视内容不会长时间隐藏；scroll reveal 只播一次 |
| 已标记 destination route | 站内及外部目标均在 Leaving 精确 420ms 后导航；重复点击不重复排队 |
| 修饰键、中键、下载、hash | 不拦截浏览器默认行为，不等待 420ms |
| BFCache 返回 | 清理 Leaving，直接恢复 Default，不重播完整 boot |
| No JS | 所有内容和链接立即可见、可操作 |
| Performance | CLS 为 0；无超过 50ms 的入场长任务；1200ms 后无 boot 动画或 boot rAF；无永久新增 `will-change` |
