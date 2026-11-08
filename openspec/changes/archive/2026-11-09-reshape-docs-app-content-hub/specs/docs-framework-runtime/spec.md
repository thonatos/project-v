# Spec Delta

## Purpose

定义 docs-app 在 React Router v8 基线下必须保持的静态构建、直接访问和本地开发验收行为，使框架升级不改变站点的开发与静态交付方式。

## ADDED Requirements

### Requirement: React Router v8 运行基线

docs-app SHALL 使用同一 React Router v8 系列的框架包，并满足该系列要求的 Node、React 与 Vite 最低版本。

#### Scenario: 安装 docs-app 依赖
- **GIVEN** 仓库使用受支持的 Node 与 pnpm 版本
- **WHEN** 安装 workspace 依赖
- **THEN** docs-app 的 React Router 框架包 SHALL 解析为相互兼容的 v8 版本
- **THEN** 不得出现 React Router、React 或 Vite 的不满足引擎或 peer dependency 错误

### Requirement: v8 静态构建兼容

升级后的 docs-app SHALL 继续使用禁用 SSR 的预渲染构建，并为全部公开路径生成可直接访问的静态结果。

#### Scenario: 构建静态站点
- **GIVEN** 内容与路由配置有效
- **WHEN** 执行 docs-app 生产构建
- **THEN** 构建成功并在 `build/client` 生成全部预渲染页面与静态资源

#### Scenario: 直接访问动态路径
- **GIVEN** 生产构建已经完成
- **WHEN** 用户直接打开一个 Docs、Blog 或 Projects 详情地址
- **THEN** 本地生产预览返回对应页面而不是未找到或框架错误

### Requirement: 本地开发验收

docs-app SHALL 使用持续运行且支持 HMR 的本地 dev server 完成功能测试与维护者 review，并在最终交付前单独验证生产构建。

#### Scenario: 启动 review 服务
- **GIVEN** 维护者需要测试或 review 页面功能
- **WHEN** 启动包内开发命令
- **THEN** 服务输出本地可访问地址
- **THEN** 维护者可通过 HMR 连续检查首页、Docs、Blog、Projects 与兼容迁移路径，无需为每次改动重启服务

#### Scenario: 最终验证生产产物
- **GIVEN** 功能 review 已完成
- **WHEN** 执行最终交付验证
- **THEN** 系统 SHALL 通过类型检查和生产构建验证 SSG 产物
