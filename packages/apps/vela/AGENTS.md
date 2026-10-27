# Vela Agent Guidelines

本文件适用于 `packages/apps/vela/**`，在仓库根 `AGENTS.md` 之上补充 Vela 专属规则。

## 边界

- 拥有：`macos/`（NSH UI + Rust host + 打包输入）、`ios/`（NSH UI + Rust host + Xcode 工程）、`shared/`（协议、投影、tokens）、`core/`（Go module `implements.io/vela`）、`scripts/`、`tests/`、`docs/`。
- 不拥有：根 CI 的 Node/Go 门禁、其他应用、根 `docs/`。改 `go/` 走 `go/AGENTS.md`。
- 依赖方向：`macos/**`、`ios/**` 可依赖 `shared/**`、`core/**`；反向禁止；`macos/**` 与 `ios/**` 互不依赖。完整说明见 `docs/1.3`。

## NSH 规范

实现必须遵守当前锁定 NSH 版本的 API，并以官方规范作为设计与评审基准：

- Design Guides: <https://nsh.dev/docs/design-guides/>
- Coding Guides: <https://nsh.dev/docs/coding-guides/>
- Reactivity / Signals: <https://nsh.dev/docs/reactivity/#signals>

在线指南表达原则；实际 API 签名以锁定版本生成的 `.nsh/types`、NSH 源码和 `nsh check` 为准。版本有差异时不得猜测 API。

## 设计规范

- 保留平台习惯。macOS 与 iOS 可以有合理的原生视觉差异，但必须先证明差异来自平台组件，而不是重复 inset、错误尺寸或局部 wrapper。
- 页面使用既有统一容器。局部区域不得重复添加页面已经拥有的 screen inset、scroll owner 或背景表面。
- 若同一个组件在一个页面正常、另一个页面异常，先逐层比较两个页面的父容器和输入；不要先修改公共组件。
- 优先使用 `nsh/base` 的 Button、Menu、Tab、Radio、Sheet、Dialog 等行为组件；应用层负责视觉语言，不重复实现焦点、键盘、dismissal 和辅助功能。
- 使用语义 theme token，不在 feature 中硬编码颜色；原生控件也必须跟随 runtime theme。
- 使用有限、命名的间距、圆角、字体和控件尺度。字面值只用于经过说明和验证的平台物理边界或实测几何。
- 状态不能只靠颜色表达。selected、checked、disabled、loading、error、focus 等状态必须清晰且可访问。
- iOS 触控目标至少 44pt；macOS 保持合适桌面密度和清晰焦点。

## 编码与状态管理

- 使用 NSH 官方 signals；组件函数只创建一次，读取必须发生在响应式 binding、`computed` 或 `effect` 中的正确位置。
- Store 的可写 signals 保持私有。页面读取 accessor，并通过语义命令请求修改；不得直接调用 store signal 的 `.set()`。
- 多处读取或包含排序、分组等非平凡计算的派生值使用 `computed`；廉价单次派生可使用普通 accessor。
- 构成同一不变量的多字段写入使用 `batch`，避免观察者读到中间状态。
- `effect` 只用于副作用，不用于复制派生状态；派生值使用 `computed`。
- 异步读取必须处理竞态：复用相同请求或使用 revision/latest-wins，过期结果不得覆盖当前状态。
- timer、effect、订阅、ref 和重试属于创建它们的 owner，并在 owner 销毁时 cleanup。组件局部状态不得无故提升为模块级全局状态。
- TSX 对象和数组必须以新引用更新，不得原地修改后写回同一引用。
- repeated UI 使用稳定领域 ID，不能用翻译文案或可变索引作为 identity。

## Vela 测试规则

- UI 布局问题必须优先通过实际 bounds、目标平台交互或产品页面截图验证。
- 不得通过源码正则锁定 JSX 层级、wrapper、class 字符串或局部函数名。
- 源码扫描只用于稳定静态边界，例如平台目录不得互相引用、共享层不得依赖平台、feature 不得直接访问 native bridge 或写 store signal。
- macOS/iOS 原生组件测试需要区分通用 NSH development host、正式 Vela host、模拟器和真机能力；缺少原生组件注册的 fixture 结果不能代表正式 App。
- 修复单页异常时，测试应比较可观察结果或同类页面的 resolved geometry，不应要求该页面复制另一页面的源码结构。
- 不使用截图、截图对比或视觉基线作为 Vela UI 验收方式；除非用户明确要求，否则不得生成、读取或分析 Vela UI 截图。

