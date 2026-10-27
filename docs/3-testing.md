# 3. 测试

## 3.1 分层与入口

| 范围 | 入口 | 覆盖内容 |
| --- | --- | --- |
| 根 workspace | `pnpm test`（`vp test run`） | `vite.config.ts` 声明的项目：`i18n-studio`、`gpm`、`dsh-telegram` |
| `go/` | `cd go && go test ./...` | 根 Go module 的单元与集成测试 |
| `vela` | `pnpm -F vela test` | Rust workspace、Go core，以及 `*.test.mjs` 行为测试 |
| `vela` 跨平台 | `pnpm -F vela verify` | 聚合门禁：common、macOS 与必要的发布检查 |

没有自动化测试的包：`docs-app`、`react-app`、`react-component`、`remix-api`、`remix-flow`、`artusx-api`、`libs/bot`、`libs/utils`。这些包的改动依赖构建、类型检查与人工行为验证，不要假装它们有测试覆盖。

`vela` 的专项测试还包括：`cargo test --manifest-path Cargo.toml --locked --workspace`、`node shared/ui/version.test.mjs`、`node shared/ui/flows.test.mjs`、`node macos/ui/tests/desktop-layout.test.mjs` 等；以 `pnpm -F vela run` 为准。

## 3.2 该测与不该测

应该断言：

- 用户或调用方可观察的输入、输出、状态、错误与持久化行为。
- 交互契约、并发与异步不变量、资源释放、兼容性边界。
- UI 的实际结果：解析后的 bounds、代表性截图、可访问状态、目标平台行为。
- 稳定的架构边界：禁止的依赖方向、协议兼容性、唯一公共入口。

不应该断言：

- JSX / 模板必须采用某一层嵌套、某个 wrapper 或某段 class 字符串。
- 私有函数名、局部变量名、源码行数，或可被等价实现替换的步骤。
- 用源码正则代替真实交互、布局、可访问性或集成测试。
- 把刚写的补丁形态固化为规范，尤其是在根因尚未证明时。

源码扫描只用于无法通过公共行为观察、且确实需要长期保持的静态边界。断言应描述边界本身，而不是当前由哪段 JSX、哪个函数名或哪条 class 实现。

## 3.3 证据类型

| 变更 | 可接受的证据 |
| --- | --- |
| 逻辑 / 数据 | 测试命令与退出码、用例名、失败前后对比 |
| Web UI | 解析后的 bounds、目标视口截图、可访问状态、部署 URL 上的实际表现 |
| Vela macOS / iOS | 目标平台交互或 Core 行为；Vela UI 不以截图或视觉基线作为验收方式 |
| Vela macOS 自动更新 | feed/签名/防降级使用 fixture 与真实 Sparkle signer；菜单、下载、安装、helper 清理和 relaunch 使用正式 Vela host 的目标 macOS 双 build 验收 |
| 发布 / 部署 | workflow job 结果、Release 资产清单、目标环境上的可复现命令输出 |

约束：

- headless 结果不等于真机结果；模拟器与 fixture 截图不等于产品页面截图。
- Vela 的 iOS Simulator 验收只能通过显式 `pnpm run verify:ios-acceptance` 收集，作为本地补充，不能替代真机结果；CI 没有 Simulator 与 iOS 签名能力。
- 自动更新 fixture 只能证明 feed 解析、签名拒绝和发布状态机；只有从实际安装的旧 build 更新到新 build，才能证明完整 `.app` 替换、退出清理和 relaunch。
- 记录实际结果与预期结果；只写“已验证”不构成证据。
