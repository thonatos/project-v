# Spec Delta

## ADDED Requirements

### Requirement: Tailscale 代理可由用户控制

macOS Vela SHALL 提供设置开关，控制 embedded Tailscale 是否使用启动应用时继承的 HTTP/HTTPS 代理。该设置 MUST NOT 改变 Gravatar 或其他宿主 HTTP 请求的代理行为。由于 Tailscale feature 在 helper 启动时初始化，界面 SHALL 明确提示更改在重启 Vela 后生效；旧配置迁移与新安装 SHALL 默认保持开启。

#### Scenario: 关闭 Tailscale 代理

- **GIVEN** 用户关闭「Tailscale 使用代理」并退出 Vela
- **WHEN** 用户重新启动 Vela
- **THEN** macOS host SHALL 仅为 `vela-core` 禁用 Tailscale `useproxy` feature，控制面与 DERP MUST NOT 使用继承代理，Gravatar 下载 SHALL 仍可使用宿主代理

#### Scenario: 保持 Tailscale 代理

- **GIVEN** 设置开启或旧配置没有该字段
- **WHEN** Vela 启动 `vela-core`
- **THEN** Tailscale SHALL 保持当前行为并读取继承的代理配置

## MODIFIED Requirements

### Requirement: PC 控制台主窗口

Vela 主窗口 MUST（必须）使用 macOS/NSH 系统默认标题栏和窗口控件，并提供固定窄图标导航与单一内容区；不得自绘标题栏或实现自定义窗口拖动。图标导航只包含设备、转发、日志、账户和设置，不支持展开；设备与转发在上，日志、账户与设置作为应用级页面置于底部。窗口为固定尺寸工具窗，不得可缩放或全屏，并且不得显示无作用的最大化按钮。正常在线状态不得作为独立导航项常驻；只有异常状态可以在设置图标上显示非颜色提示。

#### Scenario: 选择远程设备

- **GIVEN** 设备列表存在一台已保存的远程 Mac
- **WHEN** 用户选择该设备行
- **THEN** 同一主内容区必须从设备列表切换为该设备详情并显示状态和可打开服务，不得同时保留列表形成双栏

#### Scenario: 选择这台 Mac

- **GIVEN** 本机存在已添加的开发服务
- **WHEN** 用户从设备列表选择“这台 Mac”
- **THEN** 主区域必须显示共享总开关以及每项服务的可用和共享状态

#### Scenario: 固定工具窗的窗口能力

- **GIVEN** Vela 主窗口已经显示
- **WHEN** 用户查看窗口控件和窗口菜单
- **THEN** 窗口 MUST NOT 提供缩放、最大化或全屏入口，关闭与最小化行为 SHALL 保持 macOS 系统语义

### Requirement: 连接状态表达

Vela MUST（必须）通过状态文字、非颜色状态图形和设备/服务信息表达连接关系；状态图形仅作为文字的辅助扫读线索，状态不得仅依赖颜色，也不得以第二个文字标签或徽标重复。正常在线状态只在设备行、设备详情或设置的既定位置出现，离线、需要认证和不兼容必须提供具名说明与可执行恢复操作。

#### Scenario: 远程设备在线

- **GIVEN** 所选远程 Mac 在线且服务可用
- **WHEN** 设备概览显示
- **THEN** 界面必须以在线文字、设备身份和可用服务共同表达连接状态，状态图形 MAY 辅助扫读但 MUST NOT 重复文字标签

#### Scenario: 减少动态效果

- **GIVEN** macOS 已启用减少动态效果
- **WHEN** 连接状态发生变化
- **THEN** Vela 必须直接更新静态路径状态而不播放绘制动画

### Requirement: 原生菜单与键盘操作

Vela MUST（必须）提供符合 macOS 习惯的应用、文件、编辑、显示和窗口菜单，并支持设置、关闭窗口、切换一级页面、刷新服务、返回列表和退出等标准快捷键。固定工具窗 MUST NOT 提供全屏、缩放、展开或折叠命令；每个快捷键 SHALL 只有一个命令所有者，并与可见菜单或控件调用同一语义操作。

