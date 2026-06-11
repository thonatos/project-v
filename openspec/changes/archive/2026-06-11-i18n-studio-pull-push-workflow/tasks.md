## 1. 引入 i18next-cli 与配置

- [x] 1.1 为 i18n-studio 添加 devDependency `i18next-cli`（pin 具体版本,不进运行时 bundle）
- [x] 1.2 新增 `packages/apps/i18n-studio/i18next.config.ts`:`locales` 对齐 generated 语种集、`primaryLanguage: 'zh-cn'`、`extract.input: ['app/**/*.{ts,tsx}']`、`extract.output: 'app/i18n/locales/{{language}}/{{namespace}}.json'`、`keySeparator: '.'`、`indentation: 2`、`sort: true`
- [x] 1.3 配置 `preservePatterns` 保留运行时动态 key（`landing:features.*`,对应 features.tsx 的 `t(\`features.${f.key}.title\`)`),`removeUnusedKeys: true` 清理已删除静态 key,`functions`/`useTranslationNames` 与运行时一致
- [x] 1.4 `package.json` 增 `i18n:extract` 脚本;`.env.example` 补充说明（若有新增配置）

## 2. 验证提取产物对齐

- [x] 2.1 在现有源码上跑一次 `i18n:extract`,确认产物落入 `locales/<lang>/<ns>.json` 嵌套路径、2 空格缩进、key 排序,且与现有 JSON diff 干净
- [x] 2.2 确认提取的 ns 归属与运行时 `useTranslation('<ns>')` 一致,无非翻译同名 `t(...)` 误报（必要时调 `functions`/`ignore`）
- [x] 2.3 确认 extract 产物可被既有 `i18n:codegen` 直接消费,`generated.ts` 重新生成无异常

## 3. 重构 push

- [x] 3.1 重写 `scripts/i18n-push.mjs`:流程先调用 `i18n:extract`（或要求调用方已 extract）刷新本地 zh-cn key 集合
- [x] 3.2 `GET /snapshot/:slug/zh-cn` 取系统现有 key 集合,与本地 zh-cn key（经 flatten 转 flat key）求差集
- [x] 3.3 仅把新增 key import 到 `zh-cn`（write token 鉴权,经 dotenv 读凭据）,打印新增了哪些 key
- [x] 3.4 既有翻译不被覆盖;缺凭据/接口非 2xx 时非零退出,不静默失败

## 4. 调整 pull 占位语义

- [x] 4.1 `scripts/i18n-pull.mjs` 保留「先查 meta 清单、回写 _meta.json、逐语种拉取」既有行为
- [x] 4.2 以本地 zh-cn key 全集（extract 产物）为应存在 key 基准,对系统某语种未翻译的 key 写占位（空串）
- [x] 4.3 写入仍走 unflatten → nested JSON;保证 codegen/build 不出现裸 key;占位不回写 studio

## 5. 抽离 studio 界面硬编码文案

- [x] 5.1 用 `i18next-cli lint` 扫出 `app/routes/*`、`app/components/*` 中硬编码中文文案候选（排除 api.* 的 HTTP/JSON 文本）
- [x] 5.2 将高价值区域硬编码中文改写为 `t('ns.key')`,补充对应 `useTranslation` 绑定,中文文案填入 `locales/zh-cn/<ns>.json`（本批:login/register 客户端 JSX → `auth.*`）
- [x] 5.3 运行 `i18n:extract` 确认新 key 落入本地资源;codegen + typecheck 验证界面无裸文案（push/pull 回灌需运行中的 studio + 凭据,留待联调环境执行）

## 6. 编排与测试

- [x] 6.1 让 `i18n:push` 先 extract;提供 `i18n:extract:ci`（`i18next-cli extract --ci`）供 CI 检测「源码新增 key 但未提交资源」的漂移
- [x] 6.2 单测 push diff（`diffNewEntries`,仅推新增、不覆盖既有）与 pull 占位补齐（`fillPlaceholders`,不覆盖既有译文、不可变输入）
- [x] 6.3 全量 `pnpm -F i18n-studio i18n:codegen && typecheck && build && test` 通过（189 测试,build 成功,oxlint 仅 2 个 pre-existing 警告）

## 7. 文档与规范同步

- [x] 7.1 更新 `app/docs/guide.md`：新增「界面文案同步(extract → push → 翻译 → pull)」章节,含 i18next-cli 用法、「组件只写 t('ns.key')」约定、CI 漂移检测
- [x] 7.2 `public/openapi.json` 无需改动:push/pull 复用既有端点(`/snapshot/:slug/:locale`、`/snapshot/:slug/meta`、`/api/namespaces/:slug/import`)均已收录;`.env.example` 已含全部配置,无新增
