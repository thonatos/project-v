# Spec Delta

## Purpose

为 Vela 提供低心智负担且符合 macOS 习惯的设备中心体验，使访问远程服务与共享本机能力共存而无需选择服务端或客户端模式。

## ADDED Requirements

### Requirement: 单一设备模型
Vela MUST（必须）在同一设备导航中展示“这台 Mac”和已保存的远程 Mac；选择本机时管理共享，选择远程设备时访问服务，界面不得要求用户选择互斥的服务端或客户端模式。

#### Scenario: 同时访问和共享
- **GIVEN** 这台 Mac 已启用本机共享且保存了一台远程 Mac
- **WHEN** 用户打开 Vela
- **THEN** 用户必须能从同一窗口管理本机共享并打开远端服务

#### Scenario: 首次使用
- **GIVEN** 用户首次启动 Vela
- **WHEN** 私人连接认证完成
- **THEN** Vela 必须引导用户发现本机服务和添加远程 Mac，而不得要求选择永久运行模式

### Requirement: 设备中心主窗口
Vela 主窗口 MUST（必须）提供设备侧栏、所选设备概览和持续可见的私人连接状态，并使用服务名称与用户动作而非 Gateway、Listener、Proxy 等内部术语。

#### Scenario: 选择远程设备
- **GIVEN** 侧栏存在一台已保存的远程 Mac
- **WHEN** 用户选择该设备
- **THEN** 主区域必须显示设备状态、连接路径和可打开的服务

#### Scenario: 选择这台 Mac
- **GIVEN** 本机检测到至少一项开发服务
- **WHEN** 用户选择“这台 Mac”
- **THEN** 主区域必须显示共享总开关以及每项服务的可用和共享状态

### Requirement: 连接路径表达
Vela MUST（必须）通过文字和图形连接路径共同表达本机、远端设备与服务之间的关系；状态不得仅依赖颜色，并且在系统启用减少动态效果时不得播放非必要路径动画。

#### Scenario: 远程设备在线
- **GIVEN** 所选远程 Mac 在线且服务可用
- **WHEN** 设备概览显示
- **THEN** 界面必须以完整路径、在线文字和可用服务共同表达连接状态

#### Scenario: 减少动态效果
- **GIVEN** macOS 已启用减少动态效果
- **WHEN** 连接状态发生变化
- **THEN** Vela 必须直接更新静态路径状态而不播放绘制动画

### Requirement: 专注式服务工作区
打开服务时 Vela MUST（必须）隐藏设备侧栏并最大化 Web 工作区，同时保留返回设备页、前进、后退、刷新、当前设备与服务名称和连接状态。

#### Scenario: 打开 OpenCode
- **GIVEN** 用户位于远程设备概览
- **WHEN** 用户打开 OpenCode
- **THEN** Vela 必须显示专注式 Web 工作区并在工具栏标识远端设备与 OpenCode

#### Scenario: 返回设备页
- **GIVEN** 用户正在服务工作区中
- **WHEN** 用户选择返回设备
- **THEN** Vela 必须恢复设备侧栏和此前所选设备的概览

### Requirement: 窗口关闭时保持运行
点击红色关闭按钮或执行 `Cmd+W` 时，Vela MUST（必须）隐藏窗口但继续保持私人连接、本机共享和活动映射；从 Dock 激活应用时必须恢复现有窗口而不重启核心连接。

#### Scenario: 关闭主窗口
- **GIVEN** Vela 正在共享本机服务
- **WHEN** 用户关闭主窗口
- **THEN** 窗口必须隐藏且远端设备仍可访问已共享服务

#### Scenario: 从 Dock 恢复
- **GIVEN** Vela 窗口已隐藏且核心仍在运行
- **WHEN** 用户点击 Dock 中的 Vela
- **THEN** Vela 必须恢复原窗口并显示当前实时状态

### Requirement: 正式退出时清理
只有应用菜单退出、Dock 退出或 `Cmd+Q` 才能终止 Vela；正式退出 MUST（必须）先停止新的连接、关闭共享入口和本地映射，再关闭私人连接与辅助进程。

#### Scenario: 使用 Cmd+Q 退出
- **GIVEN** Vela 存在活动共享和远程映射
- **WHEN** 用户按下 `Cmd+Q`
- **THEN** Vela 必须执行有界的优雅清理并最终终止应用

#### Scenario: 核心清理超时
- **GIVEN** 某个连接未在退出时及时关闭
- **WHEN** 优雅清理超过预设期限
- **THEN** Vela 必须强制结束自身辅助进程且不得阻止应用无限期退出

### Requirement: 原生菜单与键盘操作
Vela MUST（必须）提供符合 macOS 习惯的应用、文件、编辑、显示和窗口菜单，并支持设置、关闭窗口、切换侧栏、刷新服务、全屏和退出等标准快捷键。

#### Scenario: 打开设置
- **GIVEN** Vela 正在运行
- **WHEN** 用户按下 `Cmd+,`
- **THEN** Vela 必须显示设置界面

#### Scenario: WebView 获得焦点
- **GIVEN** 用户正在 OpenCode 或 DSH 工作区输入内容
- **WHEN** 用户使用页面内部快捷键
- **THEN** Vela 必须仅保留系统级应用快捷键并让其余按键优先传递给 Web 内容

### Requirement: 可访问状态与错误恢复
所有关键状态 MUST（必须）同时提供文字和非颜色提示，错误必须说明受影响对象并提供下一步操作；主界面必须支持键盘导航、系统焦点环、增大对比度与减少动态效果。

#### Scenario: 本地服务不可用
- **GIVEN** OpenCode 探测失败
- **WHEN** 用户查看“这台 Mac”
- **THEN** Vela 必须说明 OpenCode 未响应、显示检查地址并提供“再次检查”操作

#### Scenario: 键盘导航设备列表
- **GIVEN** 主窗口已显示多个设备
- **WHEN** 用户仅使用键盘移动焦点并选择设备
- **THEN** Vela 必须显示清晰焦点并完成与指针操作相同的导航
