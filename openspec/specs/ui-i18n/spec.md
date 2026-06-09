# ui-i18n Specification

## Purpose
TBD - created by archiving change i18n-studio-react-i18next. Update Purpose after archive.
## Requirements
### Requirement: 界面语言初始化

系统 SHALL 在服务端与客户端使用同一份 i18next 配置初始化界面国际化实例，注册 `zh-cn`（默认/回退语言）与 `en-us` 两套语言资源，并按命名空间（namespace）组织资源，使界面文案可通过 `useTranslation` 在组件中读取。

#### Scenario: 默认语言渲染

- **GIVEN** 请求未携带 `lang` cookie
- **WHEN** 用户访问任意界面页面
- **THEN** 系统以 `zh-cn` 渲染所有已 key 化的界面文案

#### Scenario: 缺失 key 回退

- **GIVEN** 当前语言为 `en-us` 且某个 key 在 `en-us` 资源中缺失
- **WHEN** 组件请求该 key 的翻译
- **THEN** 系统回退到 `zh-cn` 对应文案，而非显示原始 key 字符串

### Requirement: 语言持久化

系统 SHALL 通过名为 `lang` 的 cookie 持久化用户选择的界面语言，cookie 助手 SHALL 校验语言取值，仅接受受支持的语言代码（`zh-cn`、`en-us`），非法值一律回退默认语言。

#### Scenario: 写入语言 cookie

- **WHEN** 用户切换界面语言到 `en-us`
- **THEN** 系统通过 `Set-Cookie` 写入 `lang=en-us`，并在后续请求中保持 `en-us`

#### Scenario: 拒绝非法语言值

- **GIVEN** 请求携带 `lang=fr-fr` 这类未受支持的语言 cookie
- **WHEN** 服务端读取语言
- **THEN** 系统忽略该值并回退到默认语言 `zh-cn`

### Requirement: SSR 语言注入与 hydration 一致性

系统 SHALL 在 root loader 中读取 `lang` cookie 得出当前语言，将其注入服务端渲染，使服务端首屏 HTML 与客户端 hydration 使用相同语言，避免 hydration mismatch；`<html lang>` 属性 SHALL 反映当前界面语言。

#### Scenario: SSR 与客户端语言一致

- **GIVEN** 请求携带 `lang=en-us`
- **WHEN** 页面完成服务端渲染并在浏览器 hydration
- **THEN** 服务端输出与客户端首帧均为 `en-us`，控制台无 hydration mismatch 警告

#### Scenario: html lang 属性反映当前语言

- **GIVEN** 当前界面语言为 `en-us`
- **WHEN** 页面渲染
- **THEN** `<html>` 元素的 `lang` 属性为 `en-us`（默认语言时为 `zh-cn`）

### Requirement: 用户侧语言切换

系统 SHALL 在公共外壳头部提供语言切换控件，控件提交到 `/api/lang` action；该 action SHALL 校验语言值、写入 `lang` cookie 并返回成功结果，使切换后无需手动刷新即可应用新语言。

#### Scenario: 通过控件切换语言

- **GIVEN** 用户当前界面语言为 `zh-cn`
- **WHEN** 用户在头部语言控件中选择 `en-us`
- **THEN** 系统提交到 `/api/lang`、写入 cookie，并将界面文案切换为英文

#### Scenario: 非法提交被拒绝

- **WHEN** 向 `/api/lang` 提交不受支持的语言值
- **THEN** action 返回 4xx 错误且不写入 cookie

### Requirement: 界面文案 key 化

系统 SHALL 将「公共外壳 + Dashboard 框架」的高频界面文案（app-shell 导航与菜单、landing hero/features、dashboard 导航与布局标签）抽取为 i18next key，消除这些区域中英文混杂的硬编码文案，使其随当前语言切换。

#### Scenario: 外壳文案随语言切换

- **GIVEN** 用户已切换界面语言到 `en-us`
- **WHEN** 渲染公共外壳与 Dashboard 框架
- **THEN** 已抽取区域（导航、菜单项、落地页标题等）显示英文文案，无残留硬编码中文

#### Scenario: 默认语言下文案统一

- **GIVEN** 默认语言 `zh-cn`
- **WHEN** 渲染首批被抽取的界面区域
- **THEN** 这些区域不再出现中英文混杂，统一显示简体中文文案
