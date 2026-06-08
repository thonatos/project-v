## MODIFIED Requirements

### Requirement: 跨命名空间词条同步

系统 SHALL 提供从源命名空间向目标命名空间一次性同步词条的能力，操作者 MUST 同时是源命名空间成员且为目标命名空间 `editor` 或 `admin`。同步 MUST 支持 key 前缀过滤、`entry_ids` 显式白名单、locale 子集、冲突策略（`skip` / `overwrite` / `fill_missing`），并支持 `dry_run` 仅预览。同步为单 endpoint，UI 上有两种入口（"入站：从其它空间拉入当前空间"与"出站：从当前空间推送到其它空间"），服务端不区分方向，仅由 `source_slug` / `target_slug` 决定。

#### Scenario: dry-run 预览

- **GIVEN** 源命名空间 A 含 100 个 `home.*` 词条，目标空间 B 已有其中 30 个
- **WHEN** 用户提交 `{ source: "A", target: "B", prefix: "home.", locales: ["zh-cn"], strategy: "fill_missing", dry_run: true }`
- **THEN** 系统不写任何数据，返回预览：`{ to_create: 70, to_update: 0, to_skip: 30, conflicts: [...] }`

#### Scenario: 冲突策略 skip

- **GIVEN** key `home.title` 同时存在于源 A 与目标 B
- **WHEN** 同步策略为 `skip`
- **THEN** B 中 `home.title` 完全保持不变，不生成版本记录

#### Scenario: 冲突策略 overwrite

- **GIVEN** key `home.title` 在 A 中 `zh-cn=新首页`，B 中 `zh-cn=首页`
- **WHEN** 同步策略为 `overwrite`，locales=["zh-cn"]
- **THEN** B 的 `home.title` 的 `zh-cn` 翻译被写入新版本（值 "新首页"，`source=sync`，`status=draft`），原 published `首页` 保持生效；用户 publish 后才覆盖

#### Scenario: 冲突策略 fill_missing

- **GIVEN** key `home.title` 在 B 中 `zh-cn` 已有 published 值，缺 `en-us`；源 A 该 key 两个 locale 都有值
- **WHEN** 同步策略为 `fill_missing`，locales=["zh-cn","en-us"]
- **THEN** B 的 `zh-cn` 既不新增 draft 也不动 published；`en-us` 写入新版本（值来自 A，`status=draft`）；用户 publish `en-us` 后才生效

#### Scenario: locale 不存在于目标

- **GIVEN** 用户请求同步 locale `ja-jp`，但目标命名空间 B 未启用该 locale
- **WHEN** 系统执行校验
- **THEN** 系统拒绝整个同步请求，返回 422 与具体不支持的 locale 列表

#### Scenario: 权限校验

- **GIVEN** 用户为源 A 的 viewer，目标 B 的 admin
- **WHEN** 用户提交同步
- **THEN** 系统允许（源仅需读权限，viewer 满足；目标需写权限，admin 满足）

#### Scenario: 拒绝写权限不足

- **GIVEN** 用户在目标 B 仅为 viewer
- **WHEN** 用户提交同步
- **THEN** 系统返回 403，未做任何变更

#### Scenario: 同步生成版本

- **GIVEN** 同步执行成功并实际写入若干翻译
- **WHEN** 同步事务提交
- **THEN** 每条新增/变更的翻译 MUST 在目标命名空间的版本表生成 `source=sync` 记录，`metadata` 含 `source_namespace_id`；默认 `status=draft`，除非请求显式带 `auto_publish=true`

#### Scenario: 出站推送（当前空间 → 其它空间，按 entry_ids 白名单）

- **GIVEN** 用户在源空间 A 的 entries 页选中 7 条词条，调用同步并提交 `{ source: "A", target: "B", entry_ids: [...7 ids...], locales: ["zh-cn","en-us"], strategy: "fill_missing" }`
- **WHEN** 用户在 B 是 editor，A 任意成员
- **THEN** 系统仅处理这 7 条 entry 在 B 中的对应词条，按策略 fill_missing 写入；未在白名单内的源词条不被同步

#### Scenario: 入站拉取（其它空间 → 当前空间）

- **GIVEN** 用户打开 `/dashboard/B/sync`，提交 `{ source: "A", target: "B", prefix: "home.", locales: ["zh-cn"], strategy: "overwrite" }`
- **WHEN** 用户在 B 是 editor，A 任意成员
- **THEN** 系统按 prefix 过滤 A 的词条并覆盖写入 B

#### Scenario: entry_ids 含非源空间词条

- **GIVEN** 提交的 `entry_ids` 中包含一个不属于 source 的 entry id
- **WHEN** 系统执行 entry_ids 校验
- **THEN** 系统拒绝整个同步请求（422），不写入任何数据，并返回非法 id 列表

#### Scenario: prefix 与 entry_ids 同时给出取交集

- **GIVEN** `entry_ids` 含 10 条，其中 6 条 key 以 `home.` 开头，4 条不以 `home.` 开头
- **WHEN** 同时给 `prefix=home.` 与 `entry_ids=[...10...]`
- **THEN** 系统仅同步 6 条同时满足两条件的词条
