# 实施任务

## 1. 依赖与语言原语

- [x] 1.1 在 `packages/apps/i18n-studio/package.json` 新增 `i18next`、`react-i18next`、`dotenv` 依赖并安装（`pnpm -F i18n-studio install`）
- [x] 1.2 新增 `app/lib/i18n.ts`：定义 `Lang` 类型、`SUPPORTED_LANGS = ['zh-CN','en']`、`DEFAULT_LANG = 'zh-CN'`、`isLang()` 守卫（客户端安全）
- [x] 1.3 新增 `app/lib/i18n.server.ts`：`getLang(request)` 读 `lang` cookie（解码失败/非法回退默认）、`createLangCookie(lang)`（Path=/、Max-Age 一年、SameSite=Lax），re-export 原语

## 2. i18next 实例与资源

- [x] 2.1 新增资源目录 `app/i18n/locales/{zh-CN,en}/`，含 `common.json`、`landing.json` 两个 namespace 文件
- [x] 2.2 新增 `app/i18n/config.ts`：用 `i18next` + `initReactI18next` 创建实例，静态 import resources，配置 `fallbackLng: 'zh-CN'`、`defaultNS: 'common'`、`react.useSuspense: false`、关闭浏览器语言自动检测
- [x] 2.3 整理首批文案：将公共外壳 + Dashboard 框架（app-shell 导航/菜单、landing hero/features、dashboard 导航/布局标签）的中英文混杂文案统一抽取为 key，分别填入 zh-CN/en 资源

## 3. SSR 接线与一致性

- [x] 3.1 `app/entry.server.tsx`：import i18next 实例完成服务端初始化
- [x] 3.2 `app/entry.client.tsx`：import 同一实例完成客户端初始化
- [x] 3.3 `app/root.tsx`：loader 调 `getLang()` 返回 `lang`；`Layout` 中 `<html lang={lang}>`、`i18n.changeLanguage(lang)`、用 `<I18nextProvider>` 包裹 children（替换写死的 `lang="zh-cn"`）

## 4. 语言切换路由与控件

- [x] 4.1 新增 `app/routes/api.lang.tsx` action：解析 JSON/form 的 `lang`，`isLang()` 校验，合法则 `Set-Cookie` 返回 `{ ok, lang }`，非法返回 4xx；`loader` 返回 405
- [x] 4.2 在 `app/routes.ts` 注册 `/api/lang`（flatRoutes 文件约定式，自动注册，无需手改）
- [x] 4.3 新增语言切换组件（`app/components/lang-toggle.tsx`，复用 ToggleGroup 风格），`useFetcher` 提交到 `/api/lang`，成功后 `i18n.changeLanguage` 即时切换
- [x] 4.4 将语言切换控件挂入 `app/components/app-shell.tsx` 头部（与 ThemeToggle 并列），透传 `lang`

## 5. 文案替换

- [x] 5.1 用 `useTranslation` 替换 app-shell（导航、菜单项、登录/注册/Logout 等）硬编码文案为 key
- [x] 5.2 替换 landing hero/features 文案为 key
- [x] 5.3 替换 dashboard 框架（导航/布局标签）硬编码文案为 key，核对首批范围内无残留中英混杂

## 6. write token scope

- [x] 6.1 `app/db/schema.ts`：`api_tokens.scope` 枚举加 `write`，`pnpm -F i18n-studio db:generate` 生成迁移
- [x] 6.2 `app/lib/api-token.server.ts`：`generateTokenString` 为 `write` 用 `wr_` 前缀；`verifyToken`/`requireApiToken` 支持 `write`
- [x] 6.3 `app/routes/api.namespaces.$slug.import.tsx`：改为先尝试 `write` token（绑定 namespace 校验），否则回退 session role(admin/editor)，二者满足其一放行
- [x] 6.4 `app/routes/api.namespaces.$slug.tokens._index.tsx` action 与 token 创建 UI：scope 校验与选项加入 `write`

## 7. 自托管：namespace seed 与同步脚本

