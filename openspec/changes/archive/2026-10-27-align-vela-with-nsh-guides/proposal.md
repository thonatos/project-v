# Proposal

## Why

Vela 已经使用 NSH signals、语义 token 和平台原生控件，但可写 signal 仍直接暴露给页面，多字段状态更新未形成原子事务，部分异步结果与定时器缺少明确所有权，若干菜单、列表和选择控件也绕过了 `nsh/base` 的行为契约。与此同时，现有 Vela 规范在设备地址、状态表达和 macOS 窗口能力上互相冲突，导致实现即使通过当前源码结构测试，也无法证明符合最新 NSH 设计与开发指南。

## What Changes

- 统一 `vela-ui-consistency` 与 `vela-macos-experience` 的冲突：设备列表只显示“状态文字 · 服务数”并保留非颜色状态图形，地址归入详情；macOS 继续采用固定尺寸工具窗口，不提供缩放或全屏。
- 收紧 macOS 与 iOS store 边界：可写 signal 保持私有，页面通过只读访问器和语义命令读取、修改状态；临时 UI 状态归属最窄的组件所有者。
- 按 NSH reactivity 模型整理派生状态、原子更新和异步工作：复用或高成本派生值使用 `computed`，共同构成不变量的写入使用 `batch`，轮询和刷新拒绝过期结果并具有可释放的生命周期。
- 优先使用 `nsh/base` 的 Button、Menu、Tab、Radio、Sheet/Dialog 等语义行为；保留原生控件时，明确其平台理由并补足键盘、焦点、选中、禁用和辅助功能契约。
- 将主题和原生控件颜色收敛到可随 light、dark 与宿主自定义主题更新的单一语义真源，清理普通布局中的未命名任意尺寸，并记录确属平台物理边界的例外。
- 为 Vela 声明实际使用的 NSH capabilities，并补充目标平台测试，覆盖键盘、VoiceOver/辅助状态、overlay 关闭与焦点返回、大字体、主题切换、减少动态效果和关键几何。
- 修正文档中的 NSH 工具链版本漂移，使开发文档、脚本提示与实际验证入口一致。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `vela-modularity`: 增加响应式状态所有权、只读 store 边界、原子更新、异步新鲜度、生命周期清理、capabilities 与目标平台验证要求。
- `vela-ui-consistency`: 统一跨端设备行、状态表达、语义控件、主题 token 和可访问交互状态要求。
- `vela-macos-experience`: 消除设备地址、状态重复和窗口全屏方面的冲突，并明确 macOS 语义组件、键盘与焦点行为。

## Impact

- 主要影响 `packages/apps/vela/macos/ui`、`packages/apps/vela/ios/ui`、共享 UI flows、两端 `nsh.json`、Vela 验证脚本与开发文档。
- Store 对页面的内部接口会调整，但 Core 控制协议、Go Core、持久化配置格式、服务映射行为和面向用户的功能范围保持兼容。
- UI atom 的实现基础可能变化；页面视觉应保持现有 Vela 语言，只修正语义、交互状态、主题跟随和辅助功能行为。
- 验证门会增加目标平台行为检查，可能暴露目前静态源码测试无法发现的问题。

## Rollback Plan

- 按“状态边界与响应式模型”“语义组件与主题”“目标平台验证”三个可独立回退的阶段提交；任一阶段出现平台回归时，回退该阶段而保留已通过的前置阶段。
- 保持 Core 协议和持久化格式不变，回滚不需要迁移或清理用户数据。
- 在替换自建交互组件期间保留原组件实现，直至两端 `nsh check`、现有验证门和新增目标平台验收全部通过；失败时恢复原组件调用点。
