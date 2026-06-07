## ADDED Requirements

### Requirement: 命名空间隔离

系统 SHALL 提供命名空间作为词条管理的隔离单元，每个命名空间拥有独立的语言配置、词条集合与成员关系，命名空间之间互不可见。

#### Scenario: 创建命名空间

- **GIVEN** 已认证用户调用创建命名空间接口，提供唯一 slug 与名称
- **WHEN** 系统接收到创建请求且 slug 在全局唯一
- **THEN** 系统创建命名空间，将创建者授予 `admin` 角色，并返回命名空间元信息

#### Scenario: slug 冲突

- **GIVEN** 命名空间 slug 已存在
- **WHEN** 用户提交相同 slug 的创建请求
- **THEN** 系统拒绝请求并返回冲突错误，不创建任何记录

### Requirement: 删除命名空间

系统 SHALL 提供删除命名空间接口，仅 `admin` 可调用；删除 MUST 在单事务内级联删除该命名空间的所有词条、翻译、版本历史、成员、API token 与翻译任务，并使任何针对该 slug 的后续请求返回 404；该命名空间签发的 token MUST 立即失效。

#### Scenario: admin 删除空间

- **GIVEN** 命名空间 `marketing` 含若干词条、翻译、成员、token、任务
- **WHEN** admin 调用删除接口
- **THEN** 系统在单事务内级联删除上述全部记录；后续 `/api/.../marketing/...` 与 `/snapshot/marketing` 全部返回 404

#### Scenario: 任务进行中也允许删除

- **GIVEN** 命名空间内存在 `in_progress` 翻译任务
- **WHEN** admin 调用删除空间
- **THEN** 系统级联删除该任务记录；外部 worker 后续 claim/results/complete 均返回 404

#### Scenario: token 立即失效

- **GIVEN** 命名空间签发了 `task` 与 `readonly` token
- **WHEN** 命名空间被删除后某 worker 携带其 token 请求
- **THEN** 系统返回 401，token MUST NOT 复用于其他命名空间

### Requirement: 安全移除已启用 locale

系统 SHALL 允许 `admin` 从命名空间 `locales` 中移除某个 locale，但 MUST 在事务前校验：（a）该 locale 不是 `default_locale`；（b）该命名空间中**没有任何词条**对此 locale 存在 published 翻译；否则拒绝请求并返回原因。

#### Scenario: 移除未被引用的 locale

- **GIVEN** 命名空间启用 `zh-cn / zh-tw / en-us / ja-jp`，无任何词条对 `ja-jp` 存在 published 翻译
- **WHEN** admin 提交移除 `ja-jp`
- **THEN** 系统更新 `locales=["zh-cn","zh-tw","en-us"]`；该 locale 仍可能存在历史 draft，对应 draft 视为孤儿（不出现在默认查询，但保留历史不删）

#### Scenario: 拒绝移除被引用 locale

- **GIVEN** 命名空间内至少 1 条词条 `home.title` 的 `en-us` 为 published
- **WHEN** admin 试图移除 `en-us`
- **THEN** 系统返回 422，提示存在引用，并给出引用样例（≤ 5 条 key）

#### Scenario: 拒绝移除 default_locale

- **GIVEN** `default_locale=zh-cn`
- **WHEN** admin 试图从 `locales` 移除 `zh-cn`
- **THEN** 系统返回 422，提示需先将 `default_locale` 改为其它已启用 locale

### Requirement: 默认与可扩展语言配置

系统 SHALL 默认启用 `zh-cn`、`zh-tw`、`en-us` 三种语言；管理员 MAY 通过命名空间配置追加更多语言。所有语言代码 MUST 满足 BCP-47 风格的小写 `xx` 或 `xx-xx` 格式。

#### Scenario: 命名空间默认语言

- **GIVEN** 新创建的命名空间
- **WHEN** 查询其语言列表
- **THEN** 返回 `["zh-cn","zh-tw","en-us"]`，并标记 `zh-cn` 为 `default_locale`（用于翻译任务的源语言默认值与 UI 元信息提示，不影响运行时缺失值的填充行为）

