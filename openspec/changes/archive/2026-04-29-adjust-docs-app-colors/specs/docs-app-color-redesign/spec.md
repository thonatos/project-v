## ADDED Requirements

### Requirement: docs-app 配色方案

docs-app SHALL use a warm off-white color scheme matching Claude's style:

- `--color-bg: #faf9f1` - 米白色 Body 背景
- `--color-bg-subtle: #f5f5f3` - 稍深的米白用于 hover 状态
- `--color-bg-card: #ffffff` - 纯白卡片背景
- `--color-text: #141413` - 深灰色用于正文
- `--color-text-muted: #6b6b6b` - 中灰色用于辅助文字
- `--color-border: #30302e` - 深灰边框
- `--color-border-subtle: #e5e5e3` - 浅灰边框
- `--color-primary: #141413` - 深灰色用于主要文字

#### Scenario: 米白色 Body 背景
- **WHEN** 用户访问 docs-app
- **THEN** 页面整体背景使用 #faf9f1 米白色

#### Scenario: Header 米白背景 + 深色边框
- **WHEN** 用户访问 docs-app
- **THEN** Header 使用 #faf9f1 米白背景，底部边框为 #141413 深色

#### Scenario: Footer 米白背景 + 深色边框
- **WHEN** 用户访问 docs-app
- **THEN** Footer 使用 #faf9f1 米白背景，顶部边框为 #141413 深色

#### Scenario: 白色内容卡片
- **WHEN** 用户浏览文档列表或详情
- **THEN** 内容区域使用 #ffffff 纯白背景卡片

#### Scenario: 边框颜色层级
- **WHEN** 页面渲染边框和分割线
- **THEN** 主边框使用 #30302e 深灰色，细分割线使用 #e5e5e3 浅灰色

### Requirement: 文档标题样式

页面 H1/H2/H3 标题 SHALL 使用深灰色 #141413。

#### Scenario: 文档详情页标题
- **WHEN** 用户访问文档详情页
- **THEN** 页面 H1 标题显示为 #141413 深灰色

#### Scenario: 文档列表页标题
- **WHEN** 用户访问文档列表页（首页）
- **THEN** 页面 H1 标题显示为 #141413 深灰色

#### Scenario: 文档内容内标题
- **WHEN** 用户浏览文档内容
- **THEN** H2/H3 标题显示为 #141413 深灰色，确保可读性

### Requirement: 链接和交互状态

链接 SHALL 使用深灰色，hover 时显示下划线作为视觉反馈。

#### Scenario: 链接默认状态
- **WHEN** 用户看到文档中的链接
- **THEN** 链接显示为 #141413 深灰色，无下划线

#### Scenario: 链接 hover 状态
- **WHEN** 用户鼠标悬停在链接上
- **THEN** 链接显示下划线，颜色保持 #141413

#### Scenario: 卡片链接 hover
- **WHEN** 用户鼠标悬停在文章卡片标题上
- **THEN** 标题显示下划线，颜色保持 #141413
