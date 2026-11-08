# Design

## Context

docs-app 由 React Router 预渲染到 `build/client/`，Cloudflare Workers connected build 在 push `main` 后运行仓库内的 `wrangler deploy`。当前 `wrangler.jsonc` 只声明静态资源目录和 SPA fallback；Wrangler 4.158.0 因缺少 `compatibility_date` 拒绝上传，Cloudflare 同时提示配置名称 `undefined` 与 connected build 期望的 `docs-app` 不匹配。

## Goals / Non-Goals

**Goals:**

- 让 connected build 和本地人工补发读取同一份完整 Worker 配置。
- 让仓库长期文档准确描述 docs-app 的自动部署触发和人工补发入口。
- 以生产可访问性而非仅构建成功作为发布完成证据。

**Non-Goals:**

- 不新增 GitHub Actions 部署 workflow。
- 不改变 docs-app 的 SSG 路由、页面内容或静态资源目录。
- 不修改其他 Cloudflare 应用的发布方式。

## Decisions

### 在 Wrangler 配置中固定名称与兼容日期

`wrangler.jsonc` 显式设置 `name: "docs-app"` 和 `compatibility_date: "2026-11-04"`。日期取自本次 Cloudflare 构建错误给出的当前有效日期，确保 connected build 与人工命令行为一致。

备选方案是只给部署命令传 `--compatibility-date`，但 connected build 和本地命令容易分叉，且无法解决名称不匹配，因此不采用。

### 保留 connected build，并将本地脚本定义为人工补发

Cloudflare 已连接仓库并在 push 后执行 deploy，本次不再新增重复的 GitHub Actions workflow。`pnpm -F docs-app deploy` 保留，用于 connected build 故障后的受控补发和配置验证。

备选方案是关闭 connected build、恢复纯手动发布；这与维护者当前发布方式不符，也会增加漏部署风险，因此不采用。

### 部署验证覆盖规范与兼容路由

Cloudflare 报告成功后，直接访问首页、Docs、Blog、Projects/Vela、一个旧 Blog URL、`/tags` 和一个 `/tags/:tag`。这同时验证静态资源上传、SPA fallback 和预渲染兼容路径。

## Risks / Trade-offs

- [固定兼容日期不会自动获得新平台行为] → 仅在明确需要 Cloudflare 新能力时升级日期并重新走变更验证。
- [push `main` 会立即触发生产部署] → 在推送前完成本地构建与规格校验；推送后检查 connected build，不把 GitHub CI 成功等同于部署成功。
- [名称修正可能指向既有 Worker] → 使用 Cloudflare 构建日志明确期望的 `docs-app`，部署后核对生产 URL；若目标异常，立即在 Cloudflare 回滚上一部署。

## Migration Plan

1. 更新 Wrangler 配置和部署文档，运行 JSONC/构建/类型与 OpenSpec strict 校验。
2. 提交并 push `main`，由 connected build 自动重试。
3. 确认 Cloudflare 构建不再出现名称或兼容日期错误并成功发布。
4. 直接访问生产路由完成验收。

失败路径：若 connected build 仍失败，不执行重复的盲目人工部署；读取公开构建错误，修复配置并重新推送。若部署成功但生产异常，使用 Cloudflare 部署历史回滚到上一版本，再从修复后的 commit 重新发布。
