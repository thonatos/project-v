## Why

运行时 i18next 的 namespace 模型与 studio 的模型从一开始就错配了。studio 侧 studio 自身界面文案只有**唯一一个 namespace `studio-ui`**;在它看来 `common` / `landing` 只是词条 key 的第一段命名前缀(flat key 形如 `common.nav.dashboard`)。但当前运行时却把 `common` / `landing` 当成了**两个 i18next namespace**:`defaultNS:'common'`、`ns:['common','landing']`、组件写 `useTranslation('common')` + `t('nav.dashboard')`、本地资源拆成 `common.json` / `landing.json`。

这一错配带来持续的认知负担与转换成本:push/pull 必须在「studio flat key」与「i18next ns + 子 key」之间剥离/拼接前缀(`splitFlatByNamespace`、flatten/unflatten 的 ns 处理),`useTranslation` 必须记住绑哪个 ns,而这些 ns 本不该存在。收敛到唯一 `studio-ui` 后,studio flat key 与组件 `t()` 的完整 key 一一对应,模型自洽、转换消失。

## What Changes

- **i18next namespace 收敛为唯一 `studio-ui`**:`defaultNS:'studio-ui'`、`ns:['studio-ui']`;`common` / `landing` 降级为 key 前缀约定,不再是 i18next namespace。**BREAKING**(运行时 i18next 资源结构与组件调用形态变化,但属界面内部,无对外 API 变更)。
- **组件改写全 key**:`t('nav.dashboard')` → `t('common.nav.dashboard')`、`t('hero.title')` → `t('landing.hero.title')`;`useTranslation('common'/'landing')` → `useTranslation()`(用 defaultNS `studio-ui`)。覆盖 app-shell、hero、features、dashboard.*、login、register、lang-toggle 等全部消费组件。
- **本地资源文件合并**:`locales/<lang>/common.json` + `landing.json` → 合并为单文件 `locales/<lang>/studio-ui.json`(内含 `common` / `landing` 子树)。
- **运行时装配适配单 ns**:`config.ts` 的 `resources` 变为 `{ <lang>: { 'studio-ui': { common:{…}, landing:{…} } } }`;`splitFlatByNamespace` / `mergeChangedBundles`(hydration 运行时合并)按单 ns 调整。
- **push/pull 简化**:studio flat key 现与 `t()` 全 key 等价,flatten/unflatten 不再剥离/拼接 ns 前缀;接手已有 change `i18n-studio-pull-push-workflow` 已落的 push/pull/sync-core 实现,在此一并改为单 ns 语义。
- **i18next.config.ts 适配**:`defaultNS:'common'` → `'studio-ui'`;`preservePatterns` 随 key 形态调整;验证 extract 在单 ns 下把 `t('common.nav.dashboard')` 归属为「ns=studio-ui, key=common.nav.dashboard」。
- codegen 在本 change **保留**(删 codegen 是后续 change 的范围);文件合并后它扫到单个 `studio-ui.json`,`I18N_NAMESPACES` 自动收敛为 `['studio-ui']`,无需改 codegen 本身。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `ui-i18n`: 「界面语言初始化」的 namespace 模型由多 ns(`common`/`landing`)改为唯一 `studio-ui`,`defaultNS` 随之改变;「界面文案 key 化」的组件写法改为全 key `t('<prefix>.key')` + `useTranslation()` 不传参。
- `ui-i18n-sync`: 「浏览器运行时文案拉取」依赖的 flat→ns 拆分(`splitFlatByNamespace`)在单 ns 下改为不剥前缀的整体合并;push/pull 的本地资源结构由按 ns 拆分文件改为单 `studio-ui.json`,flatten/unflatten 不再处理 ns 前缀。

## Impact

- **运行时**:`app/i18n/config.ts`(ns/defaultNS/resources 结构)、`app/i18n/runtime-merge.ts`(`splitFlatByNamespace`)、`app/root.tsx`(运行时合并调用)。
- **组件**:`app/components/{app-shell,landing/hero,landing/features,lang-toggle}.tsx`、`app/routes/{login,register,dashboard.*}.tsx` 等全部 `useTranslation` / `t()` 调用点。
- **本地资源**:`app/i18n/locales/<lang>/*.json` 由 2 文件合并为 1 个 `studio-ui.json`(双语 zh-cn / en-us)。
- **脚本**:`scripts/i18n-{push,pull,sync-core}.mjs`、`scripts/i18n-flatten.mjs`(ns 处理简化)、`i18next.config.ts`(defaultNS/preservePatterns)。
- **测试**:`tests/unit/{i18n-sync,i18n-sync-core,runtime-merge}.test.ts` 等按新 key 形态与单 ns 更新。
- **codegen / generated.ts**:不改 codegen 代码;`generated.ts` 经重跑后 `I18N_NAMESPACES=['studio-ui']`、resources 单 ns 结构。
- **不变**:snapshot 端点、import API、write token、`/meta` 清单、对外 HTTP 契约;studio DB 侧 namespace=`studio-ui` 本就如此,无需迁移。

## Rollback

- 改动集中在界面运行时 + 本地资源 + 脚本,无 DB schema / 对外 API 变更,`git revert` 即可整体回退。
- 文件合并可逆:回退后重跑 codegen 即恢复多 ns 的 `generated.ts`。
- 因接手 `i18n-studio-pull-push-workflow` 的半成品(走法甲),回退本 change 会一并回到该 change 实现后的状态;两者按序管理,不交叉。
