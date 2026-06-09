## Context

i18n-studio 基于 React Router v7 全栈（SSR + 客户端 hydration），UI 文案当前硬编码在组件里且中英文混杂。项目内已有一套成熟的 **theme cookie** 模式可直接借鉴：

- `app/lib/theme.ts`：客户端安全原语（类型、校验、resolve）。
- `app/lib/theme.server.ts`：cookie 读写助手（`getTheme` / `createThemeCookie`）。
- `app/routes/api.theme.tsx`：接收切换提交并 `Set-Cookie` 的 action。
- `app/root.tsx`：loader 读取 cookie → 注入 SSR（`<html className>`）；`ThemeToggle` 用 `useFetcher` 提交。

按 CLAUDE.md，i18n-studio 状态走 loaders/actions、**不**引入 Jotai 等外部状态库。语言状态天然适合 cookie + loader 模式。用户已确认：仅搭基础设施、zh-cn/en-us 双语、手写 cookie 方案（不引入 remix-i18next）、首批覆盖公共外壳 + Dashboard 框架。

**自托管闭环（dogfooding）现状盘点**——studio 已具备可直接复用的接口：

- `GET /api/namespaces/:slug/export`：扁平 K/V 导出，走 **session role**（admin/editor/viewer），支持 `?locale=` 多值与 `?at_version=`。
- `POST /api/namespaces/:slug/import`：扁平导入 `{ locale, entries, asDraft? }`，走 **session role**（admin/editor）。
- `GET /snapshot/:slug` 与 `GET /snapshot/:slug/:locale`：已发布文案快照，走 **public 或 readonly token**，带 `ETag` / `Cache-Control` / `X-Bundle-Version`，支持 `If-None-Match` 304——天然适合浏览器运行时拉取。
- token scope 仅 `readonly` / `task`（`app/lib/api-token.server.ts`）。

故新增的 pull 与浏览器运行时拉取**不需要新增后端接口**（直接复用 snapshot/export）；push 需要扩展鉴权——为 `import` 接口新增 `write` token 支持（见决策 9），但不新增路由。

**实例当前状态（已由用户在本地创建）**：`studio-ui` namespace 已存在，`locales=["zh-cn","en-us"]`、`default_locale=zh-cn`、`public_read=1`。受支持界面语言据此定为 `zh-cn`（默认/回退）与 `en-us`（小写、带地区的 BCP-47 代码，i18next 原生支持）。本地资源目录、cookie 取值、`<html lang>` 均使用这两个代码。

## Goals / Non-Goals

**Goals:**

- 引入 `i18next` + `react-i18next`，提供可扩展的界面国际化基础设施。
- 完整镜像 theme cookie 模式实现 `lang` 持久化与 SSR 注入，零 hydration mismatch、无 FOUC。
- 内置 `zh-cn`（默认/回退）与 `en-us` 资源，按 namespace 组织。
- 头部提供语言切换控件；首批 key 化公共外壳 + Dashboard 框架文案。
- 自托管闭环：界面文案托管在 studio 自己的 `studio-ui` namespace；提供 pull/push 脚本同步本地资源 ↔ 系统；浏览器运行时从 snapshot 拉取最新文案。

**Non-Goals:**

- 不翻译业务路由（entries/members/settings/tasks/sync 等）的全部文案——后续增量接入。
- 不引入 remix-i18next 或语言路由前缀（如 `/en/...`）。
- 不做按语言的代码分包/懒加载（资源体量小，直接全量打进 bundle）。
- 不新增后端**路由**——pull/运行时复用 snapshot/export，push 复用 import（仅为其扩展 `write` token 鉴权）。
- 不实现自动化的 key 提取（i18next-parser 之类）——首批文案手工抽取，脚本只负责本地资源与系统间搬运。

## Decisions

### 决策 1：手写 cookie 方案，不用 remix-i18next

**选择**：完全镜像现有 theme 模式，自建 `lang` cookie 助手 + `/api/lang` action + loader 注入。

**理由**：项目已有可复制的 theme 范式，团队熟悉；resources 在两侧静态 import 即可保证 SSR/CSR 一致，无需 remix-i18next 的按请求实例化与异步 backend。依赖更少，符合「最小化依赖」诉求。

