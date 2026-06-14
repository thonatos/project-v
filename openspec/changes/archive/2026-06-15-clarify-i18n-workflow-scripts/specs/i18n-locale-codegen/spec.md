## MODIFIED Requirements

### Requirement: UI 语种构建期生成(codegen)

i18n-studio SHALL 提供一个构建期 codegen 工具,扫描 `app/i18n/locales/` 目录并生成 `app/i18n/generated.ts`。该工具 SHALL 位于项目级工具目录（如 `packages/apps/i18n-studio/tools/i18n-codegen.ts`）,而非词条同步工作流入口目录,以明确 codegen 是 pull/build/typecheck 的构建期派生动作,不是 `extract -> push -> pull` 词条工作流的一等步骤。生成物 SHALL 导出 `SUPPORTED_LANGS`(语种 code 列表,来源为 `locales/` 的子目录名)、`resources`(各语种各 namespace 的 `<ns>.json` 静态映射)与语种元信息(`label` / `englishLabel` / `nativeLabel`,来源为本地元信息文件)。codegen SHALL **离线可跑**:在数据库为空、studio 服务未运行时(全新 clone / CI 构建)仍能仅凭已提交的 `app/i18n/locales/` 与元信息文件产出正确的 `generated.ts`。系统 SHALL 保留低层 `i18n:codegen` 命令供构建、CI、调试和手动修复使用,并 SHALL 继续在 `build` / `typecheck` 前置运行 codegen。

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
