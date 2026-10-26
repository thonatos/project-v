# Vela tests

本目录承载跨语言、跨平台的**结构契约**测试；各平台自己的测试留在对应目录内。

| 测试                    | 位置                                                                  | 覆盖                                                       |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| 平台/共享依赖方向       | `tests/structure.test.mjs`                                            | TypeScript import 图：平台之间不互相引用，共享层不引用平台 |
| iOS Core 依赖边界       | `scripts/verify-ios-deps.sh`                                          | Go：iOS 入口不链接发布、共享、本地探测、授权与入站包       |
| macOS 静态边界          | `macos/ui/tests/desktop-layout.test.mjs`                              | 分层、native bridge、store 写入和 feature 视觉值边界       |
| 共享投影                | `shared/ui/projections.test.mjs`                                      | 纯函数投影：设备、服务、转发、日志、诊断                   |
| iOS 投影                | `shared/ui/ios-projections.test.mjs`                                  | iOS 专属标签、徽标优先级、分组排序                         |
| 共享流程                | `shared/ui/flows.test.mjs`                                            | 登录/检查/重连/注销、重命名校验、远端增删、偏好            |
| 状态与异步所有权        | `shared/ui/operations.test.mjs`                                       | latest-wins、活动状态与计时器清理                           |
| NSH 运行时语义          | `macos/ui/tests/semantics.test.tsx`、`ios/ui/tests/semantics.test.tsx` | Button/Tab/Radio/Menu、受控状态、主题和 cleanup             |
| macOS shell smoke       | `macos/ui/tests/shell-smoke.test.tsx`                                | 通用 development host 下的导航与内容可达性，不作视觉验收   |
| 能力与 URL 边界         | `tests/capabilities.test.mjs` + Rust 单测                             | 最小 capabilities、外部 URL 与 iOS loopback WebView        |
| 主机名规则              | `shared/ui/hostname.test.mjs` + `core/internal/core/hostname_test.go` | 两端读同一份 `hostname-validation.json`                    |
| 发布前验证              | `scripts/verify.sh` → `pnpm -F vela verify`                           | 文档、协议、两端 UI、Rust、Go、依赖边界                    |
| 打包与签名              | `scripts/verify-release.sh` → `pnpm -F vela verify:release`           | 上面的全部 + 两端组包 + 签名                               |

`verify` 需要 `.nsh-version` 对应的 NSH v0.2.0 工具链；`scripts/nsh.sh` 优先使用 `NSH_SOURCE`，未设置时回退到安装器默认的 `~/.nsh/source`。

## 依赖不变量

```text
macos/**, ios/**    ->  shared/**, core/**      允许
shared/**, core/**  ->  macos/**, ios/**        禁止
macos/**            ->  ios/**                  禁止
```

## 测试证据边界

- 源码扫描只检查稳定静态边界：依赖方向、native bridge 隔离、store 写入边界，以及 feature 不直接写 raw 视觉值。
- 用户流程、状态和竞态由共享 Node/Go/Rust 单元测试验证。
- 焦点、选择、禁用、overlay、主题和 cleanup 由 NSH runtime/target 测试验证。
- 布局和产品视觉由 resolved bounds 或正式 Vela host/真机验收验证，不通过 JSX/class 正则推断。
- 通用 NSH development host 不注册全部 Vela 原生组件；其 shell smoke 不能作为正式产品截图或原生控件证据。
- CI 不提供可依赖的 iOS Simulator，也不能为当前 iOS 应用签名。iOS Simulator target semantics 是完成 change 前显式收集的本地补充证据，使用 `pnpm run verify:ios-acceptance`；归档后的 GitHub Actions、tag 与发布门只运行 common 和 macOS gates，iOS 使用已经记录的本地签名、真机和 Simulator 验收证据。

## 验收记录

手工验收（真实设备、双机、iOS 自动重试）记录在 `docs/verification/`，不进入本目录，也不作为自动化测试基线。