**备选**：remix-i18next（社区标准）。被否，因为它为按请求语言检测/异步加载而设计，对「双语 + 资源直接打包」的简单场景偏重。

### 决策 2：单一 i18next 实例 + 静态资源 import

**选择**：在 `app/i18n/config.ts` 用 `i18next` + `initReactI18next` 创建实例，`resources` 直接静态 import `app/i18n/locales/{zh-cn,en-us}/*.json`，`fallbackLng: 'zh-cn'`，`react: { useSuspense: false }`（避免 SSR Suspense 复杂度）。

**理由**：资源同步可得，服务端与客户端用同一份配置 + 同一 `lng` 即天然一致，是规避 hydration mismatch 最稳妥的做法。`useSuspense: false` 让首帧直接拿到文案，无 loading 闪烁。

**关键点**：`lng` 必须来自 root loader 的注入值（见决策 3），客户端初始化时读取同一来源，不可让 i18next 自行做浏览器语言检测——否则 SSR（按 cookie）与 CSR（按 navigator）可能不一致。

### 决策 3：语言来源单向流动 loader → provider

**选择**：root loader 调 `getLang(request)` 读 cookie，返回 `lang`。`Layout` 拿到 `lang` 后：(a) 设 `<html lang={lang}>`；(b) 调 `i18n.changeLanguage(lang)` 并用 `<I18nextProvider>` 包裹 children。`entry.client.tsx` / `entry.server.tsx` 各自 import 同一实例完成初始化。

**理由**：cookie 是唯一真相源，loader 是唯一注入点，方向单一，SSR 与 hydration 必然同语言。

### 决策 4：cookie 名与校验

`lang` cookie，`Max-Age` 一年、`Path=/`、`SameSite=Lax`，与 theme 对齐。`SUPPORTED_LANGS = ['zh-cn', 'en-us']`，`isLang()` 守卫；非法值（含解码失败）一律回退 `zh-cn`。

### 决策 5：资源命名空间划分

首批划分两个 i18next namespace：`common`（外壳/导航/通用按钮：登录、注册、Logout、Dashboard、主导航、命令面板提示等）与 `landing`（hero/features 文案）。Dashboard 框架文案归入 `common`。后续业务路由可新增 `dashboard`、`entries` 等增量接入，互不影响。

> 注意：此处「namespace」是 **i18next 资源命名空间**；与 studio 的「业务 namespace」（`studio-ui`）是两个层面的概念，映射见决策 7。

### 决策 6：自托管——本地资源既是 fallback 也是 pull 产物

**选择**：`app/i18n/locales/{zh-cn,en-us}/*.json` 是**唯一本地资源真相源**，承担两个角色：(a) 静态 import 进 i18next 作为 SSR/首屏与离线 fallback；(b) `pull` 脚本写回的目标。开发流：编辑组件 key →`push` 到系统→在 studio 翻译/校对→`pull` 回本地→提交。

**理由**：保持「构建产物自包含」（首屏不依赖网络）的同时，让系统成为文案协作/翻译中心；pull 产物进 git，构建可复现。

**备选**：纯运行时加载、本地不留资源。被否，牺牲 SSR 首屏与离线可用，且 hydration 无确定文案。

### 决策 7：pull/push 走现有接口与鉴权

**映射**：studio 业务 namespace `studio-ui` ←→ 本地资源。studio 是扁平 K/V，i18next 资源是 `{ ns: { key: value } }`；脚本用 i18next namespace 作 key 前缀（`common.*`、`landing.*`），在扁平 key 与 ns+key 间转换。

**push（本地→系统）**：复用 `POST /api/namespaces/studio-ui/import`，按 locale 逐个 `{ locale, entries }`。该接口改为**同时接受 session role(admin/editor) 与 `write` token**（见决策 9）；脚本用 `write` token 鉴权，凭据经 `dotenv` 从 `packages/apps/i18n-studio/.env` 读取（`STUDIO_BASE_URL` / `STUDIO_WRITE_TOKEN`）。

