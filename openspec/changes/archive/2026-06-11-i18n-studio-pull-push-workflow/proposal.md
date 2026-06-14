## Why

当前 i18n-studio 的 push 脚本是「把本地 `app/i18n/locales/` 目录里有什么就原样上传什么」,词条的权威来源是本地 JSON 文件,而非源码。真实项目里开发者在组件中写 `t('ns.key')`,key 散落在源码各处;push 不扫源码,新加的 key 永远进不了翻译系统,开发者得手动维护 locales JSON——这正是「不符合真实项目使用、存在耦合」的根因。

i18next 官方已提供 `i18next-cli`(SWC 解析,内置 `extract`/`lint`/`status`/`sync`),能从源码精确提取 `t(...)` 调用并写入 `locales/{{language}}/{{namespace}}.json`——其输出结构与本项目现有 `app/i18n/locales/<lang>/<ns>.json` 完全一致。因此本次**不自研扫描器**,而是引入 i18next-cli 作为提取引擎,把它的产物接到现有 push→studio / pull←studio / codegen 链路上,使工作流摆正为以**源码为 key 权威来源**的闭环:源码 `t('ns.key')` → i18next-cli extract 写入本地 zh-cn 占位 → push 新 key 到 studio → 译者翻译 → pull 回灌 bundle。同时继续把 studio 自身界面里尚未抽离的硬编码文案 key 化(可借助 i18next-cli `lint`/`instrument` 定位)。

> 经确认:源语言(`zh-cn`)的实际文案承载在 JSON / studio,而非源码——组件**只写 `t('ns.key')`**,不携带默认文案。因此不引入 `t(key, default)` 约定(该字符串第二参形式在 i18next TS 类型下亦有已知坑)。

## What Changes

- **引入 i18next-cli 作为提取引擎**:新增 `i18next.config.ts`,`extract.input` 指向 `app/**/*.{ts,tsx}`,`extract.output` 指向 `app/i18n/locales/{{language}}/{{namespace}}.json`,`keySeparator: '.'`,`locales` 与 `primaryLanguage`(`zh-cn`)与现有生成物对齐。`extract` 把源码中新 key 以空占位写入本地 zh-cn(及各 locale)JSON,删除源码中已不再使用的 key(`removeUnusedKeys`),并用 `preservePatterns` 保留动态 key。
- **重构 push**:不再盲目上传 `locales/` 全量,而是先 `extract` 刷新本地 zh-cn key 集合,再经 snapshot 取系统现有 key 做 diff,仅把**新增/缺失**的 key 推送到 studio 的 `zh-cn`;既有翻译不被覆盖。
- **调整 pull 的占位语义**:pull 拉取系统各语种文案后,以本地 zh-cn key 集合(extract 产物)为「应存在 key 全集」,对系统中某语种未翻译的 key 写占位(i18next-cli 的 `defaultValue`/`sync` 行为或空串),保证 bundle 完整、构建不因缺 key 失败。
- **继续抽离 studio 界面硬编码文案**:用 i18next-cli `lint` 定位 `routes/`、`components/` 中未 key 化的中文文案,改写为 `t('ns.key')`,文案填入 zh-cn JSON,经 push 纳入 `studio-ui` namespace。

## Capabilities

### New Capabilities
- `i18n-key-extraction`: 基于 i18next-cli 从源码提取翻译 key 并维护本地 locale 资源的能力——含 `i18next.config.ts` 契约、key/namespace 归属、动态 key 保留、未用 key 清理、与现有 `locales/` 嵌套结构和 codegen 的对齐。

### Modified Capabilities
- `ui-i18n-sync`: push 由「上传 locales 全量」改为「先 extract 刷新本地 key,再 diff 系统现有 key,仅推送新增 key」;pull 增加「以 extract 产物为应存在 key 全集,缺失项写占位」语义。
- `ui-i18n`: 扩展界面文案 key 化要求,覆盖本次新抽离的 `routes/`、`components/` 硬编码文案,并明确源语言文案承载于 JSON / studio(组件只写 `t('ns.key')`)。

## Impact

- **依赖**:新增 devDependency `i18next-cli`(pin 版本,仅脚本/构建期用,不进运行时 bundle)。
- **配置**:新增 `packages/apps/i18n-studio/i18next.config.ts`。
- **脚本**:重写 `scripts/i18n-push.mjs`(extract + snapshot diff);调整 `scripts/i18n-pull.mjs`(占位逻辑)。`package.json` 增 `i18n:extract`,串入 push/构建流程。
- **界面代码**:`app/routes/*`、`app/components/*` 中若干硬编码中文改为 `t('ns.key')`,文案填入 `locales/zh-cn/*.json`。
- **数据**:新增 key 经 push 落入 `studio-ui` namespace `zh-cn` locale;不影响用户业务 namespace。
- **不破坏**:既有 snapshot 端点、import API、write token、codegen、`generated.ts`、运行时 i18next 初始化与 SSR/hydration 均不变。

## Rollback

- i18next-cli 与脚本改动均为构建/脚本层,回滚只需 `git revert` 对应提交并移除 `i18next.config.ts`,恢复旧版 push「上传 locales 全量」行为;`locales/` 与 `generated.ts` 产物不受影响,构建可继续。
- 界面文案抽离为纯增量 key 化,回退某条只需把 `t('ns.key')` 改回字面量并删除对应 JSON key,不影响其他文案。
