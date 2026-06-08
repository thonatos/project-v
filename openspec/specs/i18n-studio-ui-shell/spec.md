## Purpose

定义 i18n-studio 的前端应用 shell:shadcn 组件库覆盖、应用 shell 现代化(header / 侧栏 / 用户菜单)、命令面板(Cmd+K)、深色模式 SSR 支持、页面标题规范、原生对话框替换。
## Requirements
### Requirement: shadcn 组件库扩充

i18n-studio 的 `app/components/ui/` SHALL 至少包含以下 shadcn/ui 组件，按 shadcn CLI 默认实现接入：`button`、`input`、`label`、`card`、`textarea`、`sonner`、`table`、`sheet`、`tabs`、`badge`、`avatar`、`skeleton`、`breadcrumb`、`command`、`separator`、`scroll-area`、`tooltip`、`toggle-group`、`dialog`、`dropdown-menu`。

#### Scenario: 必备组件齐全

- **GIVEN** `packages/apps/i18n-studio/app/components/ui/`
- **WHEN** 列出该目录下的 `.tsx` 文件
- **THEN** 文件名集合包含上述全部组件名（每个组件一个文件）

### Requirement: 应用 Shell 现代化

i18n-studio SHALL 提供统一的应用 shell:
- 顶部 header 包含品牌区、面包屑、用户菜单(DropdownMenu)、主题切换器、登出
- 侧边栏导航 SHALL 使用图标 + 文字,并 SHALL 在视口宽度 `< md` 时收起为 `Sheet` 抽屉
- 桌面端布局保留两列结构(侧栏 + 主内容),主内容区按 shadcn 默认密度
- `/dashboard` 区域 SHALL 由统一的 layout 路由 `dashboard.tsx` 在 loader 阶段集中调用 `requireUser` 与 `getTheme`,并通过 outlet context 把 `{ user, theme }` 下发给子路由;子路由 MUST NOT 各自重复调用 `requireUser` / `getTheme` 仅为 header 渲染所用

#### Scenario: 桌面端 shell 元素

- **GIVEN** 已登录用户访问 `/dashboard/:slug`
- **WHEN** 视口宽度 ≥ 1024px
- **THEN** 同时可见品牌区 / 面包屑 / 用户菜单触发器 / 主题切换器 / 图标化侧栏 / 主内容 Outlet

#### Scenario: 移动端侧栏抽屉

- **GIVEN** 已登录用户访问 `/dashboard/:slug`
- **WHEN** 视口宽度 < 768px 且点击 header 上的菜单按钮
- **THEN** 侧栏以 `Sheet` 形式从左侧滑入,包含与桌面端一致的导航项

#### Scenario: 面包屑使用 shadcn 组件

- **GIVEN** 任意 `/dashboard/:slug/...` 子路由
- **WHEN** 检查 header 实现
- **THEN** 面包屑由 `~/components/ui/breadcrumb` 渲染,按当前路由动态生成层级

#### Scenario: dashboard layout 集中托管 user / theme

- **GIVEN** `app/routes/dashboard.tsx` 的 loader 实现
- **WHEN** 检查源代码
- **THEN** loader 内调用 `requireUser` 与 `getTheme(request)`,通过 `<Outlet context={{ user, theme }} />` 下发;子路由(`dashboard._index.tsx` / `dashboard.new.tsx` / `dashboard.locales.tsx` / `dashboard.$slug.tsx`)的 loader 不再为 header 渲染目的而重复调用 `requireUser` / `getTheme`,而是从 `useOutletContext` 读取

### Requirement: 主战场页面重做

以下页面 SHALL 按现代后台标准重做,包含图标、Empty state、Skeleton 等基本要素,并使用 shadcn `Table` / `Select` / `Switch` / `Badge` / `Card` 等组件而非裸 `<table>` / `<select>` / 原生 `<input type="checkbox">`:

- `/dashboard`(namespace 列表)
- `/dashboard/:slug`(overview)
- `/dashboard/:slug/entries`(词条列表)
- `/dashboard/:slug/entries/:key`(词条编辑)
- `/dashboard/:slug/entries/:key/history`(词条历史)
- `/dashboard/:slug/sync`(跨空间同步)
- `/dashboard/:slug/tasks`(翻译任务)
- `/dashboard/:slug/members`(成员管理)
- `/dashboard/:slug/settings`(设置 + token 管理)
- `/dashboard/locales`(系统级语言库)
- `/login`、`/register`、`/dashboard/new`(表单页)

#### Scenario: namespace 卡片网格 + empty state

- **GIVEN** 已登录用户访问 `/dashboard`
- **WHEN** 当前用户没有任何命名空间
- **THEN** 渲染 EmptyState(图标 + 提示文案 + "新建命名空间"行动按钮),不再仅显示纯文本提示

#### Scenario: overview 图标统计卡

- **GIVEN** 用户访问 `/dashboard/:slug`
- **WHEN** loader 返回 `stats`
- **THEN** 至少 4 个统计卡(Entries / Drafts / Members / Locales)每张都包含 `lucide-react` 图标

#### Scenario: 词条列表使用 shadcn Table

- **GIVEN** 用户访问 `/dashboard/:slug/entries`
- **WHEN** 查看 DOM 结构
- **THEN** 表格由 `~/components/ui/table` 渲染(`Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell`),不使用裸 `<table>`

#### Scenario: 后台数据表统一使用 shadcn Table

- **GIVEN** 以下任一路由:`/dashboard/:slug/tasks`、`/dashboard/:slug/members`、`/dashboard/:slug/settings`、`/dashboard/:slug/entries/:key/history`
- **WHEN** 检查页面 DOM 与源码
- **THEN** 列表/表格由 `~/components/ui/table` 渲染,不存在裸 `<table>` 元素

#### Scenario: 后台下拉选择统一使用 shadcn Select

- **GIVEN** 以下任一路由:`/dashboard/:slug/sync`(源命名空间、策略选择)、`/dashboard/:slug/tasks`、`/dashboard/:slug/members`(角色选择)、`/dashboard/:slug/settings`(token scope 选择)
- **WHEN** 检查源码
- **THEN** 选择控件由 `~/components/ui/select` 渲染,不存在裸 `<select>` 元素(`<input type="hidden">` 用于序列化值合规)

#### Scenario: 后台布尔开关使用 shadcn Switch

- **GIVEN** `/dashboard/:slug/sync`(autoPublish / dryRun)、`/dashboard/:slug/settings`(publicRead)
- **WHEN** 检查源码
- **THEN** 控件使用 `~/components/ui/switch`,不再使用原生 `<input type="checkbox">`

#### Scenario: 词条编辑页 publish/discard 不刷新整页

- **GIVEN** 用户在 `/dashboard/:slug/entries/:key` 编辑某条 draft 翻译
- **WHEN** 点击 "Publish v<n>" 或 "Discard"
- **THEN** 客户端通过 `fetch` 调用对应 API 后,使用 `useRevalidator().revalidate()` 触发 loader 重新执行,UI 不调用 `window.location.reload()`、不发生整页刷新

#### Scenario: 新建 token 后明文带复制按钮

- **GIVEN** superuser 在 `/dashboard/:slug/settings` 创建 readonly / task token
- **WHEN** action 返回 plaintext
- **THEN** 页面在明文展示区域同时渲染一个 lucide `Copy` 图标按钮,点击后调用 `navigator.clipboard.writeText(plaintext)`;成功后 `sonner` toast 显示"已复制",失败时显示"复制失败,请手动选择"

#### Scenario: 批量删除 / discard 并发执行

