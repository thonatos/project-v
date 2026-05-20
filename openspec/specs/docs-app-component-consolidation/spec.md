# docs-app-component-consolidation

## ADDED Requirements

### Requirement: TagChip 组件统一 tag 相关功能

`TagChip` 组件 SHALL 合并 `tag-badge.tsx` 和 `linked-tag-pill.tsx` 的功能，提供统一的 tag 显示和导航能力。

#### Scenario: 作为可点击 Tag 使用
- **WHEN** `TagChip` 组件的 `href` prop 被提供
- **THEN** 组件渲染为 `<Link>` 元素，可点击跳转至指定路由

#### Scenario: 作为纯展示 Tag 使用
- **WHEN** `TagChip` 组件没有提供 `href` prop
- **THEN** 组件渲染为 `<span>` 元素，仅用于显示 tag 信息

#### Scenario: 显示 Tag 数量
- **WHEN** `TagChip` 组件提供了 `count` prop
- **THEN** 组件在 tag 名称后显示对应的数量徽章

### Requirement: ArticleCard 组件统一文章卡片功能

`ArticleCard` 组件 SHALL 合并 `article-card.tsx` 和 `article-summary-card.tsx` 的功能，提供统一的文章卡片展示能力。

#### Scenario: 网格模式展示
- **WHEN** `ArticleCard` 组件的 `variant` prop 为 `"grid"`
- **THEN** 组件使用 `SummaryLinkCard` 基底样式，渲染为网格布局中的卡片

#### Scenario: 列表模式展示
- **WHEN** `ArticleCard` 组件的 `variant` prop 为 `"list"`
- **THEN** 组件使用通栏样式，包含底部分割线

#### Scenario: 显示标签
- **WHEN** `ArticleCard` 组件提供了 `tags` prop 且数组非空
- **THEN** 组件下方渲染对应的 `TagChip` 标签列表

### Requirement: ContentPanel 支持多种变体

`ContentPanel` 组件 SHALL 支持更多的样式变体，以满足不同场景的内容容器需求。

#### Scenario: 默认变体
- **WHEN** `ContentPanel` 的 `variant` prop 为 `"default"` 或未指定
- **THEN** 使用半透明白色背景和细边框样式

#### Scenario: 强调变体
- **WHEN** `ContentPanel` 的 `variant` prop 为 `"emphasis"`
- **THEN** 使用深色背景和 inset shadow 样式

### Requirement: 移除 next-themes 依赖

`ProseImage` 组件 SHALL 移除对 `next-themes` 的依赖，使用 docs-app 原生的图片处理方式。

#### Scenario: 基础图片展示
- **WHEN** `ProseImage` 组件接收 `src` 和 `alt` prop
- **THEN** 组件直接渲染图片，不做主题替换

#### Scenario: 图片灯箱效果
- **WHEN** 用户点击图片
- **THEN** 打开灯箱模式，支持缩放和拖拽

#### Scenario: 图片缩放控制
- **WHEN** 灯箱模式打开
- **THEN** 用户可以通过按钮或键盘控制图片缩放（+ / - / 重置）

#### Scenario: 关闭灯箱
- **WHEN** 用户按下 Escape 键或点击关闭按钮
- **THEN** 灯箱模式关闭，焦点返回到图片元素