#### Scenario: 添加自定义语言

- **GIVEN** 命名空间管理员
- **WHEN** 提交新增语言 `ja-jp`
- **THEN** 系统校验格式后将该语言加入命名空间语言列表

#### Scenario: 拒绝非法语言代码

- **GIVEN** 输入语言代码为 `Chinese` 或 `zh_CN`
- **WHEN** 用户提交配置
- **THEN** 系统返回校验错误，要求使用 `xx` 或 `xx-xx` 小写格式

### Requirement: Flat Key 词条结构

系统 SHALL 以 flat 模式存储词条 key：单条记录的 key 为字符串，可包含 `.` 作为层级分隔符（如 `home.title`、`user.profile.name`）；存储层 MUST NOT 将 key 自动展开为嵌套对象。

#### Scenario: 合法 key 写入

- **GIVEN** 命名空间内不存在 `home.title`
- **WHEN** 编辑提交 key=`home.title`，附 `zh-cn` 与 `en-us` 的翻译值
- **THEN** 系统创建一条词条记录，key 字段值为 `home.title`，并写入对应语言翻译

#### Scenario: 非法 key 拒绝

- **GIVEN** 提交的 key 含空白、连续点或前后导点（如 `home..title`、`.home`、`home.`、`home title`）
- **WHEN** 系统执行 key 校验
- **THEN** 拒绝请求并返回校验错误信息

#### Scenario: key 段命名规则

- **GIVEN** key 拆分后任一段不满足 `[a-zA-Z0-9_-]+`
- **WHEN** 系统校验 key
- **THEN** 拒绝写入并提示具体不合法段

### Requirement: 词条 CRUD

系统 SHALL 提供按命名空间作用域的词条创建、查询、更新与删除接口；查询 MUST 支持按 key 前缀、按语言、分页参数过滤。

#### Scenario: 按 key 前缀查询

- **GIVEN** 命名空间存在 `home.title`、`home.subtitle`、`about.title`
- **WHEN** 查询参数 `prefix=home.`
- **THEN** 返回 `home.title` 与 `home.subtitle`，不含 `about.title`

#### Scenario: 部分语言更新

- **GIVEN** 词条 `home.title` 已含 `zh-cn` 与 `en-us` 翻译
- **WHEN** 编辑仅更新 `zh-tw` 翻译值
- **THEN** 系统仅更新 `zh-tw` 字段，其它语言值保持不变

#### Scenario: 删除词条

- **GIVEN** 词条 `home.title` 存在
- **WHEN** 编辑删除该词条
- **THEN** 系统软删除（或物理删除，由 design 决定）该词条，再次查询不返回该 key

### Requirement: 多视图词条查询

系统 SHALL 提供按命名空间为根的词条查询，支持以下组合：（a）返回所有启用语言；（b）按一个或多个 `locale` 过滤；（c）按 `version` 快照（每个翻译返回 ≤ 该版本号的最新值，缺失则标记 missing）。所有视图 MUST 保持响应结构一致：词条以 flat key 列表返回，每项包含 `key` 与 `translations: { [locale]: { value, version, missing? } }`。

#### Scenario: 按空间获取所有语言

- **GIVEN** 命名空间启用 `zh-cn / zh-tw / en-us`，含若干词条
- **WHEN** 调用 `GET /api/.../entries?view=all`
- **THEN** 每条词条返回三个 locale 的 `value` 与 `version`，缺失 locale 标记 `missing: true` 且 `value=""`

#### Scenario: 按特定单一语言

- **GIVEN** 命名空间含若干词条
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn`
- **THEN** 每条词条仅返回 `translations.zh-cn`，未启用 / 缺失情况下仍按 missing 语义返回

#### Scenario: 按多语言子集

- **GIVEN** 命名空间启用 `zh-cn / zh-tw / en-us / ja-jp`
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn,en-us`
- **THEN** 响应仅包含 `zh-cn` 与 `en-us` 两个 locale 字段，不含其它