## 版本与发布

通用 SemVer 判定与评估动作见 `docs/5.2`。Vela 特有约束：

- 每个准备交付、安装或提交评审的变更集合完成后都必须评估版本，不得因未打 tag 或只是本地 review build 而跳过。
- 两端必须使用同一营销版本和 build number。更新版本时同步以下正式来源：`package.json`、`shared/ui/version.ts`、`macos/ui/nsh.json`、`ios/ui/nsh.json`、`macos/app/Info.plist`、`ios/app/Vela/Info.plist`、`ios/app/Vela.xcodeproj/project.pbxproj`。
- 每次生成新的 macOS/iOS 评审或发布构建，都必须递增正整数 Apple build number（`CFBundleVersion` / `CURRENT_PROJECT_VERSION` / `nsh.json.build`）；同一份二进制的重复安装不得伪造新 build。
- 历史验收记录和旧版本场景的 fixture 不得为了通过检查而改写。
- 版本更新后运行 `node shared/ui/version.test.mjs`；发布 tag 还必须运行 `node scripts/release/check-version.mjs --tag vela-vX.Y.Z`。安装后应从实际 macOS bundle 与目标 iOS 设备读取版本，不能只引用源码值。
- 发布通道、tag 与回滚见 `docs/5.1`–`5.4`。

## 验证入口

在 `packages/apps/vela` 中优先运行受影响的专项检查：

| 变更类型        | 命令                                                                         | 期望结果                   |
| --------------- | ---------------------------------------------------------------------------- | -------------------------- |
| macOS UI        | `sh scripts/nsh.sh check macos/ui/App.tsx`                                   | 退出码 0                   |
| iOS UI          | `sh scripts/nsh.sh check ios/ui/App.tsx`                                     | 退出码 0                   |
| 共享流程 / 状态 | 对应的 `node shared/ui/*.test.mjs`                                           | 全部通过                   |
| Rust host       | `cargo test --manifest-path Cargo.toml --locked --workspace`                 | 全部通过                   |
| Go core         | `go test -C core ./...`                                                      | 全部通过                   |
| 目标平台交互    | 对应的 `nsh test ... --target macos\|ios`                                    | 目标平台行为符合预期       |
| 自动更新 feed   | `node tests/update-feed.test.mjs && node tests/update-feed-publish.test.mjs` | 签名、降级与发布状态机通过 |
| 发布聚合        | `pnpm run test:release`                                                      | 发布与更新门禁通过         |

跨平台、主题、host、capabilities 或发布门变更完成后，运行唯一聚合入口：

```sh
pnpm -F vela verify
```

## CI 映射

| 路径 / 事件                                                                                               | workflow               | 必过门                                                        |
| --------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| `packages/apps/vela/**`、根 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、Vela workflow/action | `vela-ci.yml`          | `verify-macos`                                                |
| tag `vela-v*`                                                                                             | `vela-release.yml`     | 版本校验、macOS 构建、资产与 Draft Prerelease                 |
| 公开稳定 Vela Release                                                                                     | `vela-update-feed.yml` | attestation、EdDSA 与 stable appcast 原子推进                 |
| `go/**`                                                                                                   | `golang-ci.yml`        | 不覆盖 `packages/apps/vela/core`；core 的 Go 测试在 `vela-ci` |

- GitHub Actions 没有可依赖的 iOS Simulator，也没有当前 iOS 应用所需的签名能力。CI 与 tag release 只运行既有 common 和 macOS gates；不得擅自改成全平台聚合入口，不得声称 CI 完成了 iOS 构建、签名、Simulator 或真机验证。
- 显式 Simulator 验收入口在 `CI=true` 时必须拒绝执行。默认验证、release gate、workflow 和 composite action 中不得出现 `--target ios`、Simulator boot 或 Simulator destination。

## iOS 验收边界

- iOS Simulator 验收必须在 change 完成前作为本地补充证据收集，只能通过显式的 `pnpm run verify:ios-acceptance` 执行，并且不得替代真机结果。
- change 归档后不再启动 Simulator 做验收；也不得让归档后的验证或发布命令间接启动 Simulator。
- iOS 的签名、真机和 Simulator 结果使用归档前保存的验收记录。证据缺失必须在归档前补齐，不得在归档后临时改变 CI 边界来补证据。
- change 归档后的提交、推送、等待 Actions、打 tag 与发布序列见 `docs/8.1`。
