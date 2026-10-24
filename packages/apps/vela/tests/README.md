# Vela tests

本目录承载跨语言、跨平台的**结构契约**测试；各平台自己的测试留在对应目录内。

| 测试                    | 位置                                                                  | 覆盖                                                       |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| 平台/共享依赖方向       | `tests/structure.test.mjs`                                            | TypeScript import 图：平台之间不互相引用，共享层不引用平台 |
| iOS Core 依赖边界       | `scripts/verify-ios-deps.sh`                                          | Go：iOS 入口不链接发布、共享、本地探测、授权与入站包       |
| macOS UI 结构与设计规则 | `macos/ui/tests/desktop-layout.test.mjs`                              | 分层、行高、开关语义、原生控件、菜单与窗口                 |
| 共享投影                | `shared/ui/projections.test.mjs`                                      | 纯函数投影：设备、服务、转发、日志、诊断                   |
| iOS 投影                | `shared/ui/ios-projections.test.mjs`                                  | iOS 专属标签、徽标优先级、分组排序                         |
| 共享流程                | `shared/ui/flows.test.mjs`                                            | 登录/检查/重连/注销、重命名校验、远端增删、偏好            |
| 主机名规则              | `shared/ui/hostname.test.mjs` + `core/internal/vela/hostname_test.go` | 两端读同一份 `hostname-validation.json`                    |
| 发布前验证              | `scripts/verify.sh` → `pnpm -F vela verify`                           | 文档、协议、两端 UI、Rust、Go、依赖边界                    |
| 打包与签名              | `scripts/verify-release.sh` → `pnpm -F vela verify:release`           | 上面的全部 + 两端组包 + 签名                               |

`verify` 需要 `.nsh-version` 对应的 NSH 工具链；`scripts/nsh.sh` 优先使用 `NSH_SOURCE`，未设置时回退到安装器默认的 `~/.nsh/source`。

## 依赖不变量

```text
macos/**, ios/**    ->  shared/**, core/**      允许
shared/**, core/**  ->  macos/**, ios/**        禁止
macos/**            ->  ios/**                  禁止
```

## 「源码形态断言」处置

`macos/ui/tests/desktop-layout.test.mjs` 里有大量对源码文本的断言。它们有两类，重构时按下面的去向处理，避免把「设计契约」和「实现写法」混在一起。

| 断言                                                                    | 处置         | 说明                                                      |
| ----------------------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| import 方向、只有一个 `CoreBridge.request` 调用点、不得 `JSON.parse`    | 保留         | 属于分层不变量                                            |
| atom 列表、`ListRow` 唯一数据行、行高与 6pt 内边距、radio 行高          | 保留         | 属于设计契约，与实现无关                                  |
| `Alert`/`Callout`/`Page`/`Switch`/`FormSheet` 的存在与用法              | 保留         | 组件契约                                                  |
| 页面 `testID`、pane 条件渲染、菜单快捷键、窗口尺寸与缩放按钮            | 保留         | 交互契约                                                  |
| 转发是开关 + Endpoint、两个图标动作、地址井不含图标                     | 保留         | 交互契约                                                  |
| 日志列宽、级别过滤、Token 的等宽字体                                    | 保留         | 视觉契约                                                  |
| 身份与偏好分离、诊断默认可见、DSH 不在访问端要 token                    | 保留         | 产品契约                                                  |
| `core/store.ts` 的陈旧映射尝试（`const current = () => … === attempt`） | 保留         | 转发生命周期按平台保留（design D7），断言仍指向唯一实现   |
| `core/store.ts` 的 `if (isWeb) core.openExternal(url)`                  | 保留         | 同上                                                      |
| `core/store.ts` 的 `needs-auth` 清零登录尝试                            | 转为行为测试 | S4 抽到共享认证流程后由流程单测覆盖，删除此条文本断言     |
| 认证/远端/偏好流程的重复实现                                            | 新增结构断言 | S4 完成后在 `tests/structure.test.mjs` 中禁止再次出现副本 |
| Rust `desktop_controls` 的颜色与禁用态断言                              | 保留         | S6 收敛颜色表后改为比对常量表                             |
| Rust smoke 脚本的存在                                                   | 删除         | S6 将其移出生产路径，改为由显式环境变量门控的独立模块     |

## 验收记录

手工验收（真实设备、双机、iOS 自动重试）记录在 `docs/verification/`，不进入本目录，也不作为自动化测试基线。