- [x] 7.1 提供界面文案 seed：`studio-ui` namespace（已创建，locale `zh-cn`/`en-us`、`public_read=1`）已就绪，seed 负责把首批抽取的 key/文案幂等 upsert 进去；确认与业务 namespace 隔离
- [x] 7.2 在 UI 为 `studio-ui` 创建一个 `write` token；新增 `.env.example`（含 `STUDIO_BASE_URL` / `STUDIO_NAMESPACE` / `STUDIO_WRITE_TOKEN`），把 token 写入本地 `packages/apps/i18n-studio/.env`，并将 `.env` 加入该 app 的 `.gitignore`（write token `wr_…` 已生成并写入 .env，.env 已被 gitignore）
- [x] 7.3 新增 `scripts/i18n-push.mjs`：顶部 `import 'dotenv/config'` 经 dotenv 加载 `.env`，读 `STUDIO_BASE_URL`/`STUDIO_NAMESPACE`/`STUDIO_WRITE_TOKEN`，将本地 `locales/<lang>/*.json` 按 i18next ns 前缀展平为扁平 key，逐 locale 携带 `write` token 调 `POST /api/namespaces/<STUDIO_NAMESPACE>/import`；打印每 locale 结果，缺凭据/失败非零退出
- [x] 7.4 新增 `scripts/i18n-pull.mjs`：读 `STUDIO_BASE_URL`/`STUDIO_NAMESPACE`，从 `GET /snapshot/<STUDIO_NAMESPACE>/:locale`（免 token；必要时 `export`）拉取各 locale，按 ns 前缀还原为 `locales/<lang>/<ns>.json` 写回
- [x] 7.5 在 `package.json` 新增 `i18n:push` / `i18n:pull` 脚本
- [x] 7.6 跑通闭环验证：seed → push → pull，确认本地资源与系统一致、文件结构可被构建消费（seed 47/locale → push 47/47 → pull 还原，嵌套结构无损往返，build 通过）

## 8. 浏览器运行时文案拉取

- [x] 8.1 在 root（hydration 后 effect）实现自写轻量 fetch：按当前 `lang` 请求 `GET /snapshot/studio-ui/:lang`，带 `If-None-Match`
- [x] 8.2 拉取成功后用 `i18n.addResourceBundle(lang, ns, data, true, true)` 深合并；仅当与当前文案有差异时合并，避免二次闪烁
- [x] 8.3 失败/304 静默回退已打包资源，不阻塞首屏、不抛错中断

## 9. 测试与验证

- [x] 9.1 新增 `tests/unit/` 语言 cookie 助手单测：默认回退、合法读写、非法值（含 `fr-fr`、解码失败）回退默认
- [x] 9.2 新增语言切换渲染/集成验证：`lang=en-us` 时外壳显示英文、`<html lang>` 为 `en-us`、切换后文案更新
- [x] 9.3 新增 `write` token 测试：`wr_` 前缀生成、`verifyToken('write')`、import 接受有效 write token、拒绝 readonly/已吊销/跨 namespace token
- [x] 9.4 新增 pull/push 契约验证：扁平 key ↔ i18next ns+key 转换正确；push 携带 write token 对 import、pull 对 snapshot/export 的请求结构正确；失败路径退出码正确
- [x] 9.5 新增运行时合并逻辑验证：拉取覆盖本地 fallback、失败回退、同值不重渲染
- [x] 9.6 运行 `pnpm -F i18n-studio typecheck && pnpm -F i18n-studio test && pnpm -F i18n-studio build`，并 `pnpm lint` 通过（typecheck 干净、143 tests 全过、build 成功、本次新增/改动文件 oxlint 0 warning；唯一 1 warning 在未改动的既有 api.server.ts）
- [x] 9.7 手动验证：默认 zh-cn 渲染、切换 en-us、刷新保持、控制台无 hydration mismatch、无 FOUC、运行时拉取生效（浏览器测试后只关 tab）（Playwright 验证：默认 zh-cn 译文渲染、切 en-us 全站英文、cookie 刷新保持、无 hydration mismatch、无 render setState 警告、双向切换 0 console error）