#### Scenario: 拒绝未启用 locale

- **GIVEN** 命名空间未启用 `de-de`
- **WHEN** 查询参数 `locale=de-de`
- **THEN** 系统返回 422，提示 locale 未启用

#### Scenario: 按版本快照获取（全空间）

- **GIVEN** 词条 `home.title` 的 `zh-cn` 历经 `v1=首页 / v2=主页 / v3=回家`
- **WHEN** 调用 `GET /api/.../entries?at_version=2&locale=zh-cn`
- **THEN** 返回 `home.title.translations.zh-cn = { value: "主页", version: 2 }`，不返回 v3

#### Scenario: 版本快照与多语言组合

- **GIVEN** 同一词条 `zh-cn` 的最新版本为 5，`en-us` 最新版本为 3
- **WHEN** 调用 `at_version=4&locale=zh-cn,en-us`
- **THEN** `zh-cn` 返回 ≤4 的最新版（如 v4），`en-us` 返回 ≤4 的最新版（如 v3，因后续不存在 v4 仍以 v3 为准）

#### Scenario: 版本快照中的"尚未存在"

- **GIVEN** 词条 `home.subtitle` 在 `at_version=2` 时刻尚未创建（首版本为 v3）
- **WHEN** 按 `at_version=2` 查询
- **THEN** 该词条不出现在结果中（视为不存在），不以 missing 形式返回

#### Scenario: flat 导出按版本快照

- **GIVEN** 命名空间含若干词条与多版本翻译
- **WHEN** 调用 `GET /api/.../export?locale=zh-cn&at_version=10`
- **THEN** 返回 `{ "home.title": "<v≤10 的最新值>", ... }`，不包含在 v10 之后才创建的词条与缺 zh-cn 的条目

#### Scenario: at_version 与 locale=all 同时存在

- **GIVEN** 命名空间含三种语言
- **WHEN** 调用 `?view=all&at_version=20`
- **THEN** 每条词条按各自语言独立计算 ≤ 20 的最新版本，三种语言都各自标记 `value/version/missing`

### Requirement: 响应分组形态

系统 SHALL 支持两种等价响应形态，由查询参数 `group` 决定：`group=key`（默认，按 key 聚合，每条词条挂多语言翻译，适合 UI 表格）与 `group=locale`（按 locale 聚合，先列 locale 再列 key/value，适合业务消费）。两种形态在同一查询条件下 MUST 表达相同的事实集合。

#### Scenario: 默认按 key 分组

- **GIVEN** 命名空间含若干词条
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn,en-us`（或省略 `group`）
- **THEN** 响应形如：

  ```json
  {
    "entries": [
      { "key": "home.title", "translations": { "zh-cn": { "value": "首页", "version": 4 }, "en-us": { "value": "Home", "version": 3 } } }
    ]
  }
  ```

#### Scenario: 按 locale 分组

- **GIVEN** 同上数据
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn,en-us&group=locale`
- **THEN** 响应形如：

  ```json
  {
    "locales": {
      "zh-cn": [ { "key": "home.title", "value": "首页", "version": 4 } ],
      "en-us": [ { "key": "home.title", "value": "Home", "version": 3 } ]
    }
  }
  ```

#### Scenario: locale 分组中的 missing

- **GIVEN** 词条 `home.title` 缺 `en-us`
- **WHEN** 调用 `?locale=zh-cn,en-us&group=locale`
- **THEN** `locales.en-us` 数组中该 key 仍出现，并带 `missing: true` 与 `value=""`，`version: null`

#### Scenario: 导出多 locale 时按 locale 分组

- **GIVEN** 命名空间含若干词条
- **WHEN** 调用 `GET /api/.../export?locale=zh-cn,en-us`（多 locale）
- **THEN** 返回 `{ "zh-cn": { "home.title": "首页", ... }, "en-us": { "home.title": "Home", ... } }`，每个 locale 内为 flat JSON

