# Spec Delta

## REMOVED Requirements

### Requirement: 导航栏显示 Home 外部链接

**Reason**: Header 品牌链接已作为站内首页入口，且导航由 `site-navigation` 统一定义。

**Migration**: 使用 Header 左侧 `ρV undefined project.` 返回站内首页。

### Requirement: 导航栏显示 GitHub 外部链接（仅图标）

**Reason**: GitHub 链接已经纳入 `site-navigation` 的统一主导航契约，本能力不再独立维护。

**Migration**: 使用 Header 中保留的可访问 GitHub 图标链接。

### Requirement: 外部链接视觉区分

**Reason**: 外链视觉与可访问性由统一站点导航负责，不再由早期导航能力重复约束。

**Migration**: 依照 `site-navigation` 和通用焦点样式呈现 GitHub 外链。
