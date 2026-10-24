# vela-remote-access Specification

## Purpose

让 macOS 用户在 Vela 中管理多台远程 Mac，并通过隔离的本地映射和内置 Web 工作区访问这些设备共享的 OpenCode V2 与 DSH。

## Requirements

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

#### Scenario: 清单声明服务协议
- **GIVEN** 远端 Vela 共享了一个 TCP 服务
- **WHEN** 客户端读取清单
- **THEN** 清单必须为每个服务声明协议，客户端必须据此选择访问方式；不认识协议声明的旧版客户端必须因清单版本不兼容而提示升级，而不得把 TCP 服务当作网页打开

### Requirement: 按协议提供访问方式
HTTP 转发 MUST（必须）交由默认浏览器打开。TCP 转发没有可供浏览器打开的地址，MUST（必须）改为显示可复制的 `host:port` 与对应客户端的连接命令，MUST NOT（禁止）提供“在浏览器中打开”。TCP 转发同样使用按“设备 + 服务”稳定的地址与端口。

#### Scenario: 转发 SSH
- **GIVEN** 远端设备共享了 SSH 服务
- **WHEN** 用户开始转发该服务
- **THEN** Vela 必须显示可复制的 `ssh -p <port> <user>@ssh-<device>.localhost` 命令，且不打开浏览器

#### Scenario: 转发 MySQL
- **GIVEN** 远端设备共享了 MySQL 服务
- **WHEN** 用户查看该转发
- **THEN** 连接命令必须使用 `127.0.0.1` 主机，避免 `mysql` 客户端把 `localhost` 类名称解析为 Unix socket

#### Scenario: 转发 ComfyUI
- **GIVEN** 远端设备共享了 ComfyUI
- **WHEN** 用户在浏览器中提交工作流
- **THEN** 请求必须保持一致的 Host 与 Origin 并通过 ComfyUI 的来源检查，WebSocket 进度推送必须正常工作

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

### Requirement: 按设备与服务隔离的稳定映射地址
Vela MUST（必须）为每个“设备 + 服务”派生独立且稳定的映射地址，使其 Cookie 与登录状态不会相互覆盖，并在重新转发和重启后保持不变。由于 Cookie 作用域只看主机名而不看端口，映射地址 MUST（必须）使用按“设备 + 服务”派生的 `<service>-<device>.localhost` 主机名，而不是裸 `127.0.0.1`；该主机名由 RFC 6761 保证解析到 loopback，不得要求用户修改 `/etc/hosts` 或安装任何系统组件。

#### Scenario: 同时登录两个服务
- **GIVEN** 用户先后转发同一远程 Mac 的 OpenCode 与 DSH
- **WHEN** 两个服务设置同名 Cookie
- **THEN** 两个服务必须分别保持各自的登录状态

#### Scenario: 两台设备上的同名服务
- **GIVEN** 用户转发两台不同远程 Mac 上的 OpenCode
- **WHEN** 两个服务设置同名 Cookie
- **THEN** 两条转发必须使用不同主机名，使两个登录态互不覆盖

#### Scenario: 重新启动应用
- **GIVEN** 用户已完成远程服务自身的登录
- **WHEN** 用户正式退出并重新启动 Vela，再次转发同一服务
- **THEN** 映射地址必须与之前一致，使浏览器中的登录态在服务策略允许时继续有效

#### Scenario: 重新转发同一服务
- **GIVEN** 用户已在某个远端服务中完成登录并停止了转发
- **WHEN** 用户再次转发同一设备的同一服务
- **THEN** Vela 必须复用同一映射地址，使登录态保持有效而不要求重新输入密码

### Requirement: 完整 Web 能力
被转发的链路 MUST（必须）透明支持目标服务依赖的导航、JavaScript、Cookie、SSE、WebSocket、文件上传与文件下载。浏览器自身的前进、后退、刷新、书签、密码管理与下载由浏览器提供，Vela 不得重新实现。

#### Scenario: OpenCode 终端连接
- **GIVEN** OpenCode 页面已在 Vela 中完成认证
- **WHEN** 页面创建终端 WebSocket 并持续交换数据
- **THEN** Vela 必须保持连接并将输入输出完整传输

#### Scenario: 刷新工作区
- **GIVEN** 当前服务页面进入错误状态
- **WHEN** 用户选择刷新
- **THEN** Vela 必须重新加载当前服务页面且保留有效会话数据

### Requirement: 断线反馈与恢复
远程连接中断时，Vela MUST（必须）保持当前设备和转发上下文，显示连接状态并提供自动恢复与手动重试，而不得静默丢弃映射。

#### Scenario: 使用期间远端离线
- **GIVEN** 用户正在远程服务工作区中操作
- **WHEN** 远端 Mac 失去连接
- **THEN** Vela 必须显示覆盖式离线状态并在连接恢复后允许重新加载当前服务

### Requirement: 远端服务持续刷新
Vela MUST（必须）在已保存设备的 manifest 发生变化后刷新服务列表，使先添加设备、后在远端启用或新增的服务无需重新添加设备即可出现。

#### Scenario: 远端后启用服务
- **GIVEN** 一台远端 Mac 已保存但当时未共享某项服务
- **WHEN** 远端随后启用该服务且本机刷新或自动轮询 manifest
- **THEN** 服务必须出现在原设备下且可建立映射

### Requirement: DSH Web 认证恢复
Vela MUST（必须）由共享 DSH 的 Mac 提供登录链接，访问端不得要求用户输入 DSH URL 或 token。共享端可为 DSH adapter 服务配置 DSH 输出日志路径；Vela 必须在每次返回 manifest 时读取其中最新一条与服务端口匹配的 `dsh web` loopback 启动地址，只把 `/?token=…` 作为该服务的打开路径发布给已授权设备。token 不得写入配置、日志或诊断。访问端打开 DSH 映射前必须重新拉取 manifest，刷新失败时使用缓存。非 DSH 服务不得配置或发布登录链接。

#### Scenario: 访问端自动登录 DSH
- **GIVEN** 共享端已为 DSH 配置输出日志，且日志中有当前进程的启动地址
- **WHEN** 访问端开始转发该 DSH 服务
- **THEN** 映射地址必须带上当前 `/?token=…`，访问端不得弹出认证输入

#### Scenario: DSH 重启后 token 变化
- **GIVEN** 访问端已缓存旧 manifest，而 DSH 重启后打印了新 token
- **WHEN** 访问端再次打开 DSH 映射
- **THEN** Vela 必须先刷新 manifest，并使用新 token

#### Scenario: 未配置日志
- **GIVEN** 共享端未配置 DSH 输出日志
- **WHEN** 访问端转发 DSH
- **THEN** Vela 必须直接打开 DSH 根路径，由 DSH 依据已有 Cookie 决定是否放行
