## ADDED Requirements

### Requirement: 共享配色配置

系统 SHALL 提供共享的标签配色配置文件，消除重复代码。

#### Scenario: 配色配置导出
- **WHEN** 组件需要使用标签配色
- **THEN** SHALL 从 `~/lib/tag-colors.ts` 导入配置

#### Scenario: 配色配置结构
- **WHEN** 访问配色配置
- **THEN** SHALL 提供 TAG_COLORS 对象和 getTagColor 函数

## MODIFIED Requirements

### Requirement: Tag Badge 配色方案

Tag Badge SHALL 使用紫色系为主的配色，替代原有的暖色中性色调。

#### Scenario: 标签颜色分配
- **WHEN** 渲染 tag badge
- **THEN** SHALL 从紫色系颜色池中分配颜色，包括 violet、purple、fuchsia、indigo 等

#### Scenario: 标签悬停效果
- **WHEN** 用户悬停 tag badge
- **THEN** SHALL 显示对应色系的更深色 hover 状态

### Requirement: 标签列表页配色统一

标签列表页 SHALL 使用共享的配色配置，删除重复的 TAG_COLORS 定义。

#### Scenario: 标签列表页渲染
- **WHEN** 渲染 `/tags` 页面
- **THEN** SHALL 使用从 `~/lib/tag-colors.ts` 导入的共享配色

#### Scenario: 标签卡片 hover 效果
- **WHEN** 用户悬停标签卡片
- **THEN** SHALL 显示更深色的背景和文字颜色