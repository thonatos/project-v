# Design

## Context

参见 `proposal.md` 的动机。Vela 的两个 TSX 客户端各有一个模块单例 store，页面既读取 accessor，也直接持有和写入 store 返回的 signals；共享 flows 通过结构化 `Signal<T>` 写入平台 store。macOS 已对 status load 做 promise 去重，iOS 的 status/remote refresh 仍可能重叠；两端都以手工计时器轮询。iOS 自建 `BottomMenu` 以 `Sheet + Button` 模拟菜单，macOS 的列表行、分段选择和单选组以 `View + role + onPress` 模拟行为组件。

现有 UI token 放在 `nsh.json.tailwind` 与平台 `ui/tokens.ts`，iOS 原生控件另有一份 raw hex 映射。当前结构、主题和对比度测试全部通过，但主要检查源代码形状，不能证明焦点、辅助状态、overlay 生命周期、文字缩放和宿主主题覆盖的运行行为。Core 协议、Go Core、持久化配置和用户工作流均是兼容边界。

## Goals / Non-Goals

**Goals:**

- 让 store 成为领域和跨页面状态的唯一写入边界，同时维持页面读取语法简洁。
- 让关联状态更新、共享派生值和并发异步结果符合 NSH signals 的执行与所有权模型。
- 用 NSH 标准行为组件承载菜单、选择、导航和浮层契约；仅在平台原生价值明确时保留自定义 native component。
- 让 TSX 与原生控件从同一运行时语义主题取值，并把字面几何限制在命名的平台例外中。
- 把真实交互和可访问行为纳入现有唯一验证入口。

**Non-Goals:**

- 不改变 Core JSON Lines 协议、Go Core、映射端口、配置文件格式或服务发现规则。
- 不重做 Vela 视觉品牌、信息架构或 macOS 固定工具窗产品决策。
- 不引入 Redux、MobX 或其他第三方状态库，也不要求把所有手工异步操作机械改写为 `resource`。
- 不合并 macOS 与 iOS 的平台 store；共享层只继续承载确实跨端一致的流程和纯投影。

## Decisions

### 1. Store 导出只读状态面与语义命令面

每个平台保留一个应用 store，但底层 `signal` 不再出现在公开返回对象中。公开状态以只读 accessor（或 `computed` accessor）暴露，所有变更通过按领域分组的命令完成，例如 `logs.selectLevel`、`rename.changeDraft`、`modals.dismiss`、`serviceEditor.changeTarget`。共享 flows 继续接收最小可写端口，但该端口只在 store 构造闭包内部组装，页面无法获得。

优先按现有领域逐组迁移，而不是先拆成多个文件。完成写入边界后，再依据文件责任将 auth、remotes、diagnostics、iOS browser session 和 macOS forwarding/editor 抽成内部子 store；公开 facade 保持稳定，避免页面与文件拆分同时变化。

替代方案：把 signals 全部放进 context。未采用，因为每个 NSH surface 已有独立 VM 和单例 store，context 不会解决直接写入与不变量问题，只会改变依赖注入方式。

### 2. 用 `batch` 表达事务，用 `computed` 表达共享派生值

按“一个用户意图/一个异步提交结果”划定 batch，而不是给每个 action 无差别套 batch。打开服务、关闭服务、切换页面、初始化/重置表单、应用 status snapshot、auth 阶段变化等会同时写多个字段的命令使用 `batch`，确保 effect 和 binding 只观察提交后的快照。

下列值优先改为 `computed`：排序后的 tailnet candidates、服务 rows、device groups、current service、selected device，以及被多个页面区域重复读取的身份派生值。常量复杂度、单点读取的轻量格式化保留普通 closure，避免把 reactive graph 无意义扩大。

一次打开服务的状态提交如下：

```text
[用户选择服务]
        |
        v
[store.openService command]
        |
        +--> batch: connecting snapshot
        |       stage + page + navigation + overlays
        |
        v
[Core openMapping request] -- token/revision --> [等待结果]
                                                |
                       +------------------------+----------------------+
                       |                                               |
                 token 仍有效                                    token 已过期
                       |                                               |
                       v                                               v
                batch: ready/error                              丢弃结果并清理映射
                       |
                       v
                 [bindings 更新]
```

替代方案：将所有状态合并为一个大对象 signal。未采用，因为它会让无关字段共享更新粒度，并削弱 NSH 精确订阅的优势。

### 3. 异步读取统一采用 revision/latest-wins 协议

为 status load、remote refresh 和 diagnostics refresh 建立内部 operation controller。每类操作维护 revision 与活动计数/当前 promise：

- 相同语义的可合并请求复用当前 promise；
- 必须允许重启的刷新递增 revision，只有当前 revision 可提交结果；
- `refreshing` 从活动 operation 派生或仅由当前 revision 结束，避免旧请求提前清除；
- 刷新期间保留已有设备和日志，首次加载、刷新与失败分别表达；
- store `start()` 返回 stop 函数，或由根组件 effect 注册 cleanup；所有轮询、retry 和 feedback timer 由 stop 统一释放；
- 页面局部 timeout 在所属 effect cleanup 中取消。

