# i18n-studio

多语言词条管理系统。React Router v7 全栈 + SQLite + Drizzle ORM。

## 核心能力

- 命名空间隔离;默认 `zh-cn / zh-tw / en-us`,可扩展其它 locale
- flat key 词条(支持 `home.title.subtitle`)
- 草稿(draft)/ 已发布(published)双状态;外部任务回写、跨空间同步默认进入 draft
- 版本控制:append-only 历史 + 单条 / 批量 publish + 任意版本 revert
- 翻译任务契约:存储 + 状态机,外部 job 通过 `scope=task` token 拉取/回写
- 跨命名空间同步:prefix / entry_ids 白名单 + skip / overwrite / fill_missing + dry-run
- 客户端快照通道 `/snapshot/:slug`:与管理 API 路径独立,公开匿名或 `scope=readonly` token 访问;`bundle_version` + ETag/304

## 开发

```bash
pnpm install
pnpm -F i18n-studio db:generate     # 生成迁移 SQL
pnpm -F i18n-studio dev             # 默认 http://localhost:5173
pnpm -F i18n-studio build
pnpm -F i18n-studio start           # 生产
pnpm -F i18n-studio test            # 单测 + 集成测试
pnpm -F i18n-studio typecheck
```

## 环境变量

| 变量             | 默认                   | 说明                      |
| ---------------- | ---------------------- | ------------------------- |
| `SESSION_SECRET` | `dev-secret-change-me` | 会话 cookie 加密;生产必改 |
| `DATABASE_FILE`  | `./data/i18n.db`       | SQLite 文件路径           |
| `NODE_ENV`       | `development`          | 影响 cookie `secure` 标志 |

首位注册的用户自动成为系统 superuser(预留,首版未在 UI 区分)。

## 数据备份

```bash
sqlite3 ./data/i18n.db ".backup ./data/i18n.backup.db"
```

## 路径

- `/` 命名空间列表(已登录)
- `/login` `/register` `/logout`
- `/ns/:slug` 命名空间布局
  - `_index` 概览
  - `entries` 词条列表
  - `entries/:key` 编辑
  - `entries/:key/history?locale=` 历史
  - `tasks` 翻译任务
  - `sync` 跨空间同步
  - `members`(admin)
  - `settings`(admin)
- `/api/...` 管理 API(cookie session 或 `scope=task` token 用于 `/api/tasks/:id/*`)
- `/snapshot/:slug[/:locale]` 客户端运行时通道(匿名或 `scope=readonly` token)

## 客户端消费示例

```ts
const r = await fetch('https://i18n-studio.example.com/snapshot/docs/zh-cn');
const dict = (await r.json()) as Record<string, string>;
const t = (k: string) => dict[k] ?? k;
```
