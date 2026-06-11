# i18n-key-extraction Specification

## Purpose

定义 i18n-studio 基于 i18next-cli 从源码提取翻译 key 并维护本地 locale 资源的能力,使源码中的 `t('ns.key')` 调用成为 key 的权威来源,产物对齐现有 `app/i18n/locales/<lang>/<ns>.json` 嵌套结构与 codegen,为 push（推送新增 key）与 pull（占位补齐）提供输入。

## ADDED Requirements

### Requirement: 提取引擎与配置

系统 SHALL 引入 i18next-cli 作为源码翻译 key 的提取引擎,并提供 `packages/apps/i18n-studio/i18next.config.ts` 配置。配置 SHALL 满足:`extract.input` 覆盖 `app/**/*.{ts,tsx}`;`extract.output` 为 `app/i18n/locales/{{language}}/{{namespace}}.json`;`keySeparator` 为 `'.'`、`nsSeparator` 与运行时一致;`locales` 与 `primaryLanguage`(`zh-cn`)与 `generated.ts` 的语种集和 `DEFAULT_LANG` 对齐;`indentation` 为 2、`sort` 为 true,使产物确定性且与现有 JSON 格式一致。i18next-cli SHALL 作为 devDependency（pin 版本）,SHALL NOT 进入运行时 bundle。

#### Scenario: 提取产物对齐现有结构

- **GIVEN** 配置 `output: 'app/i18n/locales/{{language}}/{{namespace}}.json'`、`keySeparator: '.'`
- **WHEN** 运行 extract
- **THEN** 新 key 写入对应 `locales/<lang>/<ns>.json` 的嵌套路径,文件 2 空格缩进、key 排序,可被既有 codegen 直接消费

#### Scenario: 源语言占位

- **GIVEN** 组件含 `t('hero.subtitle')` 而 `locales/zh-cn` 尚无该 key
- **WHEN** 运行 extract
- **THEN** `zh-cn` 资源新增 `hero.subtitle` 占位（空串）,其实际文案由人工在 JSON / studio 中填写,extract 不在源码中读取默认文案

### Requirement: key 与 namespace 归属

系统 SHALL 依 i18next-cli 规则将提取到的 key 归属到 i18next namespace。归属 SHALL 与运行时一致:`useTranslation('<ns>')` 绑定的 namespace 作为该作用域内 key 的 ns,key 内的点分段按 `keySeparator` 还原为嵌套路径。提取 SHALL 仅识别配置 `functions`（默认 `['t', '*.t']`）与 `useTranslationNames`（含 `useTranslation`）所声明的翻译调用,SHALL NOT 提取与翻译无关的同名 `t(...)` 调用。

#### Scenario: 按 useTranslation 绑定归属 ns

- **GIVEN** 组件 `const { t } = useTranslation('landing')` 且调用 `t('hero.title')`
- **WHEN** 运行 extract
- **THEN** 该 key 写入 `locales/<lang>/landing.json` 的 `hero.title` 嵌套路径

#### Scenario: 排除非翻译调用

- **GIVEN** 源码含与翻译无关、恰好同名的 `t('Content-Type')` 之类调用,且其不在任何 i18next `t` 作用域内
- **WHEN** 运行 extract
- **THEN** 该字符串不被当作翻译 key 写入任何 locale 文件

### Requirement: 动态 key 保留与未用 key 清理

系统 SHALL 配置 i18next-cli 的 `preservePatterns` 保留运行时动态拼接的 key（如 `t(\`item.${id}\`)` 对应的已存在 key），使其不被误删;SHALL 启用 `removeUnusedKeys`,使源码中已删除的静态 key 从本地资源中移除,保持 locales 与源码同步。清理 SHALL 仅作用于本地资源文件,SHALL NOT 直接删除 studio 系统中的词条。

#### Scenario: 保留动态 key

- **GIVEN** 源码含 `t(\`menu.${section}\`)`,且 `preservePatterns` 含 `menu.*`,本地已有 `menu.namespaces` 等 key
- **WHEN** 运行 extract
- **THEN** 这些匹配 `menu.*` 的已存在 key 被保留,不因「源码无静态引用」而删除

#### Scenario: 清理已删除的静态 key

- **GIVEN** 某 `t('old.key')` 已从源码删除,且不匹配任何 `preservePatterns`
- **WHEN** 运行 extract（`removeUnusedKeys` 为真）
- **THEN** `old.key` 从本地 locale 文件移除;该清理不触及 studio 系统中的词条

### Requirement: 提取的可消费性与编排

系统 SHALL 在 `package.json` 提供 `i18n:extract` 脚本调用 i18next-cli extract,并将其编排进 push 流程（push 前先 extract 刷新本地 key）。extract 产物 SHALL 可被既有 `i18n:codegen` 与 push/pull 直接消费:codegen 据此生成 `generated.ts`,push 据此得到「应推送 key 全集」,pull 据此得到「应存在 key 全集」用于占位补齐。提供 CI 友好方式（如 `extract --ci` 或 `--dry-run`）检测「源码新增 key 但未提交资源」的漂移。

#### Scenario: extract 串入 push

- **GIVEN** 开发者新增了 `t('hero.cta')`
- **WHEN** 运行 push 流程
- **THEN** 流程先 extract 把 `hero.cta` 占位写入本地 zh-cn,再据此做后续 diff 与推送

#### Scenario: CI 检测资源漂移

- **GIVEN** 源码含未提交到本地资源的 key
- **WHEN** 在 CI 运行 `i18n:extract --ci`（或 dry-run）
- **THEN** 命令以非零退出码报告资源与源码不同步,促使补提交
