# Spec Delta

## Purpose

让 macOS 用户在 Vela 中管理多台远程 Mac，并通过隔离的本地映射和内置 Web 工作区访问这些设备共享的 OpenCode V2 与 DSH。

## ADDED Requirements

### Requirement: 远程 Mac 管理
Vela MUST（必须）允许用户通过私人名称添加、保存、查看和移除多台远程 Mac，并为每台设备显示可区分的连接状态和最近连接信息。

#### Scenario: 添加可用 Mac
- **GIVEN** 用户提供的私人名称对应一个在线且已授权的 Vela 实例
- **WHEN** 用户添加该 Mac
- **THEN** Vela 必须保存该设备并显示其公开的服务清单

#### Scenario: 添加无效地址
- **GIVEN** 用户提供的名称无法解析或目标不是兼容的 Vela 实例
- **WHEN** 用户尝试添加该 Mac
- **THEN** Vela 必须保留输入并显示可诊断的失败原因且不得创建可用设备记录

#### Scenario: 远程 Mac 离线
- **GIVEN** 已保存的远程 Mac 暂时无法连接
- **WHEN** 用户查看该设备
- **THEN** Vela 必须显示离线状态、最近连接时间和再次尝试操作

### Requirement: 版本化服务清单
远端 Vela MUST（必须）提供版本化的设备与服务清单，客户端必须只展示当前共享且可识别的服务，并在协议版本不兼容时阻止访问并提示升级。

#### Scenario: 获取兼容清单
- **GIVEN** 远端 Vela 使用客户端支持的协议版本
- **WHEN** 客户端刷新远端设备
- **THEN** 客户端必须显示设备名称以及已共享的 OpenCode 和 DSH 项目

#### Scenario: 清单版本不兼容
- **GIVEN** 远端 Vela 的清单版本不受当前客户端支持
- **WHEN** 客户端读取清单
- **THEN** 客户端必须停止创建服务映射并明确提示升级 Vela

### Requirement: 应用内本地映射
Vela MUST（必须）为打开的远程服务建立仅绑定 loopback 的本地映射，并通过自身私人连接访问远端；不得修改系统代理、DNS 或路由。

#### Scenario: 打开远程 OpenCode
- **GIVEN** 远程 OpenCode 在线且当前设备已获授权
- **WHEN** 用户选择“打开”
- **THEN** Vela 必须创建 loopback 映射并在内置 Web 工作区加载该本地地址

#### Scenario: 本地端口被占用
- **GIVEN** 首选本地映射端口不可用
- **WHEN** Vela 创建服务映射
- **THEN** Vela 必须选择可用的临时 loopback 端口且不得监听非 loopback 接口

### Requirement: 独立 Web 会话
Vela MUST（必须）为不同远程设备和服务隔离 Web 会话数据，使其 Cookie、缓存和登录状态不会因共享主机名或端口而相互覆盖。

#### Scenario: 同时登录两个服务
- **GIVEN** 用户先后打开同一远程 Mac 的 OpenCode 与 DSH
- **WHEN** 两个服务设置同名 Cookie
- **THEN** Vela 必须分别保持两个服务的登录状态

#### Scenario: 重新启动应用
- **GIVEN** 用户已完成远程服务自身的登录
- **WHEN** 用户正式退出并重新启动 Vela
- **THEN** Vela 必须在服务策略允许时恢复持久化的 Web 会话数据

### Requirement: 完整 Web 能力
内置工作区 MUST（必须）支持目标服务依赖的导航、JavaScript、Cookie、SSE、WebSocket、文件上传、文件下载以及前进、后退和刷新操作。

#### Scenario: OpenCode 终端连接
- **GIVEN** OpenCode 页面已在 Vela 中完成认证
- **WHEN** 页面创建终端 WebSocket 并持续交换数据
- **THEN** Vela 必须保持连接并将输入输出完整传输

#### Scenario: 刷新工作区
- **GIVEN** 当前服务页面进入错误状态
- **WHEN** 用户选择刷新
- **THEN** Vela 必须重新加载当前服务页面且保留有效会话数据

### Requirement: 断线反馈与恢复
远程连接中断时，Vela MUST（必须）保持当前设备和服务上下文，显示连接状态并提供自动恢复与手动重试，而不得呈现空白 WebView。

#### Scenario: 使用期间远端离线
- **GIVEN** 用户正在远程服务工作区中操作
- **WHEN** 远端 Mac 失去连接
- **THEN** Vela 必须显示覆盖式离线状态并在连接恢复后允许重新加载当前服务