#### Scenario: 导出单 locale 保持平铺

- **GIVEN** 同上数据
- **WHEN** 调用 `GET /api/.../export?locale=zh-cn`（单 locale）
- **THEN** 返回 `{ "home.title": "首页", ... }`（不嵌套 locale 顶层），保持与既有"导出单语言" Scenario 兼容

#### Scenario: 分页与分组的组合

- **GIVEN** 命名空间含 1000 条词条，使用 `group=locale&page_size=100`
- **WHEN** 客户端请求第 1 页
- **THEN** 每个 locale 桶内仅含本页 100 条 key 的翻译，下一页 cursor 在响应顶层返回，所有 locale 共享同一分页游标

### Requirement: 批量导入与导出

系统 SHALL 支持以命名空间 + 语言为粒度的批量导出（JSON）与批量导入（JSON），导入时 MUST 校验所有 key 与 locale 后再事务性写入。

#### Scenario: 导出单语言

- **GIVEN** 命名空间含若干词条
- **WHEN** 调用导出接口，参数 `locale=zh-cn`
- **THEN** 返回 `{ "home.title": "首页", ... }` 形式的 flat JSON

#### Scenario: 导入校验失败回滚

- **GIVEN** 导入文件中包含一个非法 key
- **WHEN** 系统执行导入
- **THEN** 整个导入事务回滚，未写入任何记录，并返回出错的 key 列表

### Requirement: 缺失翻译 Fallback

系统 SHALL 在查询接口可选返回 fallback 行为说明：当某语言缺失翻译时，响应中标记缺失，不自动用其它语言填充内容（fallback 由消费方决定）。

#### Scenario: 标记缺失语言

- **GIVEN** 词条 `home.title` 存在 `zh-cn` 翻译，缺 `en-us`
- **WHEN** 客户端按命名空间 + `en-us` 查询
- **THEN** 响应在该 key 下返回空值与 `missing: true` 标记

### Requirement: 翻译版本控制

系统 SHALL 为每条翻译（按 entry + locale）维护单调递增的版本号 `version`，每次写入（含通过翻译任务回写、跨空间同步）MUST 在版本表追加一条不可变历史记录，包含旧值、新值、来源（`manual` / `import` / `task` / `sync` / `revert`）、操作者、时间戳与状态（`draft` / `published`）。每条 (entry, locale) 在任意时刻 MUST 至多有一个 `published` 版本（即"当前生效版本"），可有任意条 `draft` 版本（待审阅）。

#### Scenario: 写入生成版本

- **GIVEN** 词条 `home.title` 的 `zh-cn` 当前已发布版本为 `v3`，值为 "首页"
- **WHEN** 编辑通过 UI 直接保存值 "主页"
- **THEN** 系统将版本号置为 `v4`，并将 `v4` 的 `status=published`，`v3` 不再生效；同时在历史表追加记录 `{ from: "首页", to: "主页", source: "manual", status: "published" }`

#### Scenario: 查看翻译历史

- **GIVEN** 词条 `home.title` 的 `en-us` 经历过多次写入
- **WHEN** 调用版本列表接口（`entry+locale`），分页参数 `limit=20`
- **THEN** 系统按 `version desc` 返回历史记录列表，含 `version / value / source / status / actor / created_at`，并标记当前 `published` 版本

#### Scenario: 回滚到旧版本

- **GIVEN** 词条 `home.title` 的 `zh-cn` 当前 published 版本为 `v5`，目标版本 `v2` 的值为 "首页"
- **WHEN** 编辑提交 `revert` 到 `v2`
- **THEN** 系统创建一条新版本 `v6` 值为 "首页"、`source=revert`、`status=published`，`metadata.restored_from=v2`，`v5` 不再生效

#### Scenario: 回滚到不存在的版本

