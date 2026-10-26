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

外观选择与日志级别选择 SHALL 使用同一分段选择语义：同一组选项、同一选中表达，并在两个客户端呈现一致的标签文案。控件 MUST 以受控值呈现唯一选择，并向辅助技术暴露选中状态。

#### Scenario: 外观选择

- **GIVEN** 用户打开设置页
- **WHEN** 选择外观
- **THEN** 两端 SHALL 提供「跟随系统」「浅色」「深色」三个选项，且任意时刻只有一个视觉与辅助选中状态

#### Scenario: 日志级别选择

- **GIVEN** 用户打开日志页
- **WHEN** 选择日志级别
- **THEN** 两端 SHALL 提供「全部」「错误」「警告」「信息」四段并显示各自计数，视觉与辅助选中态 SHALL 唯一

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

设备列表行 SHALL 由图标、设备名、「状态文字 · N 个服务」与一个非颜色状态图形组成。状态图形是文字状态的辅助扫读线索，不构成第二份状态标签；网络地址 MUST NOT 出现在列表行中，SHALL 在设备详情页显示，且状态 MUST NOT 再以行内徽标重复表达。

#### Scenario: 列表行不显示地址

- **GIVEN** 用户查看设备列表
- **WHEN** 阅读任意一行
- **THEN** 行内 SHALL NOT 出现 IP 或 MagicDNS 地址

#### Scenario: 状态与服务数

- **GIVEN** 一台在线且共享了两个服务的 Mac
- **WHEN** 用户查看该行
- **THEN** 行内 SHALL 显示「在线 · 2 个服务」，并以状态图形辅助快速扫读

#### Scenario: 不依赖颜色理解状态

- **GIVEN** 用户无法区分状态图形使用的颜色
- **WHEN** 阅读设备行
- **THEN** 用户 SHALL 仍能从「状态文字 · N 个服务」确定连接状态，且 MUST NOT 看到第二个重复的状态文字或徽标

#### Scenario: 离线设备仍可进入详情

- **GIVEN** 一台设备处于离线状态
- **WHEN** 用户点按该行
- **THEN** 应用 SHALL 打开详情页并显示地址、服务与诊断信息，不要求设备在线

### Requirement: 设置页信息架构一致

设置页 SHALL 按用户任务组织，MUST NOT 为单个说明项创建无意义分组。两端保留「外观」与「关于」；macOS 将共享与 Tailscale 代理归入「连接与共享」，并将 Gravatar、详细日志、性能 HUD 与复制诊断归入「隐私与诊断」；iOS 将 Gravatar 保留在「隐私」，将详细日志与复制诊断保留在「诊断」。

#### Scenario: macOS 设置分组

- **GIVEN** 用户打开 macOS 设置页
- **WHEN** 浏览可配置项目
- **THEN** 页面 SHALL 依次呈现「外观」「连接与共享」「隐私与诊断」「关于」，MUST NOT 显示只包含静态“关闭窗口”说明的设置行

#### Scenario: iOS 设置分组

- **GIVEN** 用户打开 iOS 设置页
- **WHEN** 浏览可配置项目
- **THEN** 页面 SHALL 依次呈现「外观」「隐私」「诊断」「关于」，且「详细日志」与「复制诊断」SHALL 同属诊断区块

#### Scenario: 平台特有设置

- **GIVEN** 某个设置只在一个平台可靠生效
- **WHEN** 用户查看任一客户端的设置页
- **THEN** 该设置 MAY 只在对应平台出现，其余共享设置 SHALL 使用一致词汇和行为

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

### Requirement: 交互控件保留平台行为契约

按钮、菜单、选项卡、单选、开关、对话框和工作表 SHALL 使用能够提供对应平台语义的标准行为组件。应用自定义外观 MUST 保留键盘或触摸激活、焦点、选中或选中值、禁用、关闭、辅助角色与焦点返回行为；自行实现行为时 MUST 有标准组件无法满足的书面平台理由。

#### Scenario: 键盘操作选择控件

