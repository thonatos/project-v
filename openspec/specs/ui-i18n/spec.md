# ui-i18n Specification

## Purpose
定义 i18n-studio 界面国际化的运行时行为:i18next 实例初始化、语言 cookie 持久化与校验、SSR 语言注入与 hydration 一致性、用户侧语言切换控件,以及高频界面文案的 key 化,使界面文案可随当前语言切换。
## Requirements
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

### Requirement: 语言持久化

系统 SHALL 通过名为 `lang` 的 cookie 持久化用户选择的界面语言，cookie 助手 SHALL 校验语言取值，仅接受 `SUPPORTED_LANGS`(由生成物派生)中的语言代码，非法值一律回退默认语言 `zh-cn`。

#### Scenario: 写入语言 cookie

- **WHEN** 用户切换界面语言到 `en-us`
- **THEN** 系统通过 `Set-Cookie` 写入 `lang=en-us`，并在后续请求中保持 `en-us`

#### Scenario: 拒绝非法语言值

- **GIVEN** 请求携带不在 `SUPPORTED_LANGS` 中的语言 cookie(如 `fr-fr`)
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

系统 SHALL 在公共外壳头部提供语言切换控件，控件 SHALL 基于 shadcn `Popover` + `Command` 实现可搜索的单选下拉(而非平铺 toggle),选项 SHALL 遍历 `SUPPORTED_LANGS` 动态生成而非手写,每项显示名 SHALL 优先使用母语名 `nativeLabel`、回退 `label`、再回退 `code`;控件提交到 `/api/lang` action；该 action SHALL 校验语言值、写入 `lang` cookie 并返回成功结果，使切换后无需手动刷新即可应用新语言。控件 SHALL 在语种数量为 3 个及以上时仍可用(不因横向空间溢出而失效)。

#### Scenario: 通过控件切换语言

- **GIVEN** 用户当前界面语言为 `zh-cn`
- **WHEN** 用户打开下拉并选择 `en-us`
- **THEN** 系统提交到 `/api/lang`、写入 cookie，并将界面文案切换为英文

#### Scenario: 选项遍历语种列表

- **GIVEN** `SUPPORTED_LANGS` 含 3 个及以上语种
- **WHEN** 用户打开语言切换下拉
- **THEN** 下拉列出全部受支持语种,每项显示名取自 `nativeLabel`(缺失时回退 `label` / `code`);新增语种无需修改切换器组件 JSX

#### Scenario: 非法提交被拒绝

- **WHEN** 向 `/api/lang` 提交不受支持的语言值
- **THEN** action 返回 4xx 错误且不写入 cookie

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

