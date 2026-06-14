# ui-i18n Specification (Delta)

## MODIFIED Requirements

### Requirement: 界面文案 key 化

系统 SHALL 将界面硬编码文案抽取为 i18next key,消除界面中英文混杂的硬编码文案,使其随当前语言切换。覆盖范围 SHALL 包含「公共外壳 + Dashboard 框架」的高频文案（app-shell 导航与菜单、landing hero/features、dashboard 导航与布局标签）,并 SHALL 扩展到本变更新增抽离的 `app/routes/*`、`app/components/*` 中尚未 key 化的中文文案。组件 SHALL 仅以 `t('ns.key')` 引用文案（不在源码中携带默认文案）;源语言（`zh-cn`）的实际文案 SHALL 承载于本地 locale JSON / studio,而非源码。新抽离的 key SHALL 可被 `i18n-key-extraction` 提取并纳入 push/pull 闭环。

#### Scenario: 外壳文案随语言切换

- **GIVEN** 用户已切换界面语言到 `en-us`
- **WHEN** 渲染公共外壳与 Dashboard 框架
- **THEN** 已抽取区域（导航、菜单项、落地页标题等）显示英文文案,无残留硬编码中文

#### Scenario: 默认语言下文案统一

- **GIVEN** 默认语言 `zh-cn`
- **WHEN** 渲染首批被抽取的界面区域
- **THEN** 这些区域不再出现中英文混杂,统一显示简体中文文案

#### Scenario: 新抽离文案纳入闭环

- **GIVEN** 本变更将某 `routes/` 页面的硬编码中文改写为 `t('ns.key')`,并把中文填入 `locales/zh-cn` 对应 JSON
- **WHEN** 运行 `i18n:extract`
- **THEN** 该 key 出现在本地 zh-cn 资源中,可经 push 推送到 `studio-ui` namespace