- **GIVEN** 用户使用键盘访问 macOS 的分段选择或单选组
- **WHEN** 焦点移动并触发一个选项
- **THEN** 控件 SHALL 显示系统可辨认的焦点和唯一选中状态，并产生与指针操作相同的结果

#### Scenario: 关闭顶层浮层

- **GIVEN** 菜单、工作表或对话框位于界面最上层
- **WHEN** 用户按 Escape、执行平台返回操作或触发允许的背景关闭
- **THEN** 只有最上层浮层 SHALL 关闭，显式 open 状态 SHALL 同步，并将焦点返回触发器或下一个合理目标

#### Scenario: 读取当前导航项

- **GIVEN** 用户通过辅助技术浏览主导航
- **WHEN** 到达当前页面对应的导航控件
- **THEN** 控件 SHALL 宣布其选中状态，MUST NOT 只通过边框、图标或颜色传达当前项

### Requirement: 重复项目使用稳定身份

可插入、删除、排序或翻译的重复项目 MUST 使用稳定领域标识维护界面身份。可翻译标签、可变列表位置与渲染时生成的随机值 MUST NOT 作为此类项目的身份。

#### Scenario: 菜单文案被翻译

- **GIVEN** 菜单项目在不同语言中具有不同标签
- **WHEN** 应用切换语言或更新显示文案
- **THEN** 菜单项目 SHALL 保持相同领域身份及其焦点状态，不得因标签变化被视为另一项目

#### Scenario: 设备顺序改变

- **GIVEN** 设备列表因在线状态变化而重新排序
- **WHEN** 列表更新
- **THEN** 每一设备行 SHALL 依据设备标识保留自身身份，MUST NOT 依据新索引继承其他设备的状态

### Requirement: 视觉值来自语义系统

应用界面的颜色、文字、间距、圆角与普通控件尺寸 MUST 来自语义主题或应用组件的有限尺度。确属平台安全区、原生控件物理几何、栅格边界或实测布局约束的字面值 MAY 保留，但 MUST 在共同所有者处命名并说明理由；界面 MUST 在浅色、深色和宿主自定义主题下保持可读。

#### Scenario: 宿主主题变化

- **GIVEN** 宿主在运行时切换语义主题
- **WHEN** Vela 界面和原生控件重新显示
- **THEN** 所有表面、文字、图标和控件 SHALL 使用新主题角色，MUST NOT 显示硬编码的旧色值

#### Scenario: 审查任意尺寸

- **GIVEN** 功能页面新增普通间距、行高、对话框尺寸或图标尺寸
- **WHEN** 运行设计系统校验
- **THEN** 未使用既有尺度且没有平台边界说明的字面值 MUST 使校验失败

#### Scenario: 用户增大文字

- **GIVEN** 用户提高系统文字缩放比例
- **WHEN** 打开包含标题、列表和操作按钮的页面
- **THEN** 文字 SHALL 保持可读且不得被固定框裁切，触控目标、焦点环与主要操作 SHALL 仍可使用

### Requirement: Gravatar 头像状态保持简单

用户启用 Gravatar 后，Core SHALL 使用宿主网络下载头像并返回 data URL，Vela SHALL 将它保存在 store 的只读 signal 中并交给原生图片组件加载。关闭 Gravatar、注销或 Core 不再返回头像时 SHALL 清空该 signal；图片加载失败时 SHALL 显示首字母回退。Vela MUST NOT 为单张头像增加持久缓存机制。

#### Scenario: Core 返回头像 URL

- **GIVEN** 用户已启用 Gravatar 且 Core status 包含头像 data URL
- **WHEN** store 提交该 status
- **THEN** 账户头像 SHALL 使用该 data URL，页面不得自行下载或维护第二份状态

#### Scenario: 隐私设置关闭

- **GIVEN** 当前 signal 包含头像 URL
- **WHEN** 用户关闭「使用 Gravatar 头像」或注销后 Core 不再返回 URL
- **THEN** Vela SHALL 清空 signal 并恢复首字母显示