> 凭据管理：pull/push 是脱离 Vite 的独立 `.mjs` 脚本，不会自动加载 `.env`，故脚本顶部显式 `import 'dotenv/config'`（或 `dotenv.config({ path: ... })`）。`.env` 放在 app 目录、加入 `.gitignore`，仓库仅提交 `.env.example` 作模板。

**pull（系统→本地）**：优先 `GET /snapshot/studio-ui/:locale`（已发布、`studio-ui` 已 `public_read=1` 故免 token、带 ETag）；需草稿时用 `GET /api/namespaces/studio-ui/export`（session role）。脚本按 ns 前缀还原为 `locales/<lang>/<ns>.json`。

**理由**：pull 零鉴权摩擦；push 用窄权限、可吊销的 token，避免在脚本/CI 中暴露管理员账号密码。

### 决策 9：新增 `write` token scope

**选择**：扩展 `api_tokens.scope` 枚举为 `['task','readonly','write']`，新增 `write` scope：

- `app/db/schema.ts`：枚举加 `write`，`drizzle-kit generate` 出迁移。
- `app/lib/api-token.server.ts`：`generateTokenString` 为 `write` 用 `wr_` 前缀；`verifyToken` / `requireApiToken` 支持 `write`。
- `app/routes/api.namespaces.$slug.import.tsx`：当前仅 `requireRole(admin/editor)`；改为**先尝试 `write` token，否则回退 session role**，两者满足其一即放行。
- token 管理（`api.namespaces.$slug.tokens._index.tsx` action 的 scope 校验 + 创建 UI）：增加 `write` 选项。

**理由**：`write` 是可吊销的窄权限凭据，适合脚本与未来 CI 自动 push，且不暴露账号密码。SQLite 的 `text enum` 仅运行时校验，迁移为纯增项、影响小、可逆。

**备选**：(a) 脚本用管理员 session 登录——零迁移但凭据是完整账号密码、不可吊销，CI 不友好；(b) seed 直连 SQLite——仅本地可用、绕过接口校验，不构成真正的 HTTP 同步。均被否（用户已选新增 token）。

**鉴权并存的安全点**：import 同时接受 session 与 write token，需保证 write token 仅授权其所属 namespace（`verifyToken` 已绑定 `namespaceSlug`，校验时比对 `params.slug`）。

### 决策 8：浏览器运行时拉取——自写轻量 fetch backend

**选择**：hydration 后客户端从 `GET /snapshot/studio-ui/:lang`（带 `If-None-Match`）异步拉取，`i18n.addResourceBundle(lang, ns, data, true, true)` 深合并覆盖。用**自写轻量 fetch**（挂 root effect），不引入 `i18next-http-backend`；失败静默回退打包资源。`studio-ui` 已设 `publicRead=1`，运行时拉取免 token。

**理由**：snapshot 已带 ETag/304 协商，自写逻辑零依赖、可控。

**二次闪烁规避**：仅当拉取值与当前有差异才 `addResourceBundle`；同值不触发重渲染。

**备选**：`i18next-http-backend`。功能够但需适配其约定，额外依赖收益不大。

### 语言切换时序

```
用户点击 LangToggle(en)
  │
  ├─ useFetcher.submit({ lang:'en-us' }) ──POST /api/lang──▶ action
  │                                                         │ isLang? ✔
  │                                                         │ Set-Cookie: lang=en
  │   ◀──────────────── { ok:true, lang:'en-us' } ────────────┘
  │
  ├─ 客户端：fetcher 完成后 i18n.changeLanguage('en-us')（即时切换，无刷新）
  │
  └─ 下次任意导航：loader 读到 lang=en-us → SSR 与 <html lang> 均为 en-us
```

### 自托管 pull/push 与运行时拉取时序

```
开发期（CLI）
  组件新增 key + 本地 zh-cn/en-us 资源
      │  pnpm i18n:push   (write token → POST /api/namespaces/studio-ui/import, 逐 locale)
      ▼
  studio 系统 studio-ui namespace ──(人工翻译/校对/发布)──┐
      │  pnpm i18n:pull   (GET /snapshot/studio-ui/:locale) │
      ▼                                                      │
  本地资源文件更新 → git 提交 → 构建固化 ◀──────────────────┘

运行期（浏览器）
  SSR 首屏(本地 bundle, 按 lang cookie) ─hydration─▶ 可用
      │  fetch GET /snapshot/studio-ui/:lang (If-None-Match)
      ▼
  200 → addResourceBundle 合并 → 界面更新最新文案
  304/失败 → 沿用本地 bundle（静默）
```

