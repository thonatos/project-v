# vela-ui-consistency Specification

## Purpose

定义 Vela 两个客户端共享的界面契约：同一信息只呈现一次、账户页与设置/日志页的信息架构一致、跨端词表统一、同类选择使用相同语义，并且版本与协议信息来自同一真源。

## Requirements

### Requirement: 同一信息只呈现一次

同一账户、连接状态或设备身份信息，在同一页面上 SHALL 只出现一次。身份头、区块行与状态标记 MUST NOT 重复表达同一事实。

#### Scenario: 账户只出现一次

- **GIVEN** 用户已登录并打开账户页
- **WHEN** 页面渲染完成
- **THEN** 账户名 SHALL 只出现在身份头中，下方区块 MUST NOT 再出现「账户」行

#### Scenario: 连接状态只出现一次

- **GIVEN** 账户页同时有身份头和「私人连接」区块
- **WHEN** 展示当前连接状态
- **THEN** 状态 SHALL 只出现在「私人连接」区块，身份头 MUST NOT 再显示状态徽标

### Requirement: 账户页信息架构一致

两个客户端的账户页 SHALL 使用同一顺序：身份头（头像与账户名）、私人连接（状态与 Tailnet）、这台设备的身份、开发签名（仅 iOS）、注销。未登录时 SHALL 在同一位置提供登录入口。

#### Scenario: 两端区块顺序一致

- **GIVEN** 用户已登录并分别打开 macOS 与 iOS 的账户页
- **WHEN** 比较区块顺序
- **THEN** 两端 SHALL 依次为身份头、私人连接、设备身份、注销（iOS 在设备身份与注销之间多一个开发签名）

#### Scenario: 未登录状态

- **GIVEN** 账户尚未登录
- **WHEN** 用户打开账户页
- **THEN** 页面 SHALL 显示登录入口与说明，且 MUST NOT 显示空的设备身份区块

#### Scenario: 设备身份标题按平台命名

- **GIVEN** 用户查看设备身份区块
- **WHEN** 平台为 macOS 或 iOS
- **THEN** 标题 SHALL 分别为「这台 Mac」与「这台 iPhone」，其余字段（设备名称、MagicDNS、地址）一致

### Requirement: 跨端词表统一

两个客户端 SHALL 使用同一套用户词表：`私人连接` 指 Vela 的功能与连接状态，`Tailnet` 指网络与设备集合，`设备` 指被访问的远端设备（当前为 Mac）。MUST NOT 用「私人网络」与「私人连接」交替描述同一功能，也 MUST NOT 用「其他设备」与「其他 Mac」交替描述同一列表。

#### Scenario: 私人连接区块

- **GIVEN** 用户查看账户页
- **WHEN** 阅读连接状态与网络信息
- **THEN** 区块标题 SHALL 为「私人连接」，网络标识 SHALL 以「Tailnet」呈现

#### Scenario: 远端设备列表

- **GIVEN** 用户查看已保存的远端 Mac
- **WHEN** 阅读列表标题、空态与添加动作
- **THEN** 三处 SHALL 分别使用「其他设备」「还没有添加其他设备」「添加设备」

### Requirement: 同类选择使用相同语义

外观选择与日志级别选择 SHALL 使用同一分段选择语义：同一组选项、同一选中表达，并在两个客户端呈现一致的标签文案。

#### Scenario: 外观选择

- **GIVEN** 用户打开设置页
- **WHEN** 选择外观
- **THEN** 两端 SHALL 提供「跟随系统」「浅色」「深色」三个选项，且任意时刻只有一个选中

#### Scenario: 日志级别选择

- **GIVEN** 用户打开日志页
- **WHEN** 选择日志级别
- **THEN** 两端 SHALL 提供「全部」「错误」「警告」「信息」四段并显示各自计数，选中态唯一

### Requirement: 版本与协议来自同一真源

两个客户端的「关于」SHALL 显示应用版本与控制协议版本。应用版本 SHALL 来自共享常量，协议版本 SHALL 从 Core 读取；MUST NOT 在界面或诊断信息中写死协议编号。

#### Scenario: 两端版本一致

- **GIVEN** 两端来自同一次构建
- **WHEN** 用户查看「关于」
- **THEN** 应用版本 SHALL 相同，且与构建元数据的版本一致

#### Scenario: 协议版本与 Core 一致

- **GIVEN** Core 报告的控制协议版本为 v1
- **WHEN** 用户查看「关于」或复制诊断信息
- **THEN** 显示与复制的协议版本 SHALL 为 v1

#### Scenario: 版本漂移

- **GIVEN** 共享版本常量与任一 `nsh.json` 的版本不一致
- **WHEN** 运行校验
- **THEN** 校验 MUST 失败并指出不一致的来源

### Requirement: 设备行结构一致

设备列表行 SHALL 由图标、设备名、「状态 · N 个服务」与状态点组成。网络地址 MUST NOT 出现在列表行中，SHALL 在设备详情页显示；状态 MUST NOT 以行内徽标重复表达。

#### Scenario: 列表行不显示地址

- **GIVEN** 用户查看设备列表
- **WHEN** 阅读任意一行
- **THEN** 行内 SHALL NOT 出现 IP 或 MagicDNS 地址

#### Scenario: 状态与服务数

- **GIVEN** 一台在线且共享了两个服务的 Mac
- **WHEN** 用户查看该行
- **THEN** 行内 SHALL 显示「在线 · 2 个服务」，并以状态点表达连接状态

#### Scenario: 离线设备仍可进入详情

- **GIVEN** 一台设备处于离线状态
- **WHEN** 用户点按该行
- **THEN** 应用 SHALL 打开详情页并显示地址、服务与诊断信息，不要求设备在线

### Requirement: 设置页信息架构一致

设置页 SHALL 按「外观、共享（仅 macOS）、通用（仅 macOS）、隐私、诊断、关于」排列；「详细日志」与「复制诊断」SHALL 同属诊断区块；Gravatar 开关 SHALL 在两个客户端都可用。

#### Scenario: 诊断区块

- **GIVEN** 用户打开设置页
- **WHEN** 查看诊断区块
- **THEN** 区块内 SHALL 同时包含详细日志开关与复制诊断动作

#### Scenario: 平台特有区块

- **GIVEN** 某个设置只影响一个平台（如 macOS 的共享与窗口行为）
- **WHEN** 用户查看任一客户端的设置页
- **THEN** 该区块 MAY 只在一个客户端出现，其余区块 SHALL 对齐

### Requirement: 日志页信息架构一致

日志页 SHALL 使用分段选择级别并显示计数，提供刷新与复制日志动作，并按「暂无日志」与「该级别没有记录」区分空态。

#### Scenario: 按级别过滤

- **GIVEN** 日志中同时存在错误、警告与信息
- **WHEN** 用户选择「错误」
- **THEN** 列表 SHALL 只显示错误记录，计数保持各段真实值

#### Scenario: 空态区分

- **GIVEN** 日志为空或当前级别没有记录
- **WHEN** 用户查看列表
- **THEN** 两种情况 SHALL 显示不同的空态文案

#### Scenario: 复制日志

- **GIVEN** 当前存在可见日志行
- **WHEN** 用户触发复制日志
- **THEN** 剪贴板 SHALL 得到当前级别的日志行；没有日志行时该动作 SHALL 不可用
