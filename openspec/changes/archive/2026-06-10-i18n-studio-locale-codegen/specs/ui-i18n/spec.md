## MODIFIED Requirements

### Requirement: 界面语言初始化

系统 SHALL 在服务端与客户端使用同一份 i18next 配置初始化界面国际化实例，注册的语种集与各语种资源 SHALL 来源于 `app/i18n/generated.ts`(由 codegen 扫描 `app/i18n/locales/` 生成),而非在 `config.ts` / `lib/i18n.ts` 中手写;系统按命名空间（namespace）组织资源，使界面文案可通过 `useTranslation` 在组件中读取。默认/回退语言 SHALL 为 `zh-cn`。

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

### Requirement: 语言持久化

系统 SHALL 通过名为 `lang` 的 cookie 持久化用户选择的界面语言，cookie 助手 SHALL 校验语言取值，仅接受 `SUPPORTED_LANGS`(由生成物派生)中的语言代码，非法值一律回退默认语言 `zh-cn`。

#### Scenario: 写入语言 cookie

- **WHEN** 用户切换界面语言到 `en-us`
- **THEN** 系统通过 `Set-Cookie` 写入 `lang=en-us`，并在后续请求中保持 `en-us`

#### Scenario: 拒绝非法语言值

- **GIVEN** 请求携带不在 `SUPPORTED_LANGS` 中的语言 cookie(如 `fr-fr`)
- **WHEN** 服务端读取语言
- **THEN** 系统忽略该值并回退到默认语言 `zh-cn`

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
