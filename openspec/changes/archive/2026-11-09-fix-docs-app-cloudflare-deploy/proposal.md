# Proposal

## Why

docs-app 的 Cloudflare connected build 已在 `wrangler deploy` 阶段失败：当前配置缺少 Wrangler 4.158.0 必填的 `compatibility_date`，且未声明 connected build 期望的 Worker 名称 `docs-app`。仓库文档仍将 docs-app 发布描述为纯手动操作，也与本次实际的 push-to-deploy 通道不一致。

## What Changes

- 在 docs-app Wrangler 配置中显式声明 Worker 名称 `docs-app` 和固定兼容日期 `2026-11-04`，保留 `build/client` 静态资源与 SPA fallback 配置。
- 将 docs-app 的发布契约记录为：push `main` 触发 Cloudflare connected build，平台完成构建并执行 `wrangler deploy`；本地 deploy 脚本保留为人工补发入口。
- 补充部署失败与验收要求：部署必须确认 Cloudflare build 成功，并直接访问 Docs、Blog、Projects 和历史迁移 URL。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `docs-ssg`: 明确 docs-app 的 Cloudflare Worker 身份、兼容日期、connected build 触发方式和部署后可访问要求。

## Impact

- 受影响包：`packages/apps/docs-app`。
- 受影响路径：`packages/apps/docs-app/wrangler.jsonc`、`packages/apps/docs-app/AGENTS.md`、`docs/4-ci-cd.md`、`docs/5-release.md`、`openspec/specs/docs-ssg/spec.md`。
- 外部系统：Cloudflare Workers connected build；不新增 GitHub Actions workflow，不改变站点路由或页面内容。

## Delivery Impact

- 长期文档：需要，更新 `docs/4-ci-cd.md` 与 `docs/5-release.md`，记录 docs-app 的 connected build 触发、人工补发入口和部署验证事实。
- 入口文档：需要，更新 `packages/apps/docs-app/AGENTS.md` 的部署验证入口和 CI 映射，避免继续按纯手动发布处理。
- 版本：`packages/apps/docs-app` / `NONE` / 不更新版本来源文件 / 该包不构成版本契约，`package.json` 版本仅作标识。
- 发布：需要，修复后提交并 push `main`，由 Cloudflare connected build 自动重试；不打 tag，本地 `pnpm -F docs-app deploy` 只作为自动部署失败后的人工补发方式。
- 验收：需要，确认 Cloudflare 部署成功，并在生产 URL 检查首页、Docs、Blog、Projects/Vela、旧 Blog 地址和 Tags 迁移地址。
