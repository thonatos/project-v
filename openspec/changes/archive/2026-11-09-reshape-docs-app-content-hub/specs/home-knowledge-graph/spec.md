# Spec Delta

## REMOVED Requirements

### Requirement: 知识网络图谱

**Reason**: 首页改为 Docs、Blog、Projects 内容门户，不再使用标签关系驱动的 WebGL 图谱。

**Migration**: 通过首页三个栏目入口、精选项目、最新 Blog 和 Docs 分类发现内容。

### Requirement: 滚动叙事

**Reason**: 首页不再使用相机穿行和分区淡入组织内容。

**Migration**: 首页使用静态排版、留白和分隔线建立内容层级。

### Requirement: 首页 client-only 与降级

**Reason**: 首页已移除 WebGL 增强层，不再需要 client-only 图谱降级逻辑。

**Migration**: 首页主要内容始终以静态可用 DOM 呈现。
