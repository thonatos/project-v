# Spec Delta

## REMOVED Requirements

### Requirement: 导航栏布局结构

**Reason**: 早期布局包含已移除的分隔结构，当前导航由 `site-navigation` 定义。

**Migration**: Header 使用品牌、Docs、Blog、Projects 和 GitHub 的统一响应式布局。

### Requirement: 导航链接结构

**Reason**: All Tags、Technical、Trading 已不属于一级导航。

**Migration**: 使用 Docs、Blog、Projects 三个一级入口。

### Requirement: All Tags 页面路由

**Reason**: Tags 页面已下线。

**Migration**: 旧 `/tags` 地址迁移至 `/blog`。

### Requirement: Technical 页面路由

**Reason**: 站点不维护独立 Technical 专题路由。

**Migration**: 技术内容按其职责进入 Docs 或 Blog。

### Requirement: Trading 页面路由

**Reason**: 站点不维护独立 Trading 专题路由。

**Migration**: 相关文章通过 Blog 栏目浏览。

### Requirement: GitHub 链接

**Reason**: GitHub 链接由 `site-navigation` 统一定义。

**Migration**: 使用 Header 中的 GitHub 图标链接。

### Requirement: 移动端 TOC 与 GitHub 分割

**Reason**: 移动端 TOC 已改为页面右下角独立操作，不与 Header GitHub 图标共享分隔结构。

**Migration**: TOC 和 GitHub 保持各自明确的可访问入口。