- **GIVEN** 词条 `home.title` 的 `zh-cn` 历史最高版本为 `v5`
- **WHEN** 用户提交 revert 到 `v9`
- **THEN** 系统返回 404，未做任何变更

#### Scenario: 词条删除时保留历史

- **GIVEN** 词条 `home.title` 存在多条翻译版本记录
- **WHEN** 词条被删除
- **THEN** 历史记录 MUST 与词条一并归档（`archived=true`）或随 cascade 删除（由 design 决定），但**不可在词条仍存在时**单独删除版本记录

### Requirement: 草稿与发布工作流

系统 SHALL 区分"草稿(draft)"与"已发布(published)"两种翻译版本状态。**直接由用户编辑保存的写入默认 published**，但**外部任务回写**与**跨空间同步**默认写入 draft；用户 MUST 通过显式的 publish 操作才能让 draft 版本生效。所有面向消费方的查询与导出 MUST 默认仅返回 published 版本，并提供显式参数查看 / 导出 draft。

#### Scenario: 直接编辑默认 published

- **GIVEN** 编辑通过 UI 表单或 PUT API 提交翻译值
- **WHEN** 请求未携带 `as_draft=true`
- **THEN** 新版本 `status=published`，立即对默认查询生效

#### Scenario: 显式以草稿写入

- **GIVEN** 编辑想先保存稿件再审阅
- **WHEN** 请求携带 `as_draft=true`
- **THEN** 新版本 `status=draft`，当前 published 版本保持不变，对默认查询不可见

#### Scenario: 同步默认写入 draft

- **GIVEN** 用户从源空间同步若干翻译到目标空间，未额外指定发布选项
- **WHEN** 同步事务提交
- **THEN** 写入的版本 `source=sync` 且 `status=draft`，目标空间默认查询不返回这些值；published 版本保持原状

#### Scenario: 同步可选直接发布

- **GIVEN** 同步请求携带 `auto_publish=true`，且操作者在目标空间为 `admin` 或 `editor`
- **WHEN** 同步事务提交
- **THEN** 写入的版本 `status=published`，立即生效；版本来源仍为 `sync`

#### Scenario: 翻译任务默认写入 draft

- **GIVEN** 外部 job 调用回写接口提交一批翻译
- **WHEN** 系统接收回写
- **THEN** 写入的版本 `source=task` 且 `status=draft`；任务进度仍按写入条数累计

#### Scenario: 单条 publish

- **GIVEN** 词条 `home.title` 的 `zh-cn` 存在 draft 版本 `v6` 与 published 版本 `v5`
- **WHEN** 用户在 UI / API 选中 `v6` 并 publish
- **THEN** `v6` 状态变为 `published`，`v5` 不再生效；版本号 MUST NOT 变化（不重新分配新号）

#### Scenario: 批量 publish

- **GIVEN** 用户选中若干 (entry, locale) 的 draft 版本（同一命名空间）
- **WHEN** 用户提交批量 publish
- **THEN** 系统在单事务中将所有选中 draft 置为 published，覆盖原 published；任一项校验失败（如 draft 不存在）整批回滚

#### Scenario: 丢弃 draft

- **GIVEN** 词条存在 draft `v6`，published `v5`
- **WHEN** 用户提交 discard `v6`
- **THEN** 系统将 `v6` 标记为 `discarded`（保留历史，不再可 publish），不影响其它版本

#### Scenario: 默认查询仅返回 published

- **GIVEN** 词条 `home.title` 的 `zh-cn` 有 draft `v6` 与 published `v5`
- **WHEN** 调用默认查询 `GET /api/.../entries`
- **THEN** 返回 `value=v5 的值, version=5`；不暴露 draft

#### Scenario: 显式查询包含 draft

- **GIVEN** 同上数据
- **WHEN** 调用 `GET /api/.../entries?include=draft`
- **THEN** 返回结构在 `translations.<locale>` 内同时含 `published` 与 `draft` 字段（值与版本号）

#### Scenario: 仅查询 draft

