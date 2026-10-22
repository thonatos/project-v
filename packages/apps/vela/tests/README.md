# Vela tests

此目录承载跨语言 fixture、应用组装和端到端测试。Rust 单元测试位于对应 crate，Go 单元测试位于对应 package，NSH UI 测试位于 `ui/tests`。

完整发布前验证使用 `pnpm run verify:release`。测试报告位于被忽略的 `.tmp/release/`；截图和 trace 只用于本地审查，未经确认不进入正式基线。