## Risks / Trade-offs

- **[Hydration mismatch]** → 决策 2/3 保证两侧同实例同 `lng`；resources 静态打包同步可得；禁用 i18next 浏览器语言自动检测。
- **[首屏闪烁 FOUC]** → `useSuspense: false` + SSR 已注入正确语言，首帧即正确文案。
- **[运行时拉取引发二次闪烁]** → 决策 8：仅差异时合并，同值不重渲染；拉取异步不阻塞首屏。
- **[`<html lang>` 写死 zh-cn]** → 改为动态 `lang`，注意 `zh-cn` 大小写在 HTML lang 属性中合法。
- **[文案抽取遗漏致中英混杂残留]** → 首批范围限定公共外壳 + Dashboard 框架；spec 场景要求该范围内无残留硬编码，按区域核对。
- **[脚本鉴权与凭据管理]** → push 用窄权限、可吊销的 `write` token，凭据仅经环境变量读取，不入库不入 git，不暴露账号密码；push 失败非零退出不静默；`studio-ui` 已 `publicRead=1`，pull 与运行时拉取免 token。
- **[write token 泄露/越权]** → token 经 sha256 存储、`wr_` 前缀便于识别、可随时吊销；`verifyToken` 绑定 namespace，import 时比对 `params.slug`，token 仅能写其所属 namespace。
- **[token scope 迁移]** → 纯增枚举项，SQLite text+enum 仅运行时校验，无数据回填；回滚即还原枚举重新 generate。
- **[bundle 体积]** → 双语小资源全量打包，影响可忽略；体量增长后再评估懒加载。

## Migration Plan

1. 加依赖 `i18next`、`react-i18next`，`pnpm -F i18n-studio install`。
2. 新增 `app/lib/i18n.ts`、`app/lib/i18n.server.ts`、`app/i18n/config.ts`、`app/i18n/locales/{zh-cn,en-us}/{common,landing}.json`。
3. 接线 `entry.client.tsx`、`entry.server.tsx`、`root.tsx`（loader + Provider + `<html lang>` + 运行时拉取 effect）。
4. 新增 `app/routes/api.lang.tsx`，在 `app/routes.ts` 注册。
5. 新增语言切换组件，挂入 app-shell 头部。
6. 抽取首批文案为 key，替换硬编码。
7. 新增 `write` token scope：改 `schema.ts` 枚举 → `pnpm -F i18n-studio db:generate` 出迁移 → 改 `api-token.server.ts`（`wr_` 前缀 + 校验）、`import` 路由（接受 write token）、token 创建路由与 UI（`write` 选项）。
8. 新增 `studio-ui` seed + `scripts/i18n-push.mjs`（write token）/ `scripts/i18n-pull.mjs`，在 `package.json` 加 `i18n:push` / `i18n:pull`。
9. 在 UI 为 `studio-ui` 创建一个 `write` token，写入环境变量；跑通闭环：seed → push → （翻译）→ pull，确认本地资源一致。
10. `pnpm -F i18n-studio typecheck`、`test`、`build` 验证。

**回滚**：见 proposal「Rollback Plan」。`git revert` 即可；token scope 迁移为纯增项、还原枚举重新 generate；`studio-ui` namespace 可整体删除；残留 `lang` cookie 无害。

## Open Questions

- 语言切换控件形态：复用 `ToggleGroup`（与 ThemeToggle 一致）还是图标 + DropdownMenu？倾向 ToggleGroup，实现期定稿。
- `en-us` 资源中专有名词（i18n-studio、Dashboard）是否保留英文原文——倾向保留品牌/术语原文。
- ~~`studio-ui` 是否公开读取~~ **已定**：`studio-ui` 已设 `public_read=1`，pull 与浏览器运行时拉取免 token。
- ~~push 鉴权~~ **已定**：新增 `write` scope token，push 用 write token（见决策 9）。
