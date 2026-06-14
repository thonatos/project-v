## Context

运行时 i18next 当前把 `common` / `landing` 当成两个 namespace,而 studio 侧承载界面文案的 namespace 只有唯一一个 `studio-ui`——`common`/`landing` 在 studio 看来只是 flat key 的首段前缀(`common.nav.dashboard`)。本 change 把运行时收敛为单一 namespace `studio-ui`,使 studio flat key 与组件 `t()` 的完整 key 一一对应。

本 change 在执行上采用**走法甲**:接手已有 change `i18n-studio-pull-push-workflow` 已落的半成品代码(`i18next.config.ts`、`scripts/i18n-{push,pull,sync-core}.mjs`、`login/register` 抽离、相关测试),在此一并改成单 ns 模型,不回退。codegen 在本 change **保留**(删 codegen 属后续 change),它扫描 `locales/<lang>/` 文件名,文件合并为单个 `studio-ui.json` 后,`I18N_NAMESPACES` 自动收敛为 `['studio-ui']`,codegen 代码无需改。

约束:SSR 首屏必须同步、无 FOUC(resources 静态打包);i18next 默认 `keySeparator:'.'`、`nsSeparator:':'`;运行时代码(`config.ts`)不得引入构建期依赖。

## Goals / Non-Goals

**Goals:**
- 运行时唯一 i18next namespace = `studio-ui`;`common`/`landing` 降级为 key 前缀。
- 组件统一 `useTranslation()` + 全 key `t('common.nav.dashboard')`。
- 本地资源合并为单 `studio-ui.json`(内含 `common`/`landing` 子树)。
- push/pull/flatten/unflatten 去掉 ns 剥离/拼接,studio flat key ↔ 全 key 直通。
- 接手并修正 `i18n-studio-pull-push-workflow` 的半成品,使其符合单 ns 模型。

**Non-Goals:**
- 不删 codegen、不改真相到 config(那是后续 change `i18n-studio-pull-push-workflow` 修订的范围)。
- 不动 studio DB 侧 namespace 模型(本就唯一 `studio-ui`)、不改对外 HTTP 契约。
- 不引入新语种、不改语种集来源(仍 codegen 扫目录)。

## Decisions

### 决策 1:第一步先做 extract 归属 spike(最高风险前置)

整个 change 成立的前提:i18next-cli `extract` 在 `defaultNS:'studio-ui'` 下,必须把 `t('common.nav.dashboard')` 归属为「ns=`studio-ui`,key=`common.nav.dashboard`」,产物落到 `locales/<lang>/studio-ui.json` 的 `{ common: { nav: { dashboard } } }`,而**不是**把 `common` 当 ns(产出 `common.json`)。

i18next 解析逻辑:`t('common.nav.dashboard')` 不含 `nsSeparator`(`:`)→ 用 defaultNS;`.` 作为 keySeparator 拆嵌套。理论成立,但 i18next-cli 的静态提取需实测验证。**第一个 task 用最小样例跑 `i18n:extract` 验证产物结构**,失败则立即暴露,退路:显式确认 `nsSeparator:':'` 且不与 key 前缀冲突,或调整 extract 配置(`defaultNS` + 关闭把首段当 ns 的行为)。

- 备选(放最后验证):改完全部组件才发现归属错 → 大返工。否决,故前置。

### 决策 2:flatten/unflatten 简化为「不处理 ns」

单 ns 下,本地 `studio-ui.json` 的内容**就是** `studio-ui` namespace 的资源,其嵌套路径即 studio flat key:

```
studio-ui.json = { common: { nav: { dashboard: "…" } }, landing: { hero: {…} } }
flatten(content) → { "common.nav.dashboard": "…", "landing.hero.title": "…" }  // 全路径,无 ns 前缀拼接
unflatten(flat)  → 上述嵌套对象                                                 // 不剥首段当 ns
```

现有 `flatten(nsMap)` 会把外层 key 当 ns 前缀拼接、`unflatten` 把首段切成 ns——单 ns 下这两步都**消失**,退化为纯粹的「嵌套对象 ↔ 点分 flat map」互转。push/pull 读写的是单文件 `studio-ui.json` 的内容,直接喂给这对纯函数。

- 影响:`scripts/i18n-flatten.mjs` 语义简化;`sync-core` 的 `diffNewEntries`/`fillPlaceholders` 只认 flat key 字符串,**不受影响**(它们本就不碰 ns)。

### 决策 3:runtime-merge 的 splitFlatByNamespace 退化(并修正覆盖语义)

hydration 运行时拉取到的 flat 文案(`common.nav.dashboard` …)现在整体并入单一 `studio-ui` namespace,不再按首段拆多个 ns。