- **GIVEN** 用户在 `/dashboard/:slug/entries` 选中多条词条并触发 "Delete" 或 "Discard drafts"
- **WHEN** 客户端发起批量请求
- **THEN** 使用 `Promise.allSettled` 并发执行(而非循环 `await` 串行);全部完成后用 toast 汇总成功/失败计数

### Requirement: 全局命令面板（Cmd+K）

i18n-studio SHALL 在所有已认证页面提供命令面板,绑定 `⌘K` / `Ctrl+K` 全局快捷键。命令面板的"当前 namespace 上下文"SHALL 从 URL 路径前缀 `/dashboard/<slug>` 解析(在 root layout 的 loader 内通过 `request.url.pathname.match(/^\/dashboard\/([^/]+)/)` 获取),不再使用废弃的 `/ns/<slug>` 形态。

#### Scenario: 全局快捷键

- **GIVEN** 已登录用户处于任意非输入框焦点
- **WHEN** 按下 `⌘K`(macOS)或 `Ctrl+K`(其他平台)
- **THEN** 命令面板对话框打开

#### Scenario: 命令面板内容分组

- **GIVEN** 已打开的命令面板,且当前路径属于 `/dashboard/<slug>/...`
- **WHEN** 用户未输入查询
- **THEN** 至少呈现以下分组:
  - "Navigate":当前命名空间内 Overview / Entries / Tasks / Sync / Members(若 admin) / Settings(若 admin)等页面
  - "Switch namespace":当前用户参与的命名空间列表
  - "Theme":切换 Light / Dark / System
  - "Help":打开文档

#### Scenario: 词条 prefix 搜索

- **GIVEN** 命令面板已打开且当前路径属于 `/dashboard/<slug>/...`
- **WHEN** 用户输入 ≥ 2 个字符
- **THEN** 在 250ms 防抖后通过 `useFetcher` 调用 `GET /api/namespaces/:slug/entries?prefix=<input>`,并以 "Entries" 分组展示前若干条匹配的 key

#### Scenario: 在非 dashboard 路径上无 namespace 上下文

- **GIVEN** 已登录用户处于 `/`、`/docs`、`/dashboard`(列表页本身)等不含 `<slug>` 的路径
- **WHEN** 打开命令面板
- **THEN** "Navigate"分组与"Entries 搜索"不渲染;仅显示"Switch namespace" / "Theme" / "Help" / "System"(若 superuser)

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

所有渲染 HTML 的路由 SHALL 通过 React Router `meta()` 导出页面标题,标题 SHALL 形如 `"<Page> · <Namespace?> · i18n-studio"`,使用中点 ` · ` 分隔,末尾固定 `i18n-studio`。

#### Scenario: 顶级路由标题

- **GIVEN** 渲染 HTML 的顶级路由
- **WHEN** 浏览器加载页面
- **THEN** `<title>` 取自下表:

| 路由 | title |
| ---- | ----- |
| `_index`(landing) | `i18n-studio · 多语言词条管理工作流` |
| `dashboard._index` | `Namespaces · i18n-studio` |
| `login` | `Login · i18n-studio` |
| `register` | `Register · i18n-studio` |
| `dashboard.new` | `New namespace · i18n-studio` |
| `dashboard.locales` | `Locales · i18n-studio` |

#### Scenario: 命名空间内路由标题

- **GIVEN** 已进入命名空间 `slug=docs` `name=Docs` 的页面
- **WHEN** 浏览器加载页面
- **THEN** `<title>` 取自下表:

| 路由 | title |
| ---- | ----- |
| `dashboard.$slug._index` | `Overview · Docs · i18n-studio` |
| `dashboard.$slug.entries._index` | `Entries · Docs · i18n-studio` |
| `dashboard.$slug.entries.$key._index` | `<key> · Docs · i18n-studio` |
| `dashboard.$slug.entries.$key.history` | `History · <key> · Docs · i18n-studio` |
| `dashboard.$slug.tasks` | `Tasks · Docs · i18n-studio` |
| `dashboard.$slug.sync` | `Sync · Docs · i18n-studio` |
| `dashboard.$slug.members` | `Members · Docs · i18n-studio` |
| `dashboard.$slug.settings` | `Settings · Docs · i18n-studio` |

