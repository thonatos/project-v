## MODIFIED Requirements

### Requirement: Mermaid 流程图渲染
系统 SHALL 支持 Mermaid 语法流程图的渲染，并与 remark 处理流程兼容。

#### Scenario: 渲染流程图
- **WHEN** Markdown 文件包含 `mermaid` 语言标记的代码块
- **THEN** 系统将代码块渲染为 Mermaid 流程图

#### Scenario: 渲染时序图
- **WHEN** Markdown 文件包含 Mermaid 时序图语法（`sequenceDiagram`）
- **THEN** 系统正确渲染时序图

#### Scenario: 渲染类图
- **WHEN** Markdown 文件包含 Mermaid 类图语法（`classDiagram`）
- **THEN** 系统正确渲染类图

#### Scenario: remark 处理兼容
- **WHEN** remark 处理包含 Mermaid 代码块的 Markdown
- **THEN** Mermaid 代码块不被 remark 转换，保留原始内容供客户端渲染

### Requirement: Mermaid 组件封装
系统 SHALL 提供 React 组件封装 Mermaid 渲染逻辑。

#### Scenario: 使用 Mermaid 组件
- **WHEN** 代码使用 `<MermaidDiagram>` 组件并传入图表代码
- **THEN** 组件渲染对应的 Mermaid 图表

### Requirement: Mermaid 错误处理
系统 SHALL 在 Mermaid 语法错误时显示友好的错误提示。

#### Scenario: 处理语法错误
- **WHEN** Mermaid 代码块包含无效语法
- **THEN** 系统显示语法错误提示而非崩溃