#### Scenario: 打开设置

- **GIVEN** Vela 正在运行
- **WHEN** 用户按下 `Cmd+,`
- **THEN** Vela 必须显示设置界面，并使当前导航项对视觉和辅助技术保持可辨认

#### Scenario: 切换到转发页面

- **GIVEN** Vela 正在运行
- **WHEN** 用户按下 `Cmd+2`
- **THEN** Vela 必须显示转发页面，结果 SHALL 与选择菜单项或导航控件一致

#### Scenario: 工具窗不进入全屏

- **GIVEN** 用户打开窗口菜单或尝试常见全屏快捷键
- **WHEN** Vela 主窗口是固定尺寸工具窗
- **THEN** 应用 MUST NOT 暴露或执行全屏命令

### Requirement: 列表行优先展示信息

列表行 MUST（必须）整行可点以进入详情，并把行宽优先用于设备名、「状态文字 · 可用服务数量」和非颜色状态图形；IP 与 MagicDNS 地址 SHALL 在详情页显示，MUST NOT 占用设备列表行。列表行 MUST NOT（禁止）放置删除等破坏性操作；破坏性操作 MUST（必须）通过详情页或上下文菜单提供并保留确认步骤。

#### Scenario: 浏览设备列表

- **GIVEN** 已添加若干其他设备
- **WHEN** 设备列表显示
- **THEN** 每行必须显示设备名、「连接状态 · 可用服务数量」与状态图形，MUST NOT 显示地址或删除按钮

#### Scenario: 查看设备地址

- **GIVEN** 用户需要查看某台设备的 IP 或 MagicDNS 地址
- **WHEN** 用户进入该设备详情
- **THEN** 详情页 SHALL 完整显示可用地址，并允许离线设备进入

#### Scenario: 删除设备

- **GIVEN** 用户想移除一台设备
- **WHEN** 用户在列表行唤出上下文菜单或进入该设备详情
- **THEN** Vela 必须提供删除入口并在执行前要求确认

### Requirement: 一项状态只呈现一次

一项状态 MUST（必须）只有一处文字表达；同一行 MAY 使用一个非颜色状态图形辅助扫读，但 MUST NOT 再增加表达相同含义的文字标签或徽标。状态 MUST NOT（禁止）仅依靠颜色区分。

#### Scenario: 查看设备状态

- **GIVEN** 设备列表中有一台在线设备
- **WHEN** 该行显示
- **THEN** 必须只出现一处「在线」文字，状态图形 SHALL 可在不辨色时仍被该文字解释

#### Scenario: 状态辅助图形

- **GIVEN** 设备状态由一个圆点或其他图形辅助表达
- **WHEN** 辅助技术读取该行
- **THEN** 行的可访问名称 SHALL 包含一次状态文字，装饰性图形 MUST NOT 再重复朗读相同状态

### Requirement: 可访问状态与错误恢复

所有关键状态 MUST（必须）同时提供文字和非颜色提示，错误必须说明受影响对象并提供下一步操作；主界面必须支持键盘导航、系统焦点环、增大对比度与减少动态效果。按钮、导航行、分段选择、单选和浮层 MUST 保留其平台语义、选中或选中值、禁用、关闭与焦点返回行为。

#### Scenario: 本地服务不可用

- **GIVEN** OpenCode 探测失败
- **WHEN** 用户查看“这台 Mac”
- **THEN** Vela 必须说明 OpenCode 未响应、显示检查地址并提供“再次检查”操作

#### Scenario: 键盘导航设备列表

- **GIVEN** 主窗口已显示多个设备
- **WHEN** 用户仅使用键盘移动焦点并选择设备
- **THEN** Vela 必须显示清晰系统焦点，宣布选中状态，并完成与指针操作相同的导航

#### Scenario: 关闭浮层后恢复焦点

- **GIVEN** 用户从一个可聚焦控件打开菜单、工作表或对话框
- **WHEN** 用户取消或完成该浮层
- **THEN** 浮层 SHALL 关闭并将键盘焦点返回触发控件或下一个合理目标