- **GIVEN** 命名空间有若干 draft 待审阅
- **WHEN** 调用 `GET /api/.../entries?status=draft`
- **THEN** 仅返回那些至少存在一个 draft 翻译的词条，并仅返回其 draft 翻译值

#### Scenario: 导出仅含 published

- **GIVEN** 命名空间含 draft 与 published 混合
- **WHEN** 调用 `GET /api/.../export?locale=zh-cn`
- **THEN** 输出 flat JSON 仅采用 published 版本；不存在 published 的 key 不出现在输出中

### Requirement: 批量翻译任务契约

系统 SHALL 提供"翻译任务"的存储与状态机，**不内建翻译执行器**：任务由用户基于筛选条件或显式选中的 `entry_ids` 批量创建，由外部 job（机器翻译服务、人工翻译平台、CLI 等）通过 API 拉取与回写结果。任务状态机为：`pending` → `in_progress` → `completed | failed | cancelled`。

#### Scenario: 基于筛选批量创建任务

- **GIVEN** 命名空间中 50 条词条缺 `en-us` 翻译
- **WHEN** 用户提交创建任务请求，参数 `{ filter: { missing_locale: "en-us", prefix: "home." }, target_locales: ["en-us"] }`
- **THEN** 系统创建一条 `pending` 任务，快照所有匹配词条的 `entry_id / key / source_locale_value`，任务包含 `id / namespace / target_locales / items[] / created_by / created_at`

#### Scenario: 基于选中行创建任务（entry_ids）

- **GIVEN** 用户在 entries 页选中 7 条词条
- **WHEN** 用户提交创建任务请求，参数 `{ entry_ids: [...7 ids...], target_locales: ["en-us","zh-tw"] }`
- **THEN** 系统校验 `entry_ids` 全部属于当前命名空间后创建 `pending` 任务，items 数等于 7（与 target_locales 数量无关，items 以 entry 为粒度，每个 item 内部目标 locale 由 task.target_locales 决定）

#### Scenario: filter 与 entry_ids 同时给出取交集

- **GIVEN** `entry_ids` 含 10 条，其中 6 条 key 以 `home.` 开头
- **WHEN** 同时给 `filter.prefix=home.` 与 `entry_ids=[...10...]`
- **THEN** 系统仅快照 6 条同时满足两条件的词条到 task items

#### Scenario: entry_ids 含非本命名空间词条

- **GIVEN** 提交的 `entry_ids` 中含一条不属于当前命名空间的 entry id
- **WHEN** 系统执行校验
- **THEN** 系统拒绝整个创建请求（422），返回非法 id 列表，不创建任务

#### Scenario: 外部 job 拉取任务

- **GIVEN** 任务处于 `pending`，外部 job 持有 API token
- **WHEN** job 调用 `claim` 接口（携带 `worker_id`）
- **THEN** 系统将任务置为 `in_progress`、记录 `worker_id` 与 `started_at`，并返回完整的 items 列表（含每项 `entry_id / key / source value / target_locales`）

#### Scenario: 重复 claim 被拒

- **GIVEN** 任务已被 worker A 认领，状态为 `in_progress`
- **WHEN** worker B 再次 claim 同一任务
- **THEN** 系统返回冲突错误，任务保持原状态与原 worker

#### Scenario: 回写翻译结果

- **GIVEN** 任务 `in_progress`，外部 job 完成 5 条翻译
- **WHEN** job 调用回写接口，提交 `[{ entry_id, locale, value }, ...]`
- **THEN** 系统校验每项 locale ∈ namespace.locales 且 entry_id 属于该任务，逐条写入 translations 并生成 `source=task`、`status=draft` 的版本记录；任务的 `progress.done` 累加；published 版本保持原状

#### Scenario: 完成任务

- **GIVEN** 任务的 `progress.done == progress.total`
- **WHEN** 外部 job 调用 complete 接口
- **THEN** 系统将任务状态置为 `completed`、记录 `completed_at`，禁止后续回写

