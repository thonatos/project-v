## ADDED Requirements

### Requirement: Markdown 文件处理
系统 SHALL 使用 remark/rehype 生态系统处理 Markdown 文件。

#### Scenario: 解析 Markdown 文件
- **WHEN** 系统读取 `.md` 文件
- **THEN** 使用 remark-parse 解析 Markdown 内容

#### Scenario: 支持 GFM 语法
- **WHEN** Markdown 文件包含 GitHub Flavored Markdown 语法（表格、任务列表、删除线等）
- **THEN** remark-gfm 正确解析并渲染

#### Scenario: 解析 YAML Frontmatter
- **WHEN** Markdown 文件顶部包含 YAML frontmatter（title、date、description）
- **THEN** remark-frontmatter 正确提取元数据

#### Scenario: 生成 HTML 输出
- **WHEN** remark 处理完成
- **THEN** 使用 remark-rehype 和 rehype-stringify 生成 HTML

### Requirement: 代码块高亮
系统 SHALL 使用 rehype-highlight 为代码块添加语法高亮。

#### Scenario: 代码块高亮渲染
- **WHEN** Markdown 文件包含带语言标记的代码块
- **THEN** rehype-highlight 为代码添加 highlight.js 类名

#### Scenario: 未指定语言的代码块
- **WHEN** 代码块未指定语言
- **THEN** 使用 plaintext 作为默认语言进行高亮