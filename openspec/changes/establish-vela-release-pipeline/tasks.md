# Tasks

## 1. 版本与工具链契约

- [x] 1.1 扩展 Vela 版本校验，覆盖 `vela-vX.Y.Z` tag、根 package、共享版本常量、macOS/iOS NSH 清单、macOS Info.plist 和 iOS 工程版本；用一致与漂移 fixture 验证错误会列出具体来源。
- [x] 1.2 增加机器可读的发布工具链声明，固定 Node.js 24、pnpm 12.14.0、Rust 1.98.1、Go 1.27.2、NSH 0.2.0、NSH macOS arm64 SHA-256、NSH peeled commit、Xcode 27、macOS 14 和 arm64；用校验脚本验证声明与现有项目配置一致。
- [x] 1.3 增加 CI 工具链准备脚本，下载固定 NSH 归档、校验 SHA-256、检出固定源码提交并输出所有工具版本；用故意错误摘要的测试证明未验证内容不会被执行。

## 2. 验证入口分层

- [x] 2.1 将现有验证编排提取为共享门、macOS 门和 iOS 门的薄脚本，保持现有测试文件原位；运行新入口并用覆盖清单测试确认原 `verify` 的每项检查仍被执行。
- [x] 2.2 调整现有 `verify` 组合三个分层入口，保持 `pnpm -F vela verify` 的行为和报告目录兼容；运行聚合验证确认全部通过。
- [x] 2.3 增加 macOS 发布专用验证入口，只执行共享门、macOS 平台门、应用组装与发布检查而不构建 iOS；运行该入口确认能独立完成。

## 3. macOS 产物契约

- [x] 3.1 在 NSH、Rust、Go/cgo 和资源构建中统一设置 macOS 14 deployment target，并用 `otool` 验证主程序与 `vela-core` 的实际 `minos` 都不高于 14.0。
- [x] 3.2 增加 macOS App 检查脚本，验证 Bundle ID、版本、arm64 架构、所有 Mach-O 的最低系统版本、ad-hoc 签名和无 TeamIdentifier；用有效 App 和篡改的 metadata/架构/minos fixture 覆盖成功与失败路径。
- [x] 3.3 使用项目内隔离 HOME/TMPDIR 和 `VELA_LIFECYCLE_SCRIPT=close,reopen,quit` 对组装后的 App 运行有界 smoke test；验证 Core 启动、关闭/恢复窗口和退出日志，失败时只保留脱敏诊断。
- [x] 3.4 用 `ditto` 生成 `Vela-Desktop-X.Y.Z-macos-arm64.zip`，解压到新目录并复跑 App 检查；验证 ZIP 保留可执行权限、资源和 codesign 完整性。
- [x] 3.5 更新 macOS 构建与发布文档，明确 macOS 14+、Apple Silicon、ad-hoc/未公证状态和本地发布验证命令；执行文档校验确认命令及资产名一致。

## 4. 平台无关发布资产

- [x] 4.1 实现 schema version 1 的 `release.json` 生成与校验，使用 artifacts 数组记录组件、平台、架构、格式、能力、大小、摘要和平台信任属性；以 macOS Desktop 和未来 Linux Node fixture 验证可扩展性。
- [x] 4.2 生成稳定排序的 `SHA256SUMS` 和 `release-notes.md`，说明 Gatekeeper 官方“仍要打开”流程、校验命令和源代码链接；用测试校验所有运行资产均被哈希且说明未声称 Developer ID 或公证。
- [x] 4.3 增加统一发布组装入口，汇总平台 builder 输出并拒绝重复文件名、未知 schema、摘要不一致或缺失的标准资产；用失败 fixture 验证每种错误都阻止发布。

## 5. Vela 持续集成

- [x] 5.1 新增独立 `vela-ci.yml`，对 Vela 源码、工作区依赖锁和 workflow 变更触发 pull request/main 验证，配置只读权限与按 ref 取消旧运行；用 action lint 和事件/path 检查验证触发范围。
- [x] 5.2 在明确的 macOS arm64/Xcode 27 runner 上准备固定工具链并依次运行共享门、macOS 门、App 检查与生命周期 smoke；从一次干净 workflow 运行确认全部完成。
- [ ] 5.3 为工具链和构建依赖增加内容寻址缓存且在命中后重新验证摘要；通过连续两次 CI 运行确认缓存命中不跳过完整性校验。
- [x] 5.4 将失败时的脱敏报告和非发布 ZIP 上传为短期 CI artifact；验证 fork PR 不获得 OIDC、发布权限或 secrets。

## 6. GitHub Release 编排

- [x] 6.1 新增只响应 `vela-v*` tag 的 `vela-release.yml`，先执行版本门与只读构建，再把平台资产交给组装阶段；用不合法 tag 和版本漂移测试确认流程在构建前失败。
- [ ] 6.2 为最终 macOS ZIP 生成 GitHub Artifact Attestation，job 只授予 `contents: read`、`id-token: write` 和 `attestations: write`；对测试 tag 产物运行 `gh attestation verify --repo thonatos/project-v` 验证来源。
- [ ] 6.3 增加只具 `contents: write` 的 publish job，不 checkout 或执行项目脚本，只下载已组装资产并创建可重跑的 Draft Prerelease；用测试 tag 验证首次创建和重复运行均不覆盖已公开 Release。
- [x] 6.4 固定所有新增 GitHub Actions 到完整 commit SHA，并用 action lint/策略检查阻止浮动 tag 与超额 job 权限。
- [ ] 6.5 创建测试 `vela-vX.Y.Z` tag 完整演练构建、ZIP 解压、SHA-256、manifest、Attestation 和 Draft Release，记录验收结果后删除测试 draft/tag；确认没有自动公开 Release。

## Workflow follow-up

- 在首次公开 Release 前决定使用当前 `0.1.0` 还是提升 patch 版本，并创建对应正式 tag。
- 在 Vela CI 稳定后，由仓库维护者将其配置为 Vela 相关变更的必需检查。
- 后续以独立 change 实现 Linux Node（CLI、daemon、内嵌 Web UI、systemd user、localhost/显式 `0.0.0.0`、Caddy/Nginx 负责 TLS），并向同一 `release.json` 追加 Linux x86_64/arm64 产物。
