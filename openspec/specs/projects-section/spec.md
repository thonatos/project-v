# projects-section Specification

## Purpose

定义项目索引和项目专用介绍页的公开行为，使访问者能了解项目定位、支持平台、获取方式与延伸资料，同时允许项目在统一站点外壳中保留自己的品牌表达。

## Requirements

### Requirement: Projects 索引

系统 SHALL 在 `/projects` 展示公开项目，并让每个项目条目提供名称、摘要、状态、支持平台和详情入口。

#### Scenario: 查看项目列表
- **GIVEN** 站点已登记 Vela 项目
- **WHEN** 用户访问 `/projects`
- **THEN** 页面显示 Vela 的摘要、状态、支持平台以及前往 `/projects/vela` 的入口

#### Scenario: 移动端查看项目列表
- **GIVEN** 用户使用窄视口设备
- **WHEN** 用户访问 `/projects`
- **THEN** 项目信息按单列展示且所有操作均可见、可聚焦

### Requirement: Vela 项目介绍

系统 SHALL 在 `/projects/vela` 提供面向潜在使用者的 Vela 介绍，说明产品用途、平台职责、工作方式、安全边界、系统要求以及可用的获取和文档入口。

#### Scenario: 理解 Vela 工作方式
- **GIVEN** 用户不了解 Vela 的内部实现
- **WHEN** 用户访问 `/projects/vela`
- **THEN** 页面通过文字和静态可理解的连接示意说明共享 Mac 如何经私人网络向自己的其他 Mac 或 iPhone 提供本地服务

#### Scenario: 使用 Vela 入口
- **GIVEN** Vela 的 macOS 稳定版本通过 GitHub Releases 发布
- **WHEN** 用户查看 Vela 项目页的操作区
- **THEN** 页面提供 macOS 下载、使用说明、技术文章和源码入口
- **THEN** 页面不宣称存在未确认的 App Store 或 TestFlight 下载入口

### Requirement: 项目品牌边界

项目专页 SHALL 保留站点统一 Header、Footer、键盘焦点和响应式规则，并可在整个页面外壳中使用项目自身的标志与品牌色。

#### Scenario: 查看 Vela 品牌页面
- **GIVEN** Vela 具有双帆标志和独立品牌色
- **WHEN** 用户访问 `/projects/vela`
- **THEN** Vela 页面外壳使用其项目标志与品牌色，同时全局导航和页脚保持 docs-app 的一致结构与交互
