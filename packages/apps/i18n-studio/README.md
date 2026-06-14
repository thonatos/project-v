# i18n-studio

> 草稿 → 发布 → release → 审计 → 质量检查的多语言词条协作平台。

基于 React Router v7 全栈 + SQLite + Drizzle ORM 构建，自带翻译任务、Snapshot 缓存通道与内置 OpenAPI 文档。

## 特性

- **词条管理** — 草稿 / 已发布双轨，逐条 publish / discard / revert，版本历史可追溯
- **Release Snapshot** — 固定 `bundle_version` 基于 immutable release manifest 可复现
- **任务化协作** — 把翻译切成 `(entry, locale)` item，scoped token + worker lease / heartbeat / retry
- **跨命名空间同步** — 按 prefix / entry_ids 白名单同步，strategy 可选
- **审计与质量工作台** — 追踪高价值写操作，扫描缺失、草稿、过期、占位符、HTML 与长度风险
- **系统级 locale 字典** — 全站统一 locale 库，启停可控

## 快速开始

```bash
pnpm install
pnpm -F i18n-studio db:generate   # 生成迁移 SQL
pnpm -F i18n-studio dev           # http://localhost:5173
```

构建与生产运行：

```bash
pnpm -F i18n-studio build
pnpm -F i18n-studio start
```

首位注册用户自动成为系统 superuser。生产环境必须设置 `SESSION_SECRET`，否则应用拒绝启动。

## 文档

完整文档随应用内置在 `/docs` 路由，源文件位于 [`app/docs/`](./app/docs)：

- [总览](./app/docs/index.md) — 能力概述与角色导航
- [综合指南](./app/docs/guide.md) — 快速上手、词条工作流、翻译任务、同步、Snapshot 消费、界面文案同步
- [API 参考](./app/docs/api.md) — 鉴权、路径前缀、错误格式，完整 OpenAPI 见 `/openapi.json`
- [部署](./app/docs/deployment.md) — Docker、环境变量、数据卷、升级、反向代理
- [更新日志](./app/docs/changelog.md)

## License

随本 monorepo 仓库授权，详见仓库根目录。
