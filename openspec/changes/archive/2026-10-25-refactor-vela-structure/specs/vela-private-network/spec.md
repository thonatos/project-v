# Spec Delta

## MODIFIED Requirements

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
