## MODIFIED Requirements

### Requirement: locale 管理页

i18n-studio SHALL 提供 `/dashboard/locales` 路由作为系统级 locale 字典管理页,任意已登录用户可读,仅 `user.isSuperuser` 可写。

#### Scenario: 普通用户访问只读

- **GIVEN** 已登录非 superuser 访问 `/dashboard/locales`
- **WHEN** 页面加载完成
- **THEN** 列表显示当前所有字典项
- **AND** 不显示 "Add"、"Edit"、"Disable"、"Delete" 按钮

#### Scenario: superuser 可执行写操作

- **GIVEN** 已登录 superuser
- **WHEN** 通过页面提交创建 / 编辑 / 启停 / 删除请求
- **THEN** 服务端 action 接受并执行;非 superuser 提交同样请求时返回 403

#### Scenario: 页面标题

- **GIVEN** 任意已登录用户访问 `/dashboard/locales`
- **WHEN** 浏览器加载完成
- **THEN** `<title>` 为 `Locales · i18n-studio`

#### Scenario: 禁用 builtin locale 强制二次确认

- **GIVEN** superuser 在 `/dashboard/locales` 列表中点击 builtin locale 行的"禁用"按钮(如 `zh-cn`)
- **WHEN** 视图层处理点击
- **THEN** 不立即提交禁用,而是先打开 `Dialog` 二次确认,文案明确提示"禁用 X 后,新建 namespace 默认会无 X 可选,确认?";仅当用户在 Dialog 中点击"确认"才发起 toggle 请求

### Requirement: locale 多选组件

i18n-studio SHALL 提供 `app/components/locale-multi-select.tsx`,基于 shadcn `Popover` + `Command` 实现,选项来源 SHALL 限定为系统字典中 `enabled=1` 的项,且 SHALL NOT 提供"添加自定义 locale"入口。

#### Scenario: 选项来源限定字典

- **GIVEN** 字典含 enabled 项 12 条 + disabled 项 1 条
- **WHEN** 用户打开多选组件
- **THEN** 列表仅展示 12 个 enabled 项;disabled 项不出现

#### Scenario: 不提供自定义入口

- **GIVEN** 多选组件已打开
- **WHEN** 检查弹层 DOM
- **THEN** 不存在任何允许用户输入并直接添加新 locale code 的输入或按钮(`+ 自定义 locale` 等)
- **AND** 弹层底部包含一段提示文字,引导用户去 `/dashboard/locales` 添加(superuser)或联系管理员(普通用户)

#### Scenario: 已选项以 Badge 展示

- **GIVEN** value=['zh-cn', 'en-us']
- **WHEN** 渲染触发器
- **THEN** 触发器内可见 2 个 Badge,各含 code 与 `×` 按钮,点击 `×` 可单独移除

#### Scenario: 表单序列化

- **GIVEN** 组件 `name="locales"`,value=['zh-cn', 'en-us']
- **WHEN** 表单提交
- **THEN** 表单数据中 `locales` 字段值为字符串 `zh-cn,en-us`