#### Scenario: 失败上报

- **GIVEN** 任务 `in_progress`，外部 job 因不可恢复错误中止
- **WHEN** job 调用 `fail` 接口并提交 `reason`
- **THEN** 系统将状态置为 `failed`，保留已回写的翻译与版本，记录 `failed_at` 与 `reason`

#### Scenario: 取消任务

- **GIVEN** 任务处于 `pending` 或 `in_progress`
- **WHEN** 命名空间 admin 调用 cancel
- **THEN** 系统将状态置为 `cancelled`，已回写的翻译保留，后续 claim/写回一律被拒

#### Scenario: 任务输出文件

- **GIVEN** 任务存在
- **WHEN** 外部 job 或用户调用 export 接口
- **THEN** 系统返回任务 items 的 flat JSON（按 source locale）供 job 消费，不含已写入的目标翻译

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

- **GIVEN** 用户打开 `/ns/B/sync`，提交 `{ source: "A", target: "B", prefix: "home.", locales: ["zh-cn"], strategy: "overwrite" }`
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

### Requirement: 客户端快照读取

系统 SHALL 在与管理 API（`/api/...`）相互独立的路径前缀 `/snapshot/...` 下，提供面向消费方（前端运行时、CLI、构建脚本等）的只读、可缓存的词条获取通道。`/snapshot/...` 路径下的接口 MUST 仅返回 `published` 翻译，**不**暴露 draft、history、version、source、metadata、actor 等管理字段。

#### Scenario: 路径与管理 API 分离

- **GIVEN** 命名空间 `docs`
- **WHEN** 客户端发起 `GET /snapshot/docs`
- **THEN** 响应来自快照通道，独立于 `/api/...`，**不**触发管理 API 的 cookie 会话校验

#### Scenario: 默认获取单命名空间全部 locale

- **GIVEN** 命名空间 `docs` 启用 `zh-cn / zh-tw / en-us`，每条词条均有 published
- **WHEN** 调用 `GET /snapshot/docs`
- **THEN** 响应形如：

  ```json
  {
    "namespace": "docs",
    "bundle_version": 42,
    "locales": {
      "zh-cn": { "home.title": "首页", "home.cta": "立即开始" },
      "zh-tw": { "home.title": "首頁", "home.cta": "立即開始" },
      "en-us": { "home.title": "Home", "home.cta": "Get started" }
    }
  }
  ```

#### Scenario: 单 locale 路径平铺输出

- **GIVEN** 同上数据
- **WHEN** 调用 `GET /snapshot/docs/zh-cn`
- **THEN** 响应直接是 flat JSON：

  ```json
  { "home.title": "首页", "home.cta": "立即开始" }
  ```

  且响应顶层 **不**包含 `bundle_version` 等元字段（`bundle_version` MUST 在响应头 `X-Bundle-Version` 中给出）

#### Scenario: locale 子集

- **GIVEN** 命名空间启用四种语言
- **WHEN** 调用 `GET /snapshot/docs?locale=zh-cn,en-us`
- **THEN** 响应 `locales` 仅包含 `zh-cn` 与 `en-us` 两个键

#### Scenario: 缺失翻译省略

- **GIVEN** 词条 `home.subtitle` 没有 `en-us` published
- **WHEN** 调用 `GET /snapshot/docs/en-us`
- **THEN** 输出 flat JSON 中 **不**含 `home.subtitle` 键（消费方按 fallback 机制自行处理）

#### Scenario: bundle_version 触发递增

- **GIVEN** 命名空间当前 `bundle_version=42`
- **WHEN** 该命名空间内发生**任意一次会改变 published 集合的 HTTP 操作**——包括：直接编辑（`as_draft=false`）、publish draft、回滚（revert，写入新 published）、删除一条**至少含一个 published 翻译**的词条、或同步带 `auto_publish=true`
- **THEN** 系统将 `bundle_version` 自增为 `43`（每次 HTTP 操作仅 +1，与该操作内涉及的词条/翻译条数无关）

