## 1. Spike:验证 extract 单 ns 归属（最高风险前置）

- [x] 1.1 临时把 `i18next.config.ts` 的 `defaultNS` 设为 `studio-ui`,用一个最小样例(含 `t('common.nav.dashboard')`)跑 `pnpm -F i18n-studio i18n:extract`
- [x] 1.2 确认产物落到 `locales/<lang>/studio-ui.json` 的 `{ common: { nav: { dashboard } } }`,而非生成 `common.json`/把 `common` 当 ns
- [x] 1.3 若归属错判:确认 `nsSeparator:':'`、调整 extract 配置直到归属正确;记录最终配置(供决策 6 / open questions)
  - 结论:`defaultNS:'studio-ui'` + `nsSeparator:':'` + `keySeparator:'.'` 下,`t('common.nav.dashboard')` 正确归属 ns=studio-ui、产物 `{ common: { nav: { dashboard } } }` 落到 `studio-ui.json`,无需 nsSeparator 退路。

## 2. 本地资源文件合并

- [x] 2.1 将 `locales/zh-cn/{common,landing}.json` 合并为 `locales/zh-cn/studio-ui.json`(`{ common: <common.json>, landing: <landing.json> }`)
- [x] 2.2 将 `locales/en-us/{common,landing}.json` 合并为 `locales/en-us/studio-ui.json`
- [x] 2.3 删除旧 `common.json` / `landing.json`;重跑 `i18n:codegen`,确认 `generated.ts` 的 `I18N_NAMESPACES=['studio-ui']`、resources 为单 ns 结构

## 3. 运行时 i18next 适配单 ns

- [x] 3.1 `app/i18n/config.ts`:`defaultNS:'common'` → `'studio-ui'`,`ns` 随 `I18N_NAMESPACES`(=`['studio-ui']`)自动生效;确认 resources 结构 `{ <lang>: { 'studio-ui': {…} } }`
- [x] 3.2 `app/i18n/runtime-merge.ts`:`splitFlatByNamespace` 退化为「全部归 `studio-ui`、key 保持完整路径」;`mergeChangedBundles` 对单 ns deep merge
- [x] 3.3 `app/root.tsx`:hydration 运行时合并调用点按单 ns 调整(传 `studio-ui` 而非多 ns 列表)

## 4. 组件改写为单 ns + 全 key

- [x] 4.1 `app/components/app-shell.tsx`:`useTranslation('common')` → `useTranslation()`;`t('nav.dashboard')` → `t('common.nav.dashboard')` 等全部调用点
- [x] 4.2 `app/components/landing/hero.tsx`、`features.tsx`:`useTranslation('landing')` → `useTranslation()`;`t('hero.title')` → `t('landing.hero.title')`;动态 `t(\`features.${k}.title\`)` → `t(\`landing.features.${k}.title\`)`
- [x] 4.3 `app/components/lang-toggle.tsx`:`useTranslation('common')` → `useTranslation()`;`t('lang.label')` → `t('common.lang.label')`
- [x] 4.4 `app/routes/{login,register,dashboard.*}.tsx` 及其余消费组件:同样去 ns 参 + 全 key
- [x] 4.5 grep 校验:全仓 `useTranslation(` 不再带 `'common'`/`'landing'` 参数;`t('` 调用均带前缀段(无裸 key)

## 5. 脚本与配置适配单 ns

- [x] 5.1 `i18next.config.ts`:`defaultNS` → `studio-ui`(定稿 spike 结论);`preservePatterns` 调整为单 ns 内完整 key(如 `landing.features.*`)
- [x] 5.2 `scripts/i18n-flatten.mjs`:`flatten`/`unflatten` 简化为「嵌套对象 ↔ 点分 flat map」,不再剥/拼 ns 前缀(单文件 `studio-ui.json` 的内容直接互转)
- [x] 5.3 `scripts/i18n-push.mjs` / `i18n-pull.mjs`:读写单文件 `locales/<lang>/<STUDIO_NAMESPACE>.json`;push diff 与 pull 占位逻辑按完整 flat key 不变;`sync-core` 纯函数确认无需改

## 6. 测试更新

- [x] 6.1 `tests/unit/i18n-sync.test.ts`:flatten/unflatten 用例改为单 ns 语义(无 ns 前缀拼接)
- [x] 6.2 `tests/unit/i18n-sync-core.test.ts`:测试数据 key 改为 `common.*` / `landing.*` 完整形态
- [x] 6.3 `tests/unit/runtime-merge.test.ts`:`splitFlatByNamespace`/`mergeChangedBundles` 用例改为单 `studio-ui` ns
- [x] 6.4 其余受影响测试(i18n-config 等)按单 ns 更新断言

## 7. 全量验证

- [x] 7.1 `pnpm -F i18n-studio i18n:extract`:确认对全部现有 `t()` 提取产物落入单 `studio-ui.json`,与手工合并结果一致(无多余/缺失 key)
  - extract 产物与手工合并语义完全一致(zh/en JSON 深比相等);修复了 config.ts 注释中 `t('common.nav.x')` 被静态提取的噪音 key。
- [x] 7.2 `pnpm -F i18n-studio i18n:codegen && typecheck && build && test` 全绿
  - codegen → 单 ns;typecheck 0 err(补 `i18n-sync-core.d.mts`、更新 `i18n-flatten.d.mts`、删死代码 `i18n-locales.mjs`、改 seed 脚本);build ✓;test 191/191 ✓。
- [x] 7.3 手工/浏览器验证:语言切换生效、hydration 无 mismatch、无 FOUC、界面无裸 key
  - 落地页(hero + 6 个动态 `landing.features.*` key)、/login(`common.auth.*`)中英文均完整渲染、无裸 key;语言切换(中⇄英)生效;cookie 与 SSR 语言一致时 console 0 error。curl 验证 SSR 对任一确定语言自洽(`<html lang>` 与文案匹配)。
  - 注:playwright 初次会话曾因浏览器遗留 cookie 与首个 SSR 请求语言不同步出现一次 hydration mismatch;root.tsx 的 SSR 语言同步(`void changeLanguage`)本 change 零改动(git diff 证实),属 pre-existing 流式 SSR 竞态,不在本 change 范围。
- [x] 7.4 oxlint / oxfmt 通过(仅允许既有 pre-existing 警告)
  - oxlint 0 error(唯一 warning `api.server.ts` `_e` 为 pre-existing);oxfmt 全绿(格式化本次触及的 dashboard._index.tsx + codegen 产物 generated.ts + change A 遗留 guide.md)。
