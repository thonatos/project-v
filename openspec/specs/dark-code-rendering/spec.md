# dark-code-rendering Specification

## Purpose
TBD - created by archiving change docs-app-visual-revamp. Update Purpose after archive.
## Requirements
### Requirement: 暗色代码块
系统 SHALL 在暗色主题下将代码块渲染为下沉底色（深于页面背景）并配合微亮边框与轻内阴影，使其与页面形成清晰的"凹陷"层次而不糊入背景。

#### Scenario: 代码块可辨识
- **WHEN** 文章正文包含围栏代码块
- **THEN** 代码块底色深于页面背景并带微亮边框，边界清晰可辨

### Requirement: 高对比暗色语法高亮
系统 SHALL 重调 hljs 语法高亮配色为高对比暗色主题，保证关键字/字符串/注释/类型等 token 在深色底上具备足够对比度。

#### Scenario: 语法着色清晰
- **WHEN** 代码块经 rehype-highlight 高亮
- **THEN** 各语法类别在暗底上以高对比色呈现且彼此可区分

### Requirement: 暗色 inline code
系统 SHALL 将行内代码渲染为半透明主色底 + 主色文字，区别于普通正文与围栏代码块。

#### Scenario: 行内代码可区分
- **WHEN** 正文中出现行内 `code`
- **THEN** 其以半透明主色底与主色文字呈现，明显区别于周围文字

### Requirement: 暗色 mermaid 渲染
系统 SHALL 使 mermaid 图在暗色主题下正确显示，文字与线条在深色底上清晰，边框统一到设计体系 token。

#### Scenario: mermaid 图可读
- **WHEN** 文章包含 mermaid 代码块并渲染为图
- **THEN** 图中文字与连线在深色底上清晰可读，容器边框与全站体系一致

