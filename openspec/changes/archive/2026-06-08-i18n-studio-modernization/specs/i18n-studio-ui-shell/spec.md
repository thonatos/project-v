## ADDED Requirements

### Requirement: shadcn 组件库扩充

i18n-studio 的 `app/components/ui/` SHALL 至少包含以下 shadcn/ui 组件，按 shadcn CLI 默认实现接入：`button`、`input`、`label`、`card`、`textarea`、`sonner`、`table`、`sheet`、`tabs`、`badge`、`avatar`、`skeleton`、`breadcrumb`、`command`、`separator`、`scroll-area`、`tooltip`、`toggle-group`、`dialog`、`dropdown-menu`。

#### Scenario: 必备组件齐全

- **GIVEN** `packages/apps/i18n-studio/app/components/ui/`
- **WHEN** 列出该目录下的 `.tsx` 文件
- **THEN** 文件名集合包含上述全部组件名（每个组件一个文件）

### Requirement: 应用 Shell 现代化

i18n-studio SHALL 提供统一的应用 shell：
- 顶部 header 包含品牌区、面包屑、用户菜单（DropdownMenu）、主题切换器、登出
- 侧边栏导航 SHALL 使用图标 + 文字，并 SHALL 在视口宽度 `< md` 时收起为 `Sheet` 抽屉
- 桌面端布局保留两列结构（侧栏 + 主内容），主内容区按 shadcn 默认密度

#### Scenario: 桌面端 shell 元素

- **GIVEN** 已登录用户访问 `/ns/:slug`
- **WHEN** 视口宽度 ≥ 1024px
- **THEN** 同时可见品牌区 / 面包屑 / 用户菜单触发器 / 主题切换器 / 图标化侧栏 / 主内容 Outlet

#### Scenario: 移动端侧栏抽屉

- **GIVEN** 已登录用户访问 `/ns/:slug`
- **WHEN** 视口宽度 < 768px 且点击 header 上的菜单按钮
- **THEN** 侧栏以 `Sheet` 形式从左侧滑入，包含与桌面端一致的导航项

#### Scenario: 面包屑使用 shadcn 组件

- **GIVEN** 任意 `/ns/:slug/...` 子路由
- **WHEN** 检查 header 实现
- **THEN** 面包屑由 `~/components/ui/breadcrumb` 渲染，按当前路由动态生成层级

### Requirement: 主战场页面重做

以下页面 SHALL 按现代后台标准重做，包含图标、Empty state、Skeleton 等基本要素：

- `/`（namespace 列表）
- `/ns/:slug`（overview）
- `/ns/:slug/entries`（词条列表）
- `/login`、`/register`、`/ns/new`（表单页）

#### Scenario: namespace 卡片网格 + empty state

- **GIVEN** 已登录用户访问 `/`
- **WHEN** 当前用户没有任何命名空间
- **THEN** 渲染 EmptyState（图标 + 提示文案 + “新建命名空间” 行动按钮），不再仅显示纯文本提示

#### Scenario: overview 图标统计卡

- **GIVEN** 用户访问 `/ns/:slug`
- **WHEN** loader 返回 `stats`
- **THEN** 至少 4 个统计卡（Entries / Drafts / Members / Locales）每张都包含 `lucide-react` 图标

#### Scenario: 词条列表使用 shadcn Table

- **GIVEN** 用户访问 `/ns/:slug/entries`
- **WHEN** 查看 DOM 结构
- **THEN** 表格由 `~/components/ui/table` 渲染（`Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell`），不使用裸 `<table>`

### Requirement: 全局命令面板（Cmd+K）

i18n-studio SHALL 在所有已认证页面提供命令面板，绑定 `⌘K` / `Ctrl+K` 全局快捷键。

#### Scenario: 全局快捷键

- **GIVEN** 已登录用户处于任意非输入框焦点
- **WHEN** 按下 `⌘K`（macOS）或 `Ctrl+K`（其他平台）
- **THEN** 命令面板对话框打开

#### Scenario: 命令面板内容分组

- **GIVEN** 已打开的命令面板
- **WHEN** 用户未输入查询
- **THEN** 至少呈现以下分组：
  - “Navigate”：当前命名空间内 Overview / Entries / Tasks / Sync 等页面
  - “Switch namespace”：当前用户参与的命名空间列表
  - “Theme”：切换 Light / Dark / System
- **AND** 用户在 entries 页且有选中行时，额外显示 “Publish selected drafts” 行动项

#### Scenario: 词条 prefix 搜索

- **GIVEN** 命令面板已打开
- **WHEN** 用户输入 ≥ 2 个字符
- **THEN** 在 250ms 防抖后通过 `useFetcher` 调用 `GET /api/namespaces/:slug/entries?prefix=<input>`，并以 “Entries” 分组展示前若干条匹配的 key

