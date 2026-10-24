# vela-private-network Specification

## Purpose

为 Vela 设备提供仅作用于应用自身连接的私人网络，使多台 Mac 可以在不改变操作系统 VPN、代理、DNS 或路由配置的情况下安全互联。

## Requirements

### Requirement: 应用内私人连接
Vela MUST（必须）仅将自身明确发起或接收的 Vela 连接路由到私人网络，并且不得创建系统 TUN、安装网络扩展或修改全局代理、DNS 与路由设置。

#### Scenario: 启动私人连接
- **GIVEN** macOS 已启用其他 VPN 或代理服务
- **WHEN** 用户启动 Vela 并连接私人网络
- **THEN** Vela 必须建立应用内连接且保持现有系统网络配置不变

#### Scenario: 退出 Vela
- **GIVEN** Vela 已连接私人网络
- **WHEN** 用户正式退出应用
- **THEN** Vela 必须关闭自身私人连接且不得改变其他应用的网络状态

### Requirement: 设备身份与交互认证
Vela MUST（必须）通过交互式认证加入用户的私人网络，不得在应用包中内置可复用的长期认证密钥，并且必须将设备身份持久化在当前用户的数据目录。

#### Scenario: 首次连接
- **GIVEN** 当前 Mac 尚无有效的 Vela 私人网络身份
- **WHEN** 用户选择连接私人网络
- **THEN** Vela 必须引导用户完成交互式认证并在成功后显示设备身份

#### Scenario: 应用重新启动
- **GIVEN** 当前 Mac 已完成认证且身份仍然有效
- **WHEN** 用户重新启动 Vela
- **THEN** Vela 必须恢复已有身份而无需再次要求登录

#### Scenario: 身份被撤销
- **GIVEN** 当前设备身份已过期或被管理员撤销
- **WHEN** Vela 尝试恢复连接
- **THEN** Vela 必须停止对远端服务的访问并明确提示用户重新连接

### Requirement: 远端调用方授权
共享服务的 Vela 实例 MUST（必须）识别连接方的私人网络身份，并且只允许符合本机授权策略的用户或设备访问服务。

#### Scenario: 已授权设备访问
- **GIVEN** 远端设备身份符合本机授权策略
- **WHEN** 远端设备请求一个已共享服务
- **THEN** Vela 必须允许连接进入对应服务代理

#### Scenario: 未授权设备访问
- **GIVEN** 远端设备身份不符合本机授权策略
- **WHEN** 远端设备请求任意共享服务
- **THEN** Vela 必须拒绝连接且不得向本地目标建立连接

### Requirement: 网络变化恢复
Vela MUST（必须）在网络中断、接口切换或私人连接暂时不可用后自动尝试恢复，并向界面提供连接中、已连接、离线和需要认证的可区分状态。

#### Scenario: 网络接口切换
- **GIVEN** Vela 正在通过私人网络通信
- **WHEN** Mac 从一个可用网络接口切换到另一个接口
- **THEN** Vela 必须重新建立私人连接并更新可见状态

#### Scenario: 自动恢复失败
- **GIVEN** Vela 已进行有限次数的自动重连
- **WHEN** 私人连接仍无法恢复
- **THEN** Vela 必须显示可执行的重试操作与可查看的错误详情

### Requirement: 设备身份与 Tailnet 可见性
Vela MUST（必须）直接显示当前 Tailscale LocalAPI 注册的设备名称并允许用户修改；修改名称必须通过 LocalAPI 更新 Tailscale 节点，同时持久化为下次启动的名称。修改前 MUST 校验名称为合法 Tailscale 主机名：以字母或数字开头，仅含字母、数字与连字符，最长 63 个字符；不合法时 MUST NOT 提交 LocalAPI，并在界面说明格式要求。该规则对 macOS 与 iOS 一致。界面必须显示当前嵌入节点的 Tailscale 状态、DNS 名称、IP、用户与 tailnet，并列出当前 tailnet 中可见的设备及其在线状态。

#### Scenario: 首次生成设备名
- **GIVEN** Vela 配置尚无设备显示名
- **WHEN** Core 首次启动
- **THEN** Vela 必须保存当前 macOS 主机名作为默认显示名

#### Scenario: 查看 Tailnet 设备
- **GIVEN** 嵌入节点已连接 Tailscale
- **WHEN** 用户查看设备页
- **THEN** Vela 必须显示本机连接详情和 LocalAPI 当前可见的 tailnet 设备

#### Scenario: 修改设备名为合法主机名
- **GIVEN** 用户在任一客户端打开重命名
- **WHEN** 输入由字母、数字与连字符组成且不超过 63 个字符的名称并保存
- **THEN** Vela 必须提交 LocalAPI 更新节点主机名，并持久化该名称

#### Scenario: 修改设备名为非法主机名
- **GIVEN** 用户在任一客户端打开重命名
- **WHEN** 输入包含空格、下划线、非 ASCII 字符，或以连字符开头，或超过 63 个字符
- **THEN** Vela 必须拒绝提交，保留对话框并说明合法格式