优先保留手工 controller。仅当 NSH `resource` 能自然表达 source、refetch 和宿主桥请求取消时才用于独立读取；持续轮询与跨命令编排不强制使用 resource。

异步刷新顺序如下：

```text
[UI/轮询触发 refresh]
          |
          v
[revision = revision + 1]
          |
          +--> 保留旧数据，标记 refreshing
          |
          v
      [Core 请求]
          |
          v
  [结果 revision == current?]
          | yes                         | no
          v                             v
  [batch 提交数据/错误]             [忽略过期结果]
          |
          v
  [结束当前 refreshing]
```

替代方案：取消所有并发请求。未采用，因为当前 native bridge 未证明每种请求都支持取消；revision guard 能先保证正确性，并可逐步利用支持 AbortSignal 的路径。

### 4. 语义行为优先由 `nsh/base` 提供

- iOS `BottomMenu` 改为 `nsh/base` 的 `Menu`/`MenuItem` 组合，保留现有底部呈现、分组、图标、危险项和关闭服务动作；每个 item 增加稳定 id，不再以 label 作 key。
- macOS 可点击 `ListRow` 以 `Button` 或 NSH 对应 press target 承载；视觉布局仍由 Vela `ListRow` 组件拥有。
- macOS `Segmented` 和 `RadioGroup` 优先改由 `Tab`/`RadioGroup`/`Radio` 等现有 base 行为组合。若当前 NSH 版本缺少满足平台键盘模型的组件，则保留应用包装层，但内部必须使用最接近的 base 语义组件，并用目标平台测试证明行为。
- macOS 原生 `NSSwitch`、原生 desktop button、iOS `UISwitch`、`UISegmentedControl`、SF Symbols 和 WebView 可保留，因为它们提供明确的平台原生能力；包装层必须暴露受控值、disabled、accessibility label/state 与主题更新。
- 应用按钮默认改为普通/default 语义；只有决策区明确默认提交的调用点选择 primary。导航项显式提供 selected 状态。

替代方案：保留所有 `View + role` 并补 class。未采用，因为视觉 state 无法替代 base 对焦点、键盘、dismissal 和辅助行为的所有权。

### 5. 将视觉角色迁移到 NSH runtime theme tokens

把 Vela 的颜色与主要 radius/font 角色放入 `nsh.json.theme`，TSX class 直接使用 `bg-background`、`text-muted-foreground` 等角色，原生控件通过 reactive `token(name)` 取值。`shared/tokens/base.json` 继续作为跨平台品牌输入，构建/校验确保它生成或匹配两个平台的 theme 定义；删除 `ios/ui/ui/tokens.ts` 中手写的 `nativeColor` hex 副本。

`ui/tokens.ts` 可以继续作为组合类和有限 size variant 的命名层，但不再负责用 `dark:` 拼接同一语义角色。平台安全区、WebView status bar band、原生 toolbar/grabber 和实测日志列可保留字面几何，需集中命名、注释来源并由 geometry test 覆盖；feature 调用点的 dialog width/height 等普通布局值迁入组件 size variant 或 theme token。

替代方案：仅增加测试保证第三份 hex 同步。未采用，因为同步副本仍不能响应 host theme overrides，无法满足运行时主题契约。

### 6. 显式 capabilities 与失败路径

分别盘点并声明：macOS 的 clipboard/open URL/宿主桥能力，iOS 的 clipboard/WebView/status bar/宿主桥能力。WebView 实际导航经过 Vela host native component，因此设计和文档要区分 NSH capability 与可信宿主组件的授权边界；宿主仍须将可导航目标约束为当前映射上下文，不能因 native component 绕过声明而扩大到任意地址。

剪贴板、外部 URL 与页面状态栏操作不再被视为必然成功；命令层捕获拒绝或无效返回，并在对应页面展示反馈。能力清单进入构建验证，防止未知键、过宽通配和平台无关授权。

### 7. 静态守卫与目标平台行为测试分层

保留现有 structure/theme 测试用于快速检查依赖方向、唯一实现、token 使用和关键文案。新增 NSH target 测试或宿主 UI 测试覆盖：

- Tab/Shift-Tab、方向键、Space/Enter 与快捷键；
- selected/checked/disabled/role/accessibility label；
- Menu/Dialog/Sheet 的 Escape、backdrop、返回和 focus return；
- 默认与增大文字、浅色/深色/host override、减少动态效果；
- 设备行、日志列、sheet 与焦点环在代表性尺寸/scale 下的 resolved bounds；
- latest-wins 与 timer cleanup 使用可控 deferred promise/fake clock 做 headless 测试。