实测发现旧实现一个**潜在 bug**:旧 `splitFlatByNamespace` 把 `common.nav.dashboard` 拆成 `{ common: { 'nav.dashboard': … } }`——bundle 的 value key 仍是 **dotted 字面串**(`'nav.dashboard'`)。`addResourceBundle` 把它当字面 key 存(`"nav.dashboard": …`),与已 bundle 的嵌套 `{nav:{dashboard}}` 并存,而 i18next `t()` 嵌套优先 → 运行时拉取的新文案**不生效**。

故单 ns 退化的同时修正为:把整个 flat snapshot **unflatten 成嵌套对象**(`{ common: { nav: { dashboard: … } } }`)全归 `studio-ui`,再 `addResourceBundle(lng, 'studio-ui', nested, true, true)` deep merge——实测嵌套覆盖嵌套可正确生效。`mergeChangedBundles` 的 diff 判定用**完整 flat key** 调 `getResource(lng, 'studio-ui', 'common.nav.dashboard')`(按 keySeparator 解析嵌套,实测取值正确),仅当值有变才合并(避免二次闪烁)。

### 决策 4:resources 结构 + config.ts

`generated.ts` 经 codegen 重跑后,`resources` 变为 `{ <lang>: { 'studio-ui': <studio-ui.json 内容> } }`,`I18N_NAMESPACES=['studio-ui']`。`config.ts` 的 `defaultNS`/`ns` 改为 `'studio-ui'` / `['studio-ui']`(它本就从 generated 读 resources/SUPPORTED_LANGS,自动跟随)。

### 决策 5:文件合并一次性脚本化或手工 + 重跑 codegen

`common.json` + `landing.json` → `studio-ui.json` 的合并对 zh-cn / en-us 各做一次(`{ common: <common.json>, landing: <landing.json> }`),删除旧两文件,重跑 codegen 生成单 ns 的 `generated.ts`。合并是确定性的纯结构变换,可手工或一次性脚本完成,无歧义。

### 决策 6:i18next.config.ts 适配

`defaultNS:'common'` → `'studio-ui'`;`preservePatterns` 现作用于单 ns 内的完整 key——动态 key `t(\`features.${k}.title\`)` 对应 `landing.features.*`,保留模式相应写为 `landing.features.*`(在 `studio-ui` ns 内,无需 `landing:` ns 限定语法)。extract 的 `output` 仍为 `{{language}}/{{namespace}}.json`,单 ns 下即 `studio-ui.json`。

## Risks / Trade-offs

- **[extract 归属错判]** → 决策 1 前置 spike;失败有 nsSeparator/defaultNS 配置退路。
- **[全组件改写遗漏某处 t() / useTranslation]** → 改写后 codegen+build+grep 校验:全仓 `useTranslation(` 不应再带 `'common'`/`'landing'` 参数;裸 key(无前缀)的 `t()` 应消失。
- **[运行时合并/SSR 回归]** → 既有 `runtime-merge.test.ts` 按单 ns 更新并保持通过;手工验证语言切换、hydration 无 mismatch、无 FOUC。
- **[接手半成品引入隐藏耦合]** → 半成品的 push/pull/sync-core 已基于 flat key(不碰 ns),改动面集中在 flatten/unflatten 与文件结构;sync-core 测试数据 key 改为 `common.*` 形态即可。
- **[与后续 change 的边界]** → 本 change 明确不删 codegen、不改真相来源;两 change 顺序执行,diff 不交叉。

## Migration Plan

1. **spike**:最小样例验证 extract 在单 ns 下对 `t('common.x')` 的归属(决策 1)。
2. 合并 `locales/<lang>/{common,landing}.json` → `studio-ui.json`(zh-cn / en-us),删旧文件,重跑 codegen。
3. `config.ts` ns/defaultNS;`runtime-merge.ts` 的 `splitFlatByNamespace`;`root.tsx` 调用点。
4. 全组件改写:`useTranslation()` 去参 + `t()` 全 key(app-shell、hero、features、dashboard.*、login、register、lang-toggle)。
5. `i18next.config.ts` defaultNS/preservePatterns;`scripts/i18n-flatten.mjs` 简化;push/pull 读写单文件。
6. 测试更新:`i18n-sync`、`i18n-sync-core`、`runtime-merge` 按新形态;新增/调整断言覆盖单 ns。
7. `i18n:extract`(验证产物)+ `i18n:codegen` + `typecheck` + `build` + `test` 全绿;grep 校验无残留多 ns 调用。

**回滚**:`git revert`;无 DB/对外 API 变更;回退后重跑 codegen 恢复多 ns generated.ts。

## Open Questions

- extract 在单 ns 下若对 `keySeparator` 嵌套深度有特殊处理(如把 `common.nav.dashboard` 误判层级),spike 阶段确认;必要时评估 key 前缀是否改用非 `.` 分隔(倾向保持 `.`,与 studio flat key 一致)。
- `preservePatterns` 在单 ns 下的精确写法(`landing.features.*` vs 带 ns 限定)以 spike/extract 实测为准。
