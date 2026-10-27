# 5. 发布与版本

## 5.1 发布通道矩阵

| 包 | 通道 | 触发 | 产物 |
| --- | --- | --- | --- |
| `vela` | GitHub Release + stable appcast | tag `vela-v<major>.<minor>.<patch>` 后人工公开 | macOS `.zip`、校验资产、Draft Prerelease；公开后推进 `vela-updates` |
| `artusx-api`（Node） | 阿里云镜像 | push `main` | `registry.cn-hongkong.aliyuncs.com/suyi/artusx-api:latest` |
| `go/`（artusx-api） | 阿里云镜像 | push `main` 且 `go/**` 变更 | `registry.cn-hongkong.aliyuncs.com/suyi/artusx-api-golang:latest` |
| `docs-app` | Cloudflare Workers | 手动 | `wrangler deploy` |
| `remix-api` / `remix-flow` | Cloudflare Workers | 手动 | `wrangler deploy --minify` |
| `i18n-studio` | 自托管 Docker | 手动 | 镜像与数据卷，见 `packages/apps/i18n-studio/app/docs/deployment.md` |
| `@implementsio/dsh-telegram` | npm | 手动 | 公开包 |
| 其余（`react-app`、`react-component`、`libs/bot`、`libs/utils`、`gpm`） | 无 | — | 仅构建或本地使用 |

只有 `vela` 使用 GitHub Release；其他通道不使用 tag。

## 5.2 版本契约矩阵

版本评估按受影响包逐项进行：先确定本次改动触及哪些包，再查下表。**不得用一个包的结论代表另一个包。**

| 包 | 是否构成版本契约 | 版本来源 | 判定粒度 |
| --- | --- | --- | --- |
| `packages/apps/vela` | 是 | `package.json`、`shared/ui/version.ts`、`macos/ui/nsh.json`、`ios/ui/nsh.json`、`macos/app/Info.plist`、`ios/app/Vela/Info.plist`、`ios/app/Vela.xcodeproj/project.pbxproj`；build number 见 `CFBundleVersion` / `CURRENT_PROJECT_VERSION` / `nsh.json.build` | 每次交付变更 |
| `packages/plugins/dsh-telegram` | 是 | `package.json` 的 `version` | 每次 npm 发布 |
| `packages/apps/artusx-api` | 否 | `package.json` 仅作标识，镜像固定 `:latest` | 不判定 |
| `go/` | 否 | 无包版本；镜像固定 `:latest` | 不判定 |
| `packages/apps/docs-app` | 否 | `package.json` 仅作标识，部署不走版本 | 不判定 |
| `packages/apps/i18n-studio` | 否 | `package.json` 不构成契约；产品内的 `bundle_version` 是数据语义，不是包版本 | 不判定 |
| `packages/apps/react-app` | 否 | 仅构建 | 不判定 |
| `packages/apps/remix-api` | 否 | 手动部署，无版本标识 | 不判定 |
| `packages/apps/remix-flow` | 否 | 手动部署，无版本标识 | 不判定 |
| `packages/libs/react-component` | 否 | 私有，不发布 | 不判定 |
| `packages/libs/bot` | 否 | 未发现发布 workflow；在有外部消费者前按不构成契约处理 | 待确认 |
| `packages/libs/utils` | 否 | 未发现发布 workflow；在有外部消费者前按不构成契约处理 | 待确认 |
| `packages/tools/gpm` | 否 | 私有，本地构建 | 不判定 |

### Vela 版本规则

- 营销版本遵循 Semantic Versioning：不兼容的公开契约或数据迁移升 `MAJOR`；向后兼容的新功能升 `MINOR`；向后兼容的缺陷修复升 `PATCH`；同时包含多类修改时取最高级别。
- 产品代码、用户可见 UI/行为、配置、协议、host 或安全边界变化时必须更新营销版本。仅测试、文档或构建脚本变更且不改变交付产物时可以保持不变，但仍要记录 `NONE` 结论与理由。
- 每次生成新的 macOS/iOS 评审或发布构建，都必须递增正整数 Apple build number；同一份二进制的重复安装不得伪造新 build。
- 两端必须使用同一营销版本与 build number，并同步上表列出的全部来源。
- 版本更新后运行 `node shared/ui/version.test.mjs`；发布 tag 还必须运行 `node scripts/release/check-version.mjs --tag vela-vX.Y.Z`。
- 安装后应从实际 macOS bundle 与目标 iOS 设备读取版本，不能只引用源码值。

### dsh-telegram 版本规则

- 使用 npm 语义化版本；预发布后缀与所支持的 dsh core 版本绑定，升级 dsh 时同步修改。
- 该包与 dsh core 的依赖是精确版本，不是范围；发布前运行 `pnpm -F dsh-telegram test`。

### 不构成契约的包

判定为 `NONE` 时写清理由（私有、镜像固定 `:latest`、无外部消费者等），不得静默跳过。若某个包之后引入对外交付标识（例如独立版本 API、tag 或发布渠道），先更新本表，再在 change 中按新契约评估。

## 5.3 tag 与产物

- Vela tag 格式固定为 `vela-v<major>.<minor>.<patch>`，workflow 会拒绝其他形式。
- tag 触发 `vela-release.yml`：校验版本、构建 macOS arm64 应用、生成标准资产与 attestation、创建或更新 **Draft Prerelease**。
- 维护者人工核对资产、签名与说明后公开 Release；公开后由 `vela-update-feed.yml` 校验 attestation、使用受保护 EdDSA 私钥签名 ZIP，并以 compare-and-swap 推进稳定更新 feed。
- Draft 或 Prerelease 不得进入 stable appcast；feed 只引用不可变 tag 下载 URL，并以 Apple build 判定更新和拒绝降级。
- 其他包没有 tag 流程；Docker 镜像在 push `main` 时覆盖 `:latest`。

## 5.4 回滚

| 目标 | 回滚方式 |
| --- | --- |
| Vela | 不向客户端发布较低 build；将 `vela-updates` ref 恢复到不含问题条目的有效 feed 以停止新发现，并发布更高 build 的修复版本。手动 Release 下载路径始终保留 |
| Docker 镜像 | 重新部署上一版镜像 digest；需要重建时从回滚后的 commit 重新构建 |
| Cloudflare Workers | 在 Cloudflare 侧回滚部署，或从回滚后的 commit 重新 `wrangler deploy` |
| npm | `npm deprecate` 标记问题版本，随后发布 patch |
| 文档 / 配置 | `git revert` 对应提交；不影响运行时 |

## 5.5 版本评估动作

1. 列出本次改动触及的包（按路径），未触及的包不判定。
2. 对每个受影响包查 5.2：是否构成版本契约、来源文件、判定粒度。
3. 构成契约：给出 `MAJOR / MINOR / PATCH / NONE`，列出需要更新的文件，并执行对应的版本测试。
4. 不构成契约：给出 `NONE` 与理由。
5. 把结论写进 `proposal.md` 的 Delivery Impact 与 `tasks.md` 的交付组；不 tag、不部署也要做这一步。
