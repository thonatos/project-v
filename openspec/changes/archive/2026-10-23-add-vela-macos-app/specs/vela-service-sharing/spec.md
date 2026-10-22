# Spec Delta

## Purpose

让用户从 Vela 安全地共享当前 Mac 上已运行的 OpenCode V2 与 DSH Web，同时保持服务绑定 loopback 且不改变这些服务的进程和认证机制。

## ADDED Requirements

### Requirement: 服务预设与探测
Vela MUST（必须）将 OpenCode V2 与 DSH 作为添加服务时的可选预设，而不得在新配置中自动创建；Vela 必须独立探测每项已添加服务，并将其显示为可用、不可用或检查中。探测不得启动、停止或重新配置服务进程。

#### Scenario: 发现 OpenCode
- **GIVEN** 用户从预设添加了 OpenCode，且 OpenCode V2 正在默认 loopback 地址提供 Web 服务
- **WHEN** Vela 对已添加服务执行探测
- **THEN** Vela 必须把 OpenCode 标记为可用

#### Scenario: DSH 未运行
- **GIVEN** 用户从预设添加了 DSH，且其默认 loopback 地址没有响应
- **WHEN** Vela 执行服务探测
- **THEN** Vela 必须把 DSH 标记为不可用并提供再次检查操作

#### Scenario: 探测 TCP 服务不触碰服务
- **GIVEN** 用户添加了 MySQL 服务
- **WHEN** Vela 周期性探测其可用性
- **THEN** Vela 不得向该端口建立连接或发送任何字节，必须仅通过监听状态判断可用性，避免触发目标服务的失败握手计数或封禁

#### Scenario: 探测特权端口
- **GIVEN** 用户添加了监听在 `22` 端口的 SSH 服务
- **WHEN** Vela 以普通用户权限探测
- **THEN** Vela 必须在不建立连接的前提下正确判断其是否在监听

### Requirement: 本机共享总开关
Vela MUST（必须）提供“共享这台 Mac”的总开关；关闭时必须停止所有远端服务入口，但必须保留访问其他 Mac 的能力和各服务的选择状态。

#### Scenario: 关闭本机共享
- **GIVEN** 本机正在共享 OpenCode 和 DSH
- **WHEN** 用户关闭“共享这台 Mac”
- **THEN** Vela 必须停止两个远端入口且不得停止本地 OpenCode 或 DSH

#### Scenario: 重新开启本机共享
- **GIVEN** 用户关闭共享前仅启用了 OpenCode
- **WHEN** 用户重新开启“共享这台 Mac”
- **THEN** Vela 必须恢复 OpenCode 的共享选择且保持 DSH 未共享

### Requirement: 按服务共享
Vela MUST（必须）允许用户分别启用或停用 OpenCode 与 DSH 的共享，并且只有总开关开启、服务已选择且本地服务可用时才提供对应远端入口。

#### Scenario: 仅共享 OpenCode
- **GIVEN** OpenCode 与 DSH 均可用且本机共享已开启
- **WHEN** 用户仅启用 OpenCode
- **THEN** 远端设备必须只能发现和访问 OpenCode

#### Scenario: 已选服务停止响应
- **GIVEN** OpenCode 已选择共享
- **WHEN** 本地 OpenCode 停止响应
- **THEN** Vela 必须把服务标记为不可用并拒绝新的代理连接

### Requirement: 透明 Web 代理
Vela MUST（必须）为已共享服务透明传输页面资源、Cookie、流式 HTTP、SSE、WebSocket、上传和下载，同时保留 OpenCode V2 与 DSH 自身的认证要求。

#### Scenario: OpenCode 实时会话
- **GIVEN** 远端用户已通过 OpenCode 自身认证
- **WHEN** 用户在 OpenCode Web 中发起包含实时事件和终端连接的会话
- **THEN** Vela 必须持续传输 HTTP、SSE 与 WebSocket 数据而不提前缓冲或超时断开

#### Scenario: 服务认证未完成
- **GIVEN** 远端用户尚未完成目标服务自身的配对或登录
- **WHEN** 用户打开共享服务
- **THEN** Vela 必须展示目标服务原生认证流程而不得绕过认证

### Requirement: 可配置 Loopback 服务
Vela MUST（必须）允许本机用户添加 HTTP 与 TCP 两类 loopback 服务，并允许编辑和移除所有已添加服务；目标必须由共享端本机配置，远端设备不得提供或覆盖代理主机、端口或 URL。添加入口 MUST（必须）按协议分为“Web 服务”与“TCP 服务”两组常显选项：Web 服务包含 OpenCode、DSH、ComfyUI 与自定义 HTTP；TCP 服务包含 SSH、Redis、MySQL、PostgreSQL 与自定义 TCP。预设必须自动填写已知名称、协议与默认 loopback 地址；OpenCode 与 DSH 保留各自 adapter 与固定 tailnet 端口。未声明协议的已有配置 MUST（必须）按 HTTP 迁移。

#### Scenario: 添加本机服务
- **GIVEN** 用户提供名称和 `localhost`、`127.0.0.1` 或 `::1` HTTP URL
- **WHEN** 用户保存服务
- **THEN** Vela 必须分配稳定服务标识和 tailnet 端口、探测服务并在用户启用共享后发布到清单

#### Scenario: 拒绝非 Loopback 服务
- **GIVEN** 用户提供 LAN 或公网目标，无论其协议为 HTTP 还是 TCP
- **WHEN** 用户尝试保存服务
- **THEN** Vela 必须拒绝配置且不得建立连接

#### Scenario: 添加 TCP 服务
- **GIVEN** 用户选择 Redis 预设
- **WHEN** 表单显示
- **THEN** Vela 必须填入 `127.0.0.1:6379` 并把协议设为 TCP，且不得要求填写 HTTP URL

#### Scenario: 迁移已有配置
- **GIVEN** 配置文件中的服务没有协议字段
- **WHEN** Vela 读取该配置
- **THEN** 这些服务必须被视为 HTTP 服务并保持原有行为

#### Scenario: 首次共享 SSH
- **GIVEN** 用户添加了 SSH 预设
- **WHEN** 用户首次开启其共享
- **THEN** Vela 必须明确提示该服务可获得这台 Mac 的命令行，并说明需在系统设置中开启远程登录

#### Scenario: 请求未知服务
- **GIVEN** 远端设备已获准连接 Vela
- **WHEN** 远端设备请求不在已发布清单中的服务标识
- **THEN** Vela 必须拒绝请求且不得连接任何本机地址

### Requirement: DSH Authority 兼容
Vela MUST（必须）向用户显示 DSH 对外访问所需的可信 authority，并在 DSH 因 Host 或 Origin 策略拒绝请求时给出可执行的配置指引，而不得静默绕过其安全检查。

#### Scenario: DSH 尚未信任 Vela 地址
- **GIVEN** DSH 正在运行但未配置 Vela 对外 authority
- **WHEN** 远端用户打开 DSH 且请求被其信任策略拒绝
- **THEN** Vela 必须解释拒绝原因并提供复制所需 authority 的操作
