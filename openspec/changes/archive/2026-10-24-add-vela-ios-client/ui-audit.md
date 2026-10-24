# Vela iOS 界面规范（重做版）

> 取代此前的审计稿。目标设备：iPhone 17 Pro / iOS 26。定位：服务访问优先的轻量浏览器。

## 1. 原则

1. **用系统的，不自绘**：图标用 SF Symbols，开关用 `UISwitch`，分段用 `UISegmentedControl`，二级页面用原生 page sheet（带抓手、下滑关闭）；更多菜单是贴底的全宽面板。
2. **内容优先**：浏览时顶栏 44pt + 2pt 进度线，其余全部给 WebView。
3. **一种记录样式**：所有列表都是 inset-grouped（`Section` + `Cell`），不存在第二种行。
4. **一个容器只负责一层水平内边距**：页面 16pt，Cell 内 16pt；分隔线与标题左对齐。

## 2. 信息架构

```text
Shell
├─ 浮动 tab（贴底，避开 Home 指示条）：设备 · 服务 · 日志 · 我的 · 设置
│   选中只改变图标与文字颜色，不加背景
├─ 每个 tab 页：固定头部 [标题 | 服务页为 Vela logo]  [操作]，无分割线
└─ 浏览器（点服务进入，全屏，Safari 式）
    底部浮动工具栏 [后退][前进][服务名/设备][⋯][返回服务]
    页面滚动时收起为底部小条，点击或回滚展开
    WebView 使用固定真实边界：顶部 63pt，底部 84pt（3:4）；底部包含工具栏上方 12pt 留白
    底边用 UIKeyboardLayoutGuide 跟随键盘；工具栏收起只改变外观，不改变网页边界
    状态栏文字深浅跟随网页顶部颜色；App 不修改网页 DOM、viewport 或滚动位置
    ⋯ 菜单：设备信息 · 服务列表 · 重新加载 · 关闭服务 · 取消
Page sheets（模态栈）：设备详情 · 添加 Mac · 设备名称
    统一头部：[取消]……[完成/保存]，下方 22pt 左对齐标题 + 右侧操作
```

## 3. 页面

| 页面 | 头部操作 | 内容 |
|---|---|---|
| 设备 | 刷新、添加 Mac | 这台 iPhone、已添加的 Mac |
| 服务 | 刷新（左侧 logo） | 正在浏览卡片、按 Mac 分组的服务 |
| 日志 | 复制日志、刷新 | 级别分段、日志列表（不含诊断摘要） |
| 我的 | 检查连接 | 头像与状态、这台 iPhone、私人网络、签名、注销 |
| 设置 | — | 外观、Gravatar 隐私开关、详细日志、复制诊断信息、关于 |

## 4. 规范

**字号（14pt 基准，比例 8/7，行高落在 4pt 网格）**

| 角色 | 字号/行高 | 用途 |
|---|---|---|
| pageTitle / brand | 22/28 bold | 页面与弹出页标题、Vela 字样 |
| title | 18/24 semibold | 空状态标题、账户名 |
| heading | 16/20 semibold | 局部强调 |
| body / bodyStrong | 14/20 | 行标题、正文、按钮 |
| detail / sectionLabel | 12/16 | 行说明、分组标签、脚注 |
| micro | 11/14 | 状态标签、tab 文字 |

**尺寸**

| 项 | 值 |
|---|---|
| 屏幕边距 / 行内边距 | 16 / 16 × 10 |
| 单行行高 / 服务行 | 44 / 56 |
| 服务图块 / 图标图块 | 32 / 28 |
| 页面头部 | 52（44pt 控件行垂直居中） |
| 按钮 / 输入框 | 44 |
| 浮动 tab / 工具栏 | 56 / 52 |
| 浏览器顶部 / 底部边界 | 63 / 84（3:4） |
| 工具栏上方背景留白 | 12 |
| SF Symbol | 行内 14 · 按钮 18 · tab 16 · 箭头 12 · 空状态 36 |
| 服务页帆形 Logo | 28（与 pageTitle 的 28pt 行高一致） |
| 圆角 | 行 10 · 图块 8 · 弹出页 20 · 浮动栏 28 |

**配色**：与 macOS 一致的暖色；浅 `#A8491F` / 深 `#E08A5E`。

### 浏览器视口与键盘

1. `WKWebView` 不铺进状态栏和工具栏区域，而是使用一个真实、稳定的可视矩形：顶边距 63pt，底边距 84pt，比例为 3:4。
2. 底边距由 52pt 工具栏、20pt 浮起距离和 12pt 工具栏上方背景留白组成；工具栏应在周围背景中呈现有上下 padding 的浮动效果。
3. 工具栏收起为小条时只改变工具栏外观，禁止改变 WebView 的边界或 viewport 高度，否则 iOS 26 会在页面内部滚动时把 visual viewport 整体上移。
4. WebView 顶边约束为容器顶边 + 63pt；常态底边约束为容器底边 - 84pt（优先级 999）；必需约束要求 WebView 底边不低于 `UIKeyboardLayoutGuide.topAnchor`。键盘出现时由 UIKit 自动缩短真实视图，关闭时自动恢复。
5. 禁止通过键盘通知、手动 `setFrame`、`obscuredContentInsets`、`contentInset`、`contentOffset` 或 `visualViewport`/DOM 位移补偿处理键盘。这些方案会让 WebKit 的布局视口和视觉视口不同步，造成顶部遮挡和底部空白。
6. 顶部 63pt 与底部 84pt 位于 WebView 外，背景色取 `WKWebView.themeColor`；页面未声明主题色时依次回退 `underPageBackgroundColor` 和系统画布色。禁止截图取色、像素采样或由页面传递 CSS 色值。
7. 主题色同时用于计算状态栏文字深浅。网页只通知“主题可能变化”，具体颜色始终由原生 WebKit 语义属性读取。
8. 真机回归必须覆盖：普通滚动不整体上移；键盘打开后输入框可见；键盘关闭后页面回到原位；顶部保持 63pt；工具栏上方保持 12pt 背景留白；网页切换明暗主题后顶部、底部和状态栏文字同步变化。

## 5. 数据规范

- 状态、标签、分组、排序全部来自 `ui-shared/view-model.mjs`（`serviceBadge`、`serviceKindLabel`、`groupServicesByDevice`、`signedIn`、`userInitial`、`logRows`、`diagnosticSummaryRows`）。
- 隔离键 `${privateName}/${serviceId}`；最近访问存 `Storage["vela:last-service"]`。
- Gravatar 头像默认关闭；开启后仅对邮箱身份在 Core 内计算 SHA-256 并请求头像，失败或无邮箱时保持首字母回退。
- 模态栈 `store.modals`：`push` / `pop` / `dismiss(modal)`；每个模态有且仅有一个 sheet。

## 6. 能力对照 macOS

| macOS | iOS |
|---|---|
| 账户（状态、身份、改名、检查、注销） | 账户 sheet（全部保留，增加签名到期） |
| 设备列表 / 远端详情 / 添加 | 设备 sheet / 单台 Mac / 添加 Mac（Tailnet 发现 + 手输） |
| 转发 | 浏览器（WKWebView，独立数据存储） |
| 日志（筛选、计数） + 诊断复制 | 诊断日志 sheet |
| 设置（外观、详细日志） | 设置 sheet |
| 本机共享、服务编辑、TCP、性能 HUD | 不提供（iOS 非目标） |
