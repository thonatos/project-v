## Context

i18n-studio 已具备 pull（先查 `GET /snapshot/:slug/meta` 清单再逐语种拉取）、push（向 `POST /api/namespaces/:slug/import` 导入,write token 鉴权）、codegen（扫描 `locales/` 生成 `generated.ts`）三套脚本,以及 `studio-ui` 自托管 namespace 与 `scripts/i18n-flatten.mjs` 的 flatten/unflatten 纯函数。

当前缺口:push 的数据来源是本地 `locales/` 目录全量,而非源码。真实项目里 key 由开发者在组件写 `t('ns.key')` 时产生,push 不扫源码就无法把新 key 同步进系统。

关键决定:i18next 官方维护的 `i18next-cli`(1.62.0,SWC 解析)已内置 `extract`/`lint`/`status`/`sync`,其 `extract.output` 直出 `locales/{{language}}/{{namespace}}.json` 嵌套结构,与本项目现有 `app/i18n/locales/<lang>/<ns>.json` 完全一致。因此**不自研 AST 扫描器**,直接用 i18next-cli 做提取引擎,把产物接到现有链路。

经与用户确认:**源语言文案承载在 JSON / studio,组件只写 `t('ns.key')`,不携带默认文案**。故不引入 `t(key, default)` 约定——该字符串第二参形式在 i18next TS 类型下有已知坑(返回 `DefaultTFuncReturn`,issue #1198)。

约束:脚本层为 Node ESM(`.mjs`),已用 dotenv;studio flat key 为 `<ns>.<nested.path>`;i18next 用默认 `.` keySeparator,资源须保持 nested。CLAUDE.md 要求操作限项目内、conventional commits、git hooks 不跳过。

## Goals / Non-Goals

**Goals:**
- 让源码 `t('ns.key')` 成为 key 的唯一权威来源,提取交给 i18next-cli。
- push 改为「extract 刷新本地 key → diff 系统现有 key → 仅推送新增 key 到 zh-cn」,不覆盖既有翻译。
- pull 以 extract 产物为应存在 key 全集,缺失项写占位,保证 bundle 完整。
- 抽离 studio 界面 `routes/`、`components/` 中剩余硬编码中文文案(借 i18next-cli `lint` 定位)。

**Non-Goals:**
- 不改 snapshot 端点、import API、write token、codegen、`generated.ts` 结构、运行时 i18next 初始化。
- 不自研扫描器/AST 解析。
- 不引入 `t(key, default)` 运行时默认值约定。
- 不做自动翻译——译者仍在 studio 内人工翻译。
- 不强制一次性抽离全部界面文案,本次覆盖高价值区域,其余增量推进。

## Decisions

### 决策 1:提取引擎用 i18next-cli,不自研

i18next-cli 是 i18next 官方一体化 CLI(SWC 解析,精确处理 JSX/模板字符串/作用域),内置 extract/lint/status/sync,且 `extract.output` 模板 `{{language}}/{{namespace}}.json` 与本项目结构天然一致。自研 AST 扫描器是重复造轮子且更易出错。

- **备选(自研 @babel/parser 扫描器)**:维护成本高、要自己处理作用域识别/动态 key/误报,而官方工具已解决。否决。
- **备选(纯正则)**:无法可靠区分字符串字面量/模板字符串与同名误报。否决。

### 决策 2:`i18next.config.ts` 与现有产物对齐

配置:`locales` = generated 的语种集、`primaryLanguage: 'zh-cn'`(对齐 `DEFAULT_LANG`)、`extract.input: ['app/**/*.{ts,tsx}']`、`extract.output: 'app/i18n/locales/{{language}}/{{namespace}}.json'`、`keySeparator: '.'`、`indentation: 2`、`sort: true`。这样 extract 产物逐字节贴合现有 JSON 格式,codegen 可直接消费,diff 干净。

### 决策 3:源码只写 `t('ns.key')`,占位为空串

组件不携带默认文案;extract 对新 key 写空串占位,zh-cn 实际文案由人工在 JSON(或 studio)填写。绕开字符串第二参的 TS 类型坑,也使「源码=key、JSON/studio=文案」职责清晰。`defaultValue` 配置保持默认空串。

### 决策 4:push 用 extract + snapshot diff

push 流程:① 先 `i18n:extract` 刷新本地 zh-cn key 集合 → ② `GET /snapshot/:slug/zh-cn` 取系统现有 key → ③ 求差集 → ④ 仅 import 新增 key 到 `zh-cn`。虽然 `importFlat` 幂等 upsert,但「只传新增」避免无意义写入、不触碰既有翻译时间戳,日志更清晰。复用现有 flatten 把本地 nested JSON 转 studio flat key。

### 决策 5:动态 key 保留 + 未用 key 清理

启用 `removeUnusedKeys: true` 让源码删掉的静态 key 同步从本地资源移除;用 `preservePatterns`(如 `menu.*`)保留运行时拼接的动态 key 不被误删。清理只作用于本地资源,**不**删除 studio 系统词条(push 只增不删,删除由人在 studio 决定)。

### 决策 6:pull 占位语义

pull 拉到系统某语种文案后,以本地 zh-cn key 全集(extract 产物)为基准补齐:系统已有的 key 用系统值;系统缺失的 key 写占位(空串)。占位只写本地 bundle(构建 fallback),不 push 回系统,避免把占位当译文污染。

### 决策 7:界面文案抽离借 i18next-cli lint

用 `i18next-cli lint` 扫出 `routes/`、`components/` 中的硬编码字符串作为抽离候选,人工改写为 `t('ns.key')` 并把中文填入 zh-cn JSON。`instrument` 命令可做半自动改写,但有误报,仅作辅助、人工复核。

## Risks / Trade-offs

- **i18next-cli 提取与运行时 ns/keySeparator 配置不一致导致 key 错位** → 配置严格对齐运行时(`.` 分隔、ns 来自 useTranslation),并在抽离后跑一次 codegen+build 验证界面无裸 key。
- **`removeUnusedKeys` 误删动态 key** → 用 `preservePatterns` 显式保留;首次启用后人工 review diff。
- **extract 写空串占位,zh-cn 漏填会显示空白** → push 前用 `i18next-cli status zh-cn` 或 CI `extract --ci` 检测「源码有 key 但 zh-cn 未填」的漂移。
- **新增 devDependency 体积** → i18next-cli 仅脚本/构建期用,不进运行时 bundle;pin 版本。
- **studio 与 i18next-cli 两套「key 真相」漂移** → 明确单向:源码→extract→本地→push→studio;pull 反向只补本地占位,不回写源码。

## Migration Plan

1. 加 `i18next-cli` 为 i18n-studio devDependency(pin 版本)。
2. 新增 `i18next.config.ts`,与 generated 语种集/`DEFAULT_LANG`/locales 路径对齐。
3. `package.json` 加 `i18n:extract`;让 `i18n:push` 先 extract。
4. 重写 `i18n-push.mjs`:extract → snapshot diff → 仅推新增 key。
5. 调整 `i18n-pull.mjs`:以 extract 产物为 key 全集,缺失写占位。
6. 用 `lint` 定位并抽离 `routes/`、`components/` 硬编码文案为 `t('ns.key')`,中文填入 zh-cn JSON。
7. 跑 extract+codegen 验证;push 新 key 到 studio;pull 回灌验证。
8. 全量 typecheck/build/test;文档更新闭环说明。

**回滚**:移除 `i18next.config.ts` + `git revert` 脚本改动即恢复旧 push;文案抽离逐条可逆。

## Open Questions

- extract 的 `input` 是否纳入 `app/routes/api.*`(多为 HTTP/JSON 响应,文案少)——倾向纳入但靠 i18next-cli 的作用域识别 + `functions`/`ignore` 配置滤除非翻译调用,实现时验证无误报。
- pull 占位与 i18next-cli `sync`/`extract --sync-all` 的职责边界:pull 负责「从 studio 取译文 + 补占位」,是否复用 i18next-cli `sync` 还是脚本内自行补齐——实现时取更简洁者,优先脚本内补齐以保留对 studio 数据的完全控制。