#### Scenario: 不触发 bundle_version 递增的操作

- **GIVEN** 命名空间当前 `bundle_version=42`
- **WHEN** 仅发生以下情况：以 `as_draft=true` 写入翻译；外部任务回写翻译（默认 draft）；同步默认写入（默认 draft）；discard 一条仅有 draft 状态的版本；删除一条仅含 draft、无 published 的词条；命名空间元信息（如 `name` / `public_read` / 成员）变更
- **THEN** `bundle_version` 保持 `42` 不变

#### Scenario: 批量 publish 共用一次递增

- **GIVEN** 命名空间当前 `bundle_version=42`
- **WHEN** 用户调用批量 publish，单次提交 50 条 (entry, locale) draft → published
- **THEN** `bundle_version` 仅自增一次为 `43`，而非 `92`

#### Scenario: 并发写下的 bundle_version 一致性

- **GIVEN** 两个并发写请求几乎同时提交
- **WHEN** 两次写入分别在各自事务内执行
- **THEN** 系统 MUST 在每个事务内以原子方式递增（如 `UPDATE namespaces SET bundle_version = bundle_version + 1`），不得用先读后写；最终两次写入对应两个不同且单调递增的 `bundle_version`

#### Scenario: 固定快照（按 bundle_version）

- **GIVEN** 历史 `bundle_version=42` 时存在词条 `home.title="老首页"`，当前为 43 时已改为 "新首页"
- **WHEN** 调用 `GET /snapshot/docs?bundle_version=42`
- **THEN** 系统返回 42 时刻的 published 内容（`home.title="老首页"`），响应头 `Cache-Control` MUST 含 `immutable, max-age >= 31536000`

#### Scenario: ETag 与 304

- **GIVEN** 客户端持有上次响应的 `ETag: "42-zhcn,enus"`
- **WHEN** 客户端再次请求同样参数并携带 `If-None-Match`
- **THEN** 若 `bundle_version` 与 locale 集合未变，系统返回 `304 Not Modified`，无 body

#### Scenario: 公开命名空间无认证

- **GIVEN** 命名空间 `docs` 设置为 `public_read=true`
- **WHEN** 客户端**不带**认证调用 `GET /snapshot/docs`
- **THEN** 系统返回 200 与快照内容；响应头 `Cache-Control` MUST 含 `public`

#### Scenario: 私有命名空间需要 read-only token

- **GIVEN** 命名空间 `internal` 设置为 `public_read=false`，且签发了 read-only token
- **WHEN** 客户端携带 `Authorization: Bearer <ro-token>` 调用快照
- **THEN** 系统校验 token 属于该 namespace 且未撤销后返回 200；响应头 `Cache-Control` MUST 为 `private`

#### Scenario: 私有命名空间无 token 拒绝

- **GIVEN** 命名空间 `internal` 设置为 `public_read=false`
- **WHEN** 客户端不带 token 或带无效 token 调用快照
- **THEN** 系统返回 401，**不**暴露 namespace 是否存在

#### Scenario: read-only token 不可写

- **GIVEN** 客户端持有 read-only token
- **WHEN** 客户端尝试调用任意管理 API（`/api/...` 下的写操作）
- **THEN** 系统返回 401/403，read-only token MUST NOT 在管理 API 上被接受

#### Scenario: 不暴露管理元数据

- **GIVEN** 词条 `home.title` 在管理视图含 `version / source / draft`
- **WHEN** 通过 `/snapshot/...` 读取
- **THEN** 响应 body 中 **不**含 `version / source / status / actor / metadata / draft / history` 等字段

#### Scenario: 速率限制

- **GIVEN** 单一来源（IP 或 token）在短时间内大量请求快照
- **WHEN** 触发限流阈值
- **THEN** 系统返回 429 + `Retry-After`，并在常规缓存命中（304）路径下不计入限流
