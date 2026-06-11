# ui-i18n Specification (Delta)

## MODIFIED Requirements

### Requirement: 界面语言初始化

系统 SHALL 在服务端与客户端使用同一份 i18next 配置初始化界面国际化实例，注册的语种集与各语种资源 SHALL 来源于 `app/i18n/generated.ts`(由 codegen 扫描 `app/i18n/locales/` 生成),而非在 `config.ts` / `lib/i18n.ts` 中手写。系统 SHALL 使用**唯一的 i18next namespace `studio-ui`**(= studio 侧承载界面文案的 namespace slug)组织资源;`common` / `landing` 等 SHALL NOT 作为 i18next namespace,而仅作为词条 key 的前缀段。`defaultNS` 与注册的 `ns` SHALL 均为 `studio-ui`。组件 SHALL 通过 `useTranslation()`(不传 ns,使用 defaultNS)读取文案,并以**完整 key**(含前缀,如 `common.nav.dashboard`)调用 `t()`。默认/回退语言 SHALL 为 `zh-cn`。

#### Scenario: 默认语言渲染

- **GIVEN** 请求未携带 `lang` cookie
- **WHEN** 用户访问任意界面页面
- **THEN** 系统以 `zh-cn` 渲染所有已 key 化的界面文案

#### Scenario: 缺失 key 回退

- **GIVEN** 当前语言为 `en-us` 且某个 key 在 `en-us` 资源中缺失
- **WHEN** 组件请求该 key 的翻译
- **THEN** 系统回退到 `zh-cn` 对应文案，而非显示原始 key 字符串

#### Scenario: 注册语种来自生成物

- **GIVEN** `app/i18n/generated.ts` 导出 `SUPPORTED_LANGS` 与 `resources`
- **WHEN** i18next 实例初始化
- **THEN** 其 `supportedLngs` 与 `resources` 等于生成物所导出的值;`config.ts` / `lib/i18n.ts` 不再逐个 `import` locale JSON 或硬编码语种 code 列表

#### Scenario: 唯一 namespace 模型

- **GIVEN** 系统初始化 i18next 实例
- **WHEN** 检查注册的 namespace
- **THEN** `ns` 与 `defaultNS` 均为 `studio-ui`,不存在 `common` / `landing` 等其它 i18next namespace;`resources` 结构为 `{ <lang>: { 'studio-ui': { common: {…}, landing: {…} } } }`

#### Scenario: 组件以完整 key 取文案

- **GIVEN** 组件使用 `const { t } = useTranslation()`(不传 ns)
- **WHEN** 组件调用 `t('common.nav.dashboard')`
- **THEN** i18next 在 `studio-ui` namespace 内按 `.` 解析嵌套路径 `common → nav → dashboard` 取得文案;无需 `useTranslation('common')` 之类的 ns 绑定

### Requirement: 界面文案 key 化

系统 SHALL 将界面硬编码文案抽取为 i18next key,消除界面中英文混杂的硬编码文案,使其随当前语言切换。覆盖范围 SHALL 包含「公共外壳 + Dashboard 框架」的高频文案(app-shell 导航与菜单、landing hero/features、dashboard 导航与布局标签)以及既有已抽离区域(login/register 等)。组件 SHALL 以**完整 key**(含前缀段,如 `common.*` / `landing.*`)调用 `t()`,并通过 `useTranslation()`(不传 ns)获取 `t`;SHALL NOT 使用 `useTranslation('common')` / `useTranslation('landing')` 之类的 ns 绑定。源语言文案承载于本地 `studio-ui.json` / studio,组件不携带默认文案。

#### Scenario: 外壳文案随语言切换

- **GIVEN** 用户已切换界面语言到 `en-us`
- **WHEN** 渲染公共外壳与 Dashboard 框架
- **THEN** 已抽取区域(导航、菜单项、落地页标题等)显示英文文案，无残留硬编码中文

#### Scenario: 默认语言下文案统一

- **GIVEN** 默认语言 `zh-cn`
- **WHEN** 渲染首批被抽取的界面区域
- **THEN** 这些区域不再出现中英文混杂，统一显示简体中文文案

#### Scenario: 全 key 调用形态

- **GIVEN** 某组件原先 `useTranslation('common')` + `t('nav.dashboard')`
- **WHEN** 本变更改写后
- **THEN** 该组件为 `useTranslation()` + `t('common.nav.dashboard')`,渲染结果与改写前一致(同一文案),且不再绑定 ns
