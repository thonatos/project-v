## ADDED Requirements

### Requirement: TOC 目录生成
系统 SHALL 为文档生成目录（Table of Contents）数据。

#### Scenario: 提取标题层级
- **WHEN** remark 处理 Markdown 文件
- **THEN** 提取所有 h1、h2、h3 标题及其层级关系

#### Scenario: TOC 数据结构
- **WHEN** TOC 提取完成
- **THEN** 返回包含 id、text、depth、children 的树状结构

### Requirement: TOC 组件渲染
系统 SHALL 提供 TOC 目录导航组件。

#### Scenario: 显示 TOC 目录
- **WHEN** 文档页面渲染
- **THEN** TOC 组件显示在文档侧边栏

#### Scenario: TOC 标题跳转
- **WHEN** 用户点击 TOC 中的标题链接
- **THEN** 页面滚动到对应标题位置（使用 scroll-margin-top 确保正确对齐）

#### Scenario: TOC 当前位置高亮
- **WHEN** 用户滚动文档内容
- **THEN** TOC 高亮当前阅读位置的标题

#### Scenario: 响应式 TOC 显示
- **WHEN** 用户在移动端访问文档页面
- **THEN** TOC 侧边栏隐藏或折叠，通过按钮展开