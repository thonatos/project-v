# i18n-studio

多语言词条管理系统。React Router v7 全栈 + SQLite + Drizzle ORM。

## 核心能力

- 命名空间隔离;默认 `zh-cn / zh-tw / en-us`,可扩展其它 locale
- flat key 词条(支持 `home.title.subtitle`)
- 草稿(draft)/ 已发布(published)双状态;外部任务回写、跨空间同步默认进入 draft
- 版本控制:append-only 历史 + 单条 / 批量 publish + 任意版本 revert
- 翻译任务契约:按 `(entry, locale)` item 跟踪,支持 worker lease、heartbeat、retry、日志与准确进度
- 跨命名空间同步:prefix / entry_ids 白名单 + skip / overwrite / fill_missing + dry-run
- Release manifest:每次客户端可见发布创建 immutable bundle,`bundle_version` fixed snapshot 可复现
- 审计与质量工作台:记录高价值写操作,扫描 missing/draft/stale/placeholder/HTML/ICU/length 风险
- Pending invitation:支持未注册 email 邀请、重发、撤销、过期校验与接受
- 客户端快照通道 `/snapshot/:slug`:与管理 API 路径独立,公开匿名或 `scope=readonly` token 访问;`bundle_version` + ETag/304

## 开发

```bash
pnpm install
pnpm -F i18n-studio db:generate     # 生成迁移 SQL
pnpm -F i18n-studio dev             # 默认 http://localhost:5173
pnpm -F i18n-studio build
pnpm -F i18n-studio start           # 生产
pnpm -F i18n-studio test            # tests/unit + tests/integration
pnpm -F i18n-studio typecheck
```

## 测试

测试集中在 `tests/` 目录:

```
tests/
├── unit/           # 纯函数,不依赖 sqlite
├── integration/    # 通过 helpers.bootstrap() 调 service 层
├── helpers.ts
├── test-db.ts      # 提供 setupTestDbFromTemplate
├── global-setup.ts # 一次性产出 tests/.tmp/_template.db
└── seed.ts         # 开发期 seed,vitest 不收集
```

每个集成测试用例从 `_template.db`(预跑过 drizzle migrate)文件复制初始化,避免重复 migrate;运行 96 个测试约 7s。

## 容器化部署

```bash
# 在仓库根构建(因为镜像复制 pnpm-workspace.yaml)
docker build -f packages/apps/i18n-studio/Dockerfile -t i18n-studio:latest .

# 运行(SQLite 数据持久化到宿主目录)
docker run --rm -p 3000:3000 \
  -v $(pwd)/.i18n-studio-data:/data \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  i18n-studio:latest
```

镜像基于 `node:24-bookworm-slim`,以非 root `node` 用户运行,运行时不含 pnpm/corepack。

## UI

- ⌘K / Ctrl+K 全局命令面板:在 `/dashboard/<slug>/...` 下额外提供"Navigate"分组(Overview/Entries/Tasks/Sync/Members/Settings)与按 prefix 实时搜词条,在任意路径下都可切换 namespace / 主题 / 打开文档
- 主题:Light / Dark / System,通过 cookie 持久化,SSR 已应用 className
- 移动端侧栏自动收起为 Sheet 抽屉
- 命名空间的语言选择来自系统级 **语言库**(`/dashboard/locales`),不再手动输入
- 危险操作(禁用 builtin locale、删除 namespace、移除最后一名 admin)统一走 `Dialog` 二次确认

## 语言库

`/dashboard/locales` 提供系统级语言字典:

- 任意已登录用户可只读
- 仅 `isSuperuser=1` 用户可新增 / 编辑 / 启停 / 删除
- 默认随数据库迁移注入 12 个内置 locale: `zh-cn / zh-tw / en-us / en-gb / ja-jp / ko-kr / fr-fr / de-de / es-es / pt-br / ru-ru / ar-sa`
- 内置 locale 不可删除,但可禁用
- 被任何 namespace 引用的 locale 不可删除或禁用

namespace 创建/更新时,`locales` 数组中的每个 code 必须存在于字典且 `enabled=1`,否则返回 422。

### 升级注意

如果从 modernization 升级到 locale-management,且现有数据库中已有的 namespace `locales` JSON 包含未在字典中的 code(例如自由输入留下的 `vi-vn`),需要手动处理一次:

```bash
# 1. 报告:列出哪些 code 未在字典中、被哪些 namespace 引用
pnpm -F i18n-studio repair:locales

# 2a. 决定保留:把这些 code 入字典(非内置 enabled=true,占位 label)
pnpm -F i18n-studio repair:locales --auto-add

# 2b. 决定移除:在 /dashboard/<slug>/settings 中去掉对应语言后再跑 step 1
```

未跑修复脚本前,涉及该 namespace 的 `updateNamespace` 调用会返回 `locale_not_found` 错误。

## 环境变量

| 变量             | 默认                   | 说明                      |
| ---------------- | ---------------------- | ------------------------- |
| `SESSION_SECRET` | `dev-secret-change-me` | 会话 cookie 加密;生产必改 |
| `DATABASE_FILE`  | `./data/i18n.db`       | SQLite 文件路径           |
| `NODE_ENV`       | `development`          | 影响 cookie `secure` 标志 |
| `PORT`           | `3000`                 | 容器内 HTTP 端口          |

首位注册的用户自动成为系统 superuser(预留,首版未在 UI 区分)。

## 数据备份

```bash
sqlite3 ./data/i18n.db ".backup ./data/i18n.backup.db"
```

## 路径

- `/` 公开 landing(匿名可访问)
- `/docs` 内置文档站(匿名可访问);OpenAPI 规范在 `/openapi.json`
- `/login` `/register` `/logout`
- `/dashboard` 命名空间列表(登录强制)
- `/dashboard/:slug` 命名空间布局
  - `_index` 概览
  - `entries` 词条列表
  - `entries/:key` 编辑
  - `entries/:key/history?locale=` 历史
  - `quality` 质量问题队列
  - `tasks` 翻译任务
  - `sync` 跨空间同步
  - `audit` 审计日志(admin)
  - `members`(admin)
  - `settings`(admin)
- `/dashboard/locales` 系统级语言字典(superuser 可写)
- `/ns/*` 与 `/locales` 兼容旧链接,301 重定向至 `/dashboard/...`
- `/api/...` 管理 API(cookie session 或 `scope=task` token 用于 `/api/tasks/:id/*`)
- `/snapshot/:slug[/:locale]` 客户端运行时通道(匿名或 `scope=readonly` token)

## 客户端消费示例

```ts
const r = await fetch('https://i18n-studio.example.com/snapshot/docs/zh-cn');
const dict = (await r.json()) as Record<string, string>;
const t = (k: string) => dict[k] ?? k;
```
