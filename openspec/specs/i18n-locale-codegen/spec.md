# i18n-locale-codegen Specification

## Purpose
定义 i18n-studio 界面国际化的构建期代码生成(codegen)能力:扫描 `app/i18n/locales/` 产出 `app/i18n/generated.ts`,作为界面 i18next 语种集、资源与语种元信息的唯一来源,保证离线可构建且新增语种无需手改配置或切换器组件。
## Requirements
### Requirement: UI 语种构建期生成(codegen)

i18n-studio SHALL 提供离线可运行的构建期 codegen 工具，扫描 `app/i18n/locales/` 并生成 `app/i18n/generated.ts`。工具 SHALL 位于项目级 `tools/` 目录；生成物 MUST 包含稳定的语种列表、各语种 namespace 静态资源和语种元信息。系统 SHALL 保留 `i18n:codegen` 命令，并在 `build` 与 `typecheck` 前运行；codegen 作为 pull/build/typecheck 的派生动作，MUST NOT 成为 extract/push/pull 词条工作流的一等入口。
#### Scenario: 扫描目录生成语种列表

- **GIVEN** `app/i18n/locales/` 下存在子目录 `zh-cn`、`en-us`,各含 `studio-ui.json`
- **WHEN** 运行 codegen
- **THEN** `app/i18n/generated.ts` 导出的 `SUPPORTED_LANGS` 恰为 `['zh-cn', 'en-us']`(顺序稳定),`resources` 包含两语种的 `studio-ui` namespace 内容

#### Scenario: 新增语种目录即纳入

- **GIVEN** 在 `app/i18n/locales/` 新增子目录 `ja-jp` 及其 `studio-ui.json`
- **WHEN** 重新运行 codegen
- **THEN** `SUPPORTED_LANGS` 包含 `ja-jp`,`resources` 含其内容;无需手动修改 `lib/i18n.ts`、`config.ts` 或切换器组件

#### Scenario: 离线构建(无 studio / 空 DB)

- **GIVEN** 全新 clone 仓库,studio 服务未运行,数据库不存在
- **WHEN** 运行 codegen 与 `typecheck` / `build`
- **THEN** codegen 仅凭已提交的 `app/i18n/locales/` 与元信息文件成功产出 `generated.ts`,构建成功,不发起任何网络请求

#### Scenario: 元信息缺失时降级

- **GIVEN** 某语种在本地元信息文件中没有对应的 `nativeLabel` / `label`
- **WHEN** 运行 codegen
- **THEN** 该语种的显示名降级为其 `code` 自身,codegen 不报错、不阻断构建

#### Scenario: 不作为词条工作流入口

- **GIVEN** 开发者查看 `packages/apps/i18n-studio/scripts/` 或文档中的界面文案同步主流程
- **WHEN** 识别词条工作流的一等步骤
- **THEN** 只看到 `extract`、`push`、`pull` 三步;codegen 作为 `pull`、`build`、`typecheck` 内部编排的构建期派生动作存在

### Requirement: 生成物为界面 i18next 的唯一语种来源

`app/i18n/config.ts` 与 `app/lib/i18n.ts` SHALL 消费 `app/i18n/generated.ts`,而非各自手写语种集与 `resources` 映射。`SUPPORTED_LANGS`、`Lang` 类型、i18next `resources` / `supportedLngs` / `ns` SHALL 全部从生成物派生。界面 i18next 实例 SHALL 保持同步 init 与静态 bundle,使 SSR 首帧不出现 raw key(无 FOUC)。

#### Scenario: 单一来源派生

- **GIVEN** `generated.ts` 导出 `SUPPORTED_LANGS` 与 `resources`
- **WHEN** 检查 `lib/i18n.ts` 与 `i18n/config.ts`
- **THEN** 二者不再硬编码语种 code 列表或逐个 `import` locale JSON,而是引用生成物;`Lang` 类型由 `SUPPORTED_LANGS` 派生

#### Scenario: 同步 init 无 FOUC

- **GIVEN** 任意受支持语种
- **WHEN** 页面服务端渲染首帧
- **THEN** 已 key 化文案直接渲染为对应语言文本,不出现原始 key 字符串
