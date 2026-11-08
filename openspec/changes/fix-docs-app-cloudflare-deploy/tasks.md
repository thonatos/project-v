# Tasks

## 1. Cloudflare Worker 配置

- [x] 1.1 在 `packages/apps/docs-app/wrangler.jsonc` 声明 `name: "docs-app"` 与 `compatibility_date: "2026-11-04"`，保留 `build/client` 和 SPA fallback；运行 `pnpm -F docs-app build` 后执行 `pnpm -F docs-app exec wrangler deploy --dry-run`，确认不再出现名称不匹配或缺少兼容日期错误。
- [x] 1.2 更新 `packages/apps/docs-app/AGENTS.md` 的部署入口与 CI 映射，写明 push `main` 的 Cloudflare connected build 和本地人工补发命令；用 `node -e` 读取 `package.json` 验证文档中的 `build`、`typecheck`、`deploy` 脚本均存在。
- [x] 1.3 更新 `docs/4-ci-cd.md` 与 `docs/5-release.md` 中 docs-app 的触发、部署 gate 缺口、发布通道和回滚说明；运行 `git diff --check`，并逐项核对文档不把其他 Cloudflare 应用改成自动发布。

## 2. 集成、发布与验收

- [x] 2.1 运行 `openspec validate fix-docs-app-cloudflare-deploy --strict`、`pnpm -F docs-app typecheck`、`pnpm -F docs-app build` 与 `git diff --check`，确认退出码均为 0；按 `docs/4-ci-cd.md` 记录本次只改 docs-app 配置和文档，不新增 GitHub Actions gate。
- [x] 2.2 版本评估：`packages/apps/docs-app` 判定 `NONE`，不更新版本来源文件，因为 `docs/5-release.md` 规定该包不构成版本契约；发布评估独立执行，不打 tag。
- [ ] 2.3 提交并 push `main`，确认 Cloudflare connected build 对新 SHA 成功完成且日志不再报告 Worker 名称或兼容日期错误；若失败则停止生产验收并按错误修复，不把 GitHub CI 成功视为发布完成。
- [ ] 2.4 在 Cloudflare 报告成功后直接访问生产环境的 `/`、`/docs`、`/blog`、`/projects`、`/projects/vela`、一个旧 Blog `/docs/:slug`、`/tags` 与一个 `/tags/:tag`，确认页面可加载、迁移目标正确且浏览器控制台无错误。

## Workflow follow-up

- 生产验收与维护者 review 完成后，同步 `docs-ssg` 主规格并归档 change。
- 若生产部署成功但页面异常，先使用 Cloudflare 部署历史回滚上一版本，再从修复后的 commit 重新发布。
