## ADDED Requirements

### Requirement: Focus-visible 状态
系统 SHALL 为所有交互元素提供可见的 focus 状态，支持键盘导航用户识别当前焦点位置。

#### Scenario: 链接 focus 状态
- **WHEN** 用户使用 Tab 键聚焦导航链接
- **THEN** 链接显示 focus ring（ring-2 ring-primary）

#### Scenario: 按钮 focus 状态
- **WHEN** 用户使用 Tab 键聚焦按钮元素
- **THEN** 按钮显示 focus ring（ring-2 ring-primary）

#### Scenario: 点击不显示 focus ring
- **WHEN** 用户使用鼠标点击交互元素
- **THEN** 元素不显示 focus ring（仅键盘 focus 时显示）

### Requirement: Skip Link 跳转链接
系统 SHALL 提供跳过导航的 skip link，允许键盘用户直接跳转到主要内容区域。

#### Scenario: Skip Link 存在
- **WHEN** 页面渲染完成
- **THEN** 页面顶部存在 "跳转到主要内容" 链接（DOM 第一个交互元素）

#### Scenario: Skip Link 默认隐藏
- **WHEN** 用户使用鼠标浏览页面
- **THEN** Skip Link 不显示（opacity: 0）

#### Scenario: Skip Link focus 时显示
- **WHEN** 用户首次按下 Tab 键
- **THEN** Skip Link 显示并聚焦，用户可见并可点击

#### Scenario: Skip Link 功能
- **WHEN** 用户点击 Skip Link
- **THEN** 页面滚动到主内容区域，焦点移至主内容区域

### Requirement: 键盘导航支持
系统 SHALL 支持完整的键盘导航，确保所有交互元素可通过键盘访问。

#### Scenario: Tab 导航顺序
- **WHEN** 用户按 Tab 键
- **THEN** 焦点按 DOM 顺序依次移动（Header Logo → Footer → 主内容）

#### Scenario: Enter/Space 触发操作
- **WHEN** 用户在聚焦的链接/按钮上按 Enter 或 Space
- **THEN** 触发相应的点击操作

### Requirement: 品牌名防翻译
系统 SHALL 为品牌名 "ρV" 标记 `translate="no"`，防止自动翻译破坏显示。

#### Scenario: 品牌名防翻译标记
- **WHEN** 页面渲染 Header 或 Footer
- **THEN** "ρV" 文字被 `<span translate="no">ρV</span>` 包裹