聚合 `verify` 仍是唯一入口。可以把需要模拟器或特定运行环境的检查分成可复用脚本，但 release gate 必须调用它，不能形成只在人工清单中的第二套验证。

### 8. Gravatar 只使用 store signal

Core 根据当前身份和偏好生成 Gravatar URL，使用宿主 HTTP 客户端下载图片并返回 data URL，从而沿用宿主代理配置。两个平台 store 在成功提交 status 时将该值写入只读 `avatarSource` signal，账户头像直接交给 NSH `Image` 加载；偏好关闭或头像缺失时清空 signal。不增加持久缓存。

### 9. 测试按证据层级分工

结构测试仅扫描稳定静态边界：目录依赖、native bridge 隔离、store 写入边界、feature 禁止硬编码视觉值、配置与验证入口。它们不再解析组件函数、JSX 层级、class 组合、私有函数或源码行数。

### 10. macOS host 在 helper 启动时控制 Tailscale 代理

`tailscaleProxy` 默认开启，版本 1/2 配置迁移时也设为开启。关闭后 macOS host 仅为 `vela-core` 子进程合并 `TS_DISABLE_FEATURE=useproxy`，不删除进程继承的 `HTTP_PROXY`/`HTTPS_PROXY`，因此 Gravatar 等普通 Core HTTP 请求仍可使用代理。Tailscale feature 在 Go 包初始化时注册，无法安全热切换，所以设置页明确要求重启 Vela 后生效；iOS 与 Core 同进程，暂不展示该平台无法可靠应用的开关。

纯状态、投影、URL policy 和协议由 Node/Go/Rust 单元测试验证；焦点、选择、关闭、主题和 cleanup 由 NSH runtime/target 测试验证；布局通过 resolved bounds 或正式 host/真机产品页面验证。通用 NSH development host 只作为 shell smoke，不能命名为 product visual，也不产出正式视觉基线。

## Risks / Trade-offs

- [一次性收紧 store API 会产生大量调用点改动] -> 先增加只读 facade 与命令，再逐领域迁移页面；结构测试禁止新增 `.set()`，最后删除旧可写出口。
- [batch 改变 effect 执行次数，可能暴露依赖中间状态的隐含逻辑] -> 为关键状态转换先写快照/顺序测试，并把依赖中间状态的逻辑改成一个明确命令。
- [base Menu/Radio/Tab 与当前定制视觉存在差异] -> 保留 Vela presentation wrapper，仅替换内部行为 primitive；以契约和目标平台行为优先于像素级旧实现。
- [theme schema 迁移影响所有 class 名与原生颜色] -> 先建立新 theme token 和兼容映射，再逐组件切换；在删除旧 token 前运行 light/dark/override screenshot 与对比度校验。
- [capabilities 收紧可能在某平台拒绝现有功能] -> 从调用点生成审计清单，在开发构建中逐项验证拒绝日志；每个平台仅在行为测试通过后启用限制。
- [目标平台测试增加 CI 时间和环境依赖] -> 分离快速 headless checks 与必要 target smoke tests，缓存构建产物，但 release gate 不跳过平台契约。
- [现有 NSH 版本与在线指南 API 存在差异] -> 以项目锁定版本生成的 `.nsh/types` 和 `nsh check` 为签名权威；无法表达的规范先由应用 wrapper 补足，并记录升级阻塞，不使用不存在的 API。

## Migration Plan

1. 先更新测试基线与规范冲突断言，锁定设备行、状态文字/图形和固定工具窗行为。
2. 在不改页面外观的前提下增加 store readonly facade、语义命令、computed 与 operation controller 测试。
3. 分别迁移 macOS、iOS 页面，禁止页面直接 `.set()`；把组件局部状态、refs 和 timers 归还组件 owner。
4. 替换 Menu/ListRow/Segmented/Radio 等行为 primitive，并补 selected、focus、disabled 与 overlay 测试。
5. 迁移 runtime theme tokens 和原生 `token()` 读取，删除颜色副本，收敛任意几何。
6. 增加并验证两端 capabilities 与拒绝反馈，更新 NSH 版本文档。
7. 运行完整 `pnpm -F vela verify`、新增 target tests 和代表性真实设备/桌面 smoke test后进入发布门。
8. 将 Core 的 Gravatar URL 接入两端 store 的只读 signal，再复跑两端能力与 UI 验证。
9. 清理锁死实现的源码测试，将验证迁移到对应证据层并更新测试文档。

本变更包含向后兼容的新设置与用户可见行为，按 SemVer 评估为 `MINOR`，应用版本从 `0.1.0` 升至 `0.2.0`；新的 Apple 评审构建号从 `1` 升至 `2`。两端正式版本源保持一致，并从安装后的 macOS bundle 与 iPhone 设备元数据回读确认。

回滚按阶段进行。任何阶段失败只恢复该阶段的 facade 调用、behavior primitive、theme 或 capability 声明；Core 协议与持久化格式未改变，因此不需要数据回滚。