### Requirement: 深色模式（SSR 友好）

i18n-studio SHALL 支持 light / dark / system 三档主题，主题选择 SHALL 通过名为 `theme` 的 cookie 持久化，且 SHALL 由 server 在 root loader 阶段读取并写入 `<html className="…">` 以避免明显闪烁。

#### Scenario: cookie 写入

- **GIVEN** 已登录用户在 header 切换主题
- **WHEN** 客户端提交到 `POST /api/theme`，body 为 `{ theme: 'light' | 'dark' | 'system' }`
- **THEN** 响应设置 cookie `theme=<value>; Path=/; Max-Age=31536000; SameSite=Lax`

#### Scenario: SSR 应用主题

- **GIVEN** 浏览器在 cookie 中已有 `theme=dark`
- **WHEN** 用户首次请求任意页面
- **THEN** 服务器渲染的 HTML 中 `<html>` 元素已带 `class="dark"`，无需等待 hydration

#### Scenario: system 模式回退

- **GIVEN** cookie `theme=system` 或未设置
- **WHEN** 服务器渲染
- **THEN** `<html>` 默认渲染 `light`，客户端 hydrate 后通过 `prefers-color-scheme` 媒体查询应用真实偏好

#### Scenario: 非法 theme 值拒绝

- **GIVEN** 客户端向 `/api/theme` 提交非 `light/dark/system` 的值
- **WHEN** action 处理请求
- **THEN** 返回 400 且不写入 cookie

### Requirement: 页面标题规范

所有渲染 HTML 的路由 SHALL 通过 React Router `meta()` 导出页面标题，标题 SHALL 形如 `"<Page> · <Namespace?> · i18n-studio"`，使用中点 ` · ` 分隔，末尾固定 `i18n-studio`。

#### Scenario: 顶级路由标题

- **GIVEN** 渲染 HTML 的顶级路由
- **WHEN** 浏览器加载页面
- **THEN** `<title>` 取自下表：

| 路由 | title |
| ---- | ----- |
| `_index` | `Namespaces · i18n-studio` |
| `login` | `Login · i18n-studio` |
| `register` | `Register · i18n-studio` |
| `ns.new` | `New namespace · i18n-studio` |

#### Scenario: 命名空间内路由标题

- **GIVEN** 已进入命名空间 `slug=docs` `name=Docs` 的页面
- **WHEN** 浏览器加载页面
- **THEN** `<title>` 取自下表：

| 路由 | title |
| ---- | ----- |
| `ns.$slug._index` | `Overview · Docs · i18n-studio` |
| `ns.$slug.entries._index` | `Entries · Docs · i18n-studio` |
| `ns.$slug.entries.$key._index` | `<key> · Docs · i18n-studio` |
| `ns.$slug.entries.$key.history` | `History · <key> · Docs · i18n-studio` |
| `ns.$slug.tasks` | `Tasks · Docs · i18n-studio` |
| `ns.$slug.sync` | `Sync · Docs · i18n-studio` |
| `ns.$slug.members` | `Members · Docs · i18n-studio` |
| `ns.$slug.settings` | `Settings · Docs · i18n-studio` |

#### Scenario: snapshot 通道不要求 title

- **GIVEN** `snapshot.$slug._index` 与 `snapshot.$slug.$locale` 路由仅返回 JSON / `Response`,不渲染 HTML
- **WHEN** 检查其实现
- **THEN** 该路由可不导出 `meta()`,本规范不对其生效

#### Scenario: ErrorBoundary 标题

- **GIVEN** 路由渲染失败
- **WHEN** ErrorBoundary 接管渲染
- **THEN** 404 错误标题为 `404 · i18n-studio`，其他错误为 `Error · i18n-studio`

#### Scenario: API 路由不要求 title

- **GIVEN** 任何 `app/routes/api.*` 或 `app/routes/logout.tsx` 等仅返回 JSON / Response 的路由
- **WHEN** 检查其实现
- **THEN** 该路由可不导出 `meta()`，且本规范不对其生效

### Requirement: 用浏览器原生确认对话框已被替换

i18n-studio SHALL 不在客户端代码中调用 `window.alert` / `window.confirm` / `window.prompt`，所有用户确认与提示 MUST 使用 `Dialog`（确认对话框）与 `sonner` toast（结果反馈）。

#### Scenario: 客户端不再调用原生对话框

- **GIVEN** `app/` 子树下所有 `.ts` / `.tsx` 文件
- **WHEN** 全文搜索 `\balert\(`、`\bconfirm\(`、`\bprompt\(`（排除字符串字面量与注释）
- **THEN** 不存在调用浏览器原生 `alert/confirm/prompt` 的代码