#### Scenario: snapshot 通道不要求 title

- **GIVEN** `snapshot.$slug._index` 与 `snapshot.$slug.$locale` 路由仅返回 JSON / `Response`,不渲染 HTML
- **WHEN** 检查其实现
- **THEN** 该路由可不导出 `meta()`,本规范不对其生效

#### Scenario: ErrorBoundary 标题

- **GIVEN** 路由渲染失败
- **WHEN** ErrorBoundary 接管渲染
- **THEN** 404 错误标题为 `404 · i18n-studio`,其他错误为 `Error · i18n-studio`

#### Scenario: API 路由不要求 title

- **GIVEN** 任何 `app/routes/api.*` 或 `app/routes/logout.tsx` 等仅返回 JSON / Response 的路由
- **WHEN** 检查其实现
- **THEN** 该路由可不导出 `meta()`,且本规范不对其生效

### Requirement: 用浏览器原生确认对话框已被替换

i18n-studio SHALL 不在客户端代码中调用 `window.alert` / `window.confirm` / `window.prompt`,所有用户确认与提示 MUST 使用 `Dialog`(确认对话框)与 `sonner` toast(结果反馈)。对**高破坏性**操作(包括但不限于:禁用 builtin locale、删除 namespace、移除最后一名 admin、新建命名空间默认 locale 缺失等可能导致系统级回归的步骤),Dialog 二次确认 SHALL 作为强制步骤。

#### Scenario: 客户端不再调用原生对话框

- **GIVEN** `app/` 子树下所有 `.ts` / `.tsx` 文件
- **WHEN** 全文搜索 `\balert\(`、`\bconfirm\(`、`\bprompt\(`(排除字符串字面量与注释)
- **THEN** 不存在调用浏览器原生 `alert/confirm/prompt` 的代码

#### Scenario: 禁用 builtin locale 强制二次确认

- **GIVEN** superuser 在 `/dashboard/locales` 列表中点击 builtin locale 行的"禁用"按钮
- **WHEN** 视图层处理点击
- **THEN** 不立即提交禁用,而是先打开 `Dialog` 二次确认,文案明确提示"禁用后,新建 namespace 默认会无 X 可选";仅当用户在 Dialog 中点击"确认"才发起 toggle 请求

### Requirement: 文档 frontmatter 解析使用成熟库

i18n-studio 的 `app/lib/docs.ts` SHALL 使用 `gray-matter` 解析 markdown 文件的 frontmatter,不再使用自写正则按 `:` split 的方式,以正确处理 value 中含有 `:`、中文冒号、引号转义等场景。

#### Scenario: 解析含中文冒号的 description

- **GIVEN** 一篇 markdown frontmatter 的 description 字段为 `把 X：变成 Y`(含中文全角冒号)
- **WHEN** `getDocBySlug` 解析该文件
- **THEN** 返回的 `Doc.description` 完整等于 `"把 X：变成 Y"`,不被截断

#### Scenario: 解析含英文冒号的 title

- **GIVEN** 一篇 markdown frontmatter 的 title 字段为 `Guide: Quick start`
- **WHEN** `getDocBySlug` 解析该文件
- **THEN** 返回的 `Doc.title` 完整等于 `"Guide: Quick start"`,不被截断

#### Scenario: 不含 frontmatter 的 markdown 仍可解析

- **GIVEN** 一篇 markdown 文件没有 `---` frontmatter 块
- **WHEN** `getDocBySlug` 解析该文件
- **THEN** 返回 `Doc` 对象,`title` fallback 为 slug,`description` 为空字符串,`content` 为该文件 markdown body 渲染后的 HTML

