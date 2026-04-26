## ADDED Requirements

### Requirement: MDX 文件解析与渲染
系统 SHALL 支持 MDX 格式文件的解析和渲染，允许在 Markdown 中嵌入 React 组件。

#### Scenario: 渲染基础 MDX 内容
- **WHEN** 用户访问包含 Markdown 文本的 MDX 文件
- **THEN** 系统正确渲染标题、段落、列表、代码块等 Markdown 元素

#### Scenario: 渲染内嵌 React 组件
- **WHEN** MDX 文件中包含 React 组件语法
- **THEN** 系统正确解析并渲染该组件

### Requirement: 代码块语法高亮
系统 SHALL 支持代码块的语法高亮显示，适用于技术文章场景。

#### Scenario: 显示高亮代码块
- **WHEN** MDX 文件包含指定语言的代码块（如 `tsx`、`ts`、`js`、`bash`、`python`、`go`、`rust`）
- **THEN** 系统应用对应语言的语法高亮样式

#### Scenario: 代码块带文件名标签
- **WHEN** 代码块标注文件名（如 `tsx:app.tsx` 或通过 meta 字段）
- **THEN** 代码块顶部显示文件名标签

#### Scenario: 显示行号
- **WHEN** 代码块配置显示行号
- **THEN** 代码块左侧显示行号序列

#### Scenario: 复制代码按钮
- **WHEN** 代码块渲染完成
- **THEN** 代码块右上角显示复制按钮，点击可复制代码内容

#### Scenario: 暗色模式适配
- **WHEN** 用户切换到暗色模式
- **THEN** 代码块背景和语法颜色自动适配暗色主题

### Requirement: 自定义 MDX 组件
系统 SHALL 支持自定义 MDX 组件，用于扩展 Markdown 渲染能力。

#### Scenario: 使用自定义组件
- **WHEN** MDX 配置中定义了自定义组件映射
- **THEN** 系统使用自定义组件替代默认渲染组件

### Requirement: 图片预览功能
系统 SHALL 支持点击图片放大预览功能。

#### Scenario: 点击图片放大预览
- **WHEN** 用户点击文档中的图片
- **THEN** 系统显示全屏预览模态框，图片居中放大显示

#### Scenario: 关闭图片预览
- **WHEN** 用户点击预览模态框外部或按 ESC 键
- **THEN** 系统关闭预览模态框，返回文档页面

#### Scenario: 预览图片缩放
- **WHEN** 用户在预览模态框中查看大图
- **THEN** 用户可以缩放和拖动图片查看细节