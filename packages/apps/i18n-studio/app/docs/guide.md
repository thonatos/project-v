---
title: 综合指南
description: 从注册到第一条词条 publish 的端到端流程,以及词条工作流、翻译任务、跨空间同步、Snapshot 消费、Locale 字典等使用方法
---

# 综合指南

> 适用对象:管理员、内容编辑、集成方、翻译 worker、superuser

本指南把 i18n-studio 的全部"使用流程"集中在一篇文档中:

- [快速开始](#快速开始) — 注册 → 创建 namespace → 写第一条词条 → 看到 snapshot
- [词条工作流](#词条工作流) — 草稿 / 发布 / 历史 / 回滚
- [翻译任务](#翻译任务) — 管理员视角 + worker 集成示例
- [跨命名空间同步](#跨命名空间同步) — prefix / strategy / dry_run
- [Snapshot 消费](#snapshot-消费) — ETag / 304 / 客户端示例
- [Locale 字典](#locale-字典) — 系统级 locale 库

接口细节请参考 [API 参考](/docs/api) 与 [openapi.json](/openapi.json)。

---

## 快速开始

> 适用对象:管理员、首次使用者

本节带你从零开始,在十分钟内创建一个 namespace、写出第一条词条,并通过 `/snapshot/<slug>` 看到发布结果。

### 1. 注册账号并登录

打开 i18n-studio 首页,点击右上角 **登录**。首位注册者自动获得 superuser 权限,后续用户由 superuser 邀请。

登录后会进入 [/dashboard](/dashboard) 工作台。

> **提示**:按 ⌘K(macOS)或 Ctrl+K(Windows / Linux)可随时调出命令面板,快速跳转到任意 namespace、entry 或文档页面。

### 2. 启用 locale 字典

只有 superuser 第一次登录时需要这一步。打开 [/dashboard/locales](/dashboard/locales),确认内置的 `zh-cn` / `en-us` 等 locale 是 **启用** 状态;按需添加项目所需的其它 locale(例如 `ja-jp`)。

namespace 只能引用 **已启用** 的 locale,这里是全站唯一的 locale 来源。详细说明见下方 [Locale 字典](#locale-字典)。

### 3. 创建 namespace

在 [/dashboard](/dashboard) 顶部点击 **新建命名空间**(也可访问 [/dashboard/new](/dashboard/new))。填入:

- **slug**:URL 标识,例如 `marketing-site`,后续 snapshot 路径会用到
- **display name**:显示名称
- **default locale**:默认 locale,通常是 `zh-cn` 或 `en-us`
- **locales**:勾选该 namespace 需要支持的 locale(从字典里选)

提交后会跳转到 `/dashboard/<slug>/entries`。

### 4. 写第一条词条

在 entries 页面点击 **新增词条**:

- **key**:词条 key,例如 `homepage.hero.title`
- **default value**:默认 locale 的值,例如 `欢迎来到我们的网站`
- 切换到其它 locale 标签页填入翻译

保存后,词条进入 **草稿(draft)** 状态。

### 5. 发布词条

在词条详情或列表页点击 **发布**(publish)。每次成功发布会让该 namespace 的 `bundle_version` +1。也可以在列表页多选词条后批量发布。

工作流细节见下方 [词条工作流](#词条工作流)。

### 6. 通过 snapshot 拿到结果

发布完成后,直接访问:

```
GET /snapshot/<slug>
```

返回示例:

```json
{
  "namespace": "marketing-site",
  "bundle_version": 1,
  "default_locale": "zh-cn",
  "locales": ["zh-cn", "en-us"],
  "entries": {
    "homepage.hero.title": {
      "zh-cn": "欢迎来到我们的网站",
      "en-us": "Welcome to our site"
    }
  }
}
```

也可以指定单个 locale 减小体积:

```
GET /snapshot/<slug>/en-us
```

完整消费方式见下方 [Snapshot 消费](#snapshot-消费)。

---

## 词条工作流

> 适用对象:管理员、内容编辑

i18n-studio 把每个词条同时维护 **draft(草稿)** 与 **published(已发布)** 两条记录。两者解耦:草稿可以反复修改,只有显式 publish 后才会进入 snapshot;publish 后还能通过 revert 回滚到任意历史版本。

### 状态模型

```
draft ──publish──> published
                     ├─ revert ──> 旧 published 复活(变成新版本)
                     └─ discard ──> 不动 published, 抛弃 draft
```

- **draft**:最新编辑值,不会出现在 snapshot
- **published**:对外可见的版本,snapshot 与 `bundle_version` 都基于此
- **历史版本**:每次 publish 都会归档,可在词条详情查看

### 创建 / 修改

新建词条或保存现有词条都走同一个 endpoint(根据 key 去重),保存后即为草稿。可调用 `POST /api/namespaces/:slug/entries`(operationId: `upsertEntry`)。

### 发布(publish)

把当前 draft 写成新的 published 版本,并把该 namespace 的 `bundle_version` +1。可调用 `POST /api/namespaces/:slug/entries/:key/publish`。

> **提示**:只有成功 publish 的词条才会出现在 `/snapshot/<slug>` 输出里。draft 仅在管理后台可见。

### 丢弃草稿(discard)

放弃当前 draft,published 不变。常用于"改了一半发现不需要"。调用 `POST /api/namespaces/:slug/entries/:key/discard`。

### 回滚(revert)

把某个历史 published 版本复活成新的 published 版本(版本号继续 +1,而非倒退)。调用 `POST /api/namespaces/:slug/entries/:key/revert`。

### 查看版本历史

每次 publish / revert 都会留下版本记录,可按时间倒序查看:`GET /api/namespaces/:slug/entries/:key/versions`。

### 批量发布

在 entries 列表页多选后或通过 API 一次性发布多条:`POST /api/namespaces/:slug/publish-batch`。

### bundle_version 与缓存

每次成功 publish(包括批量与 revert)都会让该 namespace 的 `bundle_version` 自增 1。`bundle_version` 同时作为 snapshot 的 ETag,客户端可基于此做 304 缓存,详见 [Snapshot 消费](#snapshot-消费)。

> **提示**:批量发布是事务性的——任一词条校验失败,整批回滚,`bundle_version` 不会半开。

---

## 翻译任务

> 适用对象:管理员、自动化 / 人工 worker

翻译任务(task)把"挑选若干 entry × locale 组合 → 交给 worker 翻译 → 写回结果"做成可追踪的工作单,并配套生成 scoped Bearer token,worker 仅能访问该任务范围内的资源。

### 状态机

```
pending ──claim──> claimed ──complete──> completed
                      ├─ fail ─────────> failed
                      └─ cancel(管理员)─> cancelled
```

- **pending**:已创建,尚未被领取
- **claimed**:已被某个 worker 领取,锁定一段时间
- **completed**:worker 已写回结果并标记完成
- **failed**:worker 主动报错
- **cancelled**:管理员撤销

### 管理员视角

#### 1. 创建任务

在 namespace 详情页选择若干 entry 与 locale,提交后系统返回 `task_id` 与 **task token**(scope=task,只能用于该任务)。调用 `POST /api/namespaces/:slug/tasks`。

> **警告**:task token 只在创建响应里出现一次,务必保存。需要重置只能撤销旧 token、重新创建任务。

#### 2. 跟踪进度

- 列出该 namespace 的全部任务:`GET /api/namespaces/:slug/tasks`
- 单个任务详情:`GET /api/namespaces/:slug/tasks/:id`

#### 3. 撤销

任务还在 pending / claimed 时可由管理员强制撤销(operationId: `cancelTask`)。

### Worker 视角

worker 拿到 `TASK_ID` 与 `TASK_TOKEN`(scope=task)后,按 claim → payload → results → complete 顺序执行:

```ts
// 伪代码 — 翻译 worker
const TASK_ID = process.env.TASK_ID!;
const TOKEN = process.env.TASK_TOKEN!; // scope=task
const BASE = 'https://i18n.example.com';

// 1. claim
await fetch(`${BASE}/api/tasks/${TASK_ID}/claim`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}` },
});

// 2. payload
const payload = await fetch(`${BASE}/api/tasks/${TASK_ID}/payload`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

// 3. translate
const results = payload.items.map((item) => ({
  entry_id: item.entry_id,
  locale: item.locale,
  value: translate(item.source_value, item.locale),
}));

// 4. write back
await fetch(`${BASE}/api/tasks/${TASK_ID}/results`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ results }),
});

// 5. complete
await fetch(`${BASE}/api/tasks/${TASK_ID}/complete`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}` },
});
```

#### 关键 API

- `POST /api/tasks/:id/claim` — 领取任务
- `GET /api/tasks/:id/payload` — 拉取待翻译列表
- `POST /api/tasks/:id/results` — 写回结果(可分批)
- `POST /api/tasks/:id/complete` — 标记完成
- `POST /api/tasks/:id/fail` — 失败上报

> **提示**:worker 可以分批 `writeTaskResults`,服务端会增量合并;最终调一次 `completeTask` 关闭任务。

### 写回的 entry 状态

worker 写回的翻译会进入对应 entry 的 **draft**(可在创建任务时设置 `auto_publish=true` 直接发布)。详见 [词条工作流](#词条工作流)。

---

## 跨命名空间同步

> 适用对象:管理员

`runSync` 把一个 namespace 的部分或全部 published 词条复制到另一个 namespace。服务端不区分"入站"或"出站",只要双方 ID 都填上即可 — 你既可以从某个公共 namespace 拉取词条,也可以把当前 namespace 的内容推到下游。

### 选择源与目标

```
source_namespace_id ──> target_namespace_id
       (取 published)        (写入 draft 或直接 published)
```

`source` 与 `target` 必须是同一个实例下已存在的 namespace。

### 范围筛选

可以同时设置以下三种白名单,系统会取 **交集**:

- **`prefix`**:仅同步 key 以指定前缀开头的词条,例如 `marketing.`
- **`entry_ids`**:精确指定一组 entry id
- **`locales`**:仅同步指定 locale 的翻译值

不设置则视为不过滤。

### strategy 行为表

| strategy       | 行为                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| `skip`         | 目标已有 published 翻译时跳过,不写入                                             |
| `overwrite`    | 写入新版本(draft)。published 不会被直接覆盖,需手动 publish 或配合 `auto_publish` |
| `fill_missing` | 仅补缺失 locale,目标已有(无论 draft 或 published)的不动                          |

### auto_publish

- `auto_publish=false`(默认):写入的内容进入 draft,等管理员手动 publish
- `auto_publish=true`:写入即视为新 published 版本,`bundle_version` 自增

### dry_run

设置 `dry_run=true` 时不写库,只返回预览:

```json
{
  "to_create": 12,
  "to_update": 3,
  "to_skip": 7,
  "conflicts": [{ "key": "marketing.cta.signup", "reason": "target_has_newer_version" }]
}
```

适合在生产空间执行前先确认影响面。

### API

`POST /api/namespaces/:targetSlug/sync`(operationId: `runSync`)。

> **警告**:`overwrite` 与 `auto_publish=true` 组合等同于"无差别替换",会让目标 namespace 的 `bundle_version` 跳跃式增长。建议先 `dry_run` 一次。

---

## Snapshot 消费

> 适用对象:集成方(前端 / 服务端)

snapshot 通道是只读的发布快照,与管理 API 解耦。它返回该 namespace 当前所有 published 词条,带 `bundle_version` 与 ETag,便于客户端做 304 缓存。

### 路径

- `/snapshot/:slug` — 整个 namespace 全部 locale
- `/snapshot/:slug/:locale` — 只返回指定 locale,体积更小

两者都返回 JSON,响应头包含:

- `ETag: W/"<bundle_version>"`
- `X-Bundle-Version: <bundle_version>`
- `Cache-Control: public, max-age=...`

### 鉴权

公共 namespace 可匿名访问;私有 namespace 需要带 `Authorization: Bearer <token>`,token 的 scope 必须是 `readonly`(或 `task` 在任务范围内)。

### 全量响应示例

```json
{
  "namespace": "marketing-site",
  "bundle_version": 42,
  "default_locale": "zh-cn",
  "locales": ["zh-cn", "en-us", "ja-jp"],
  "entries": {
    "homepage.hero.title": {
      "zh-cn": "欢迎",
      "en-us": "Welcome",
      "ja-jp": "ようこそ"
    },
    "homepage.cta.signup": {
      "zh-cn": "立即注册",
      "en-us": "Sign up now",
      "ja-jp": "今すぐ登録"
    }
  }
}
```

### ETag + 304 缓存

客户端首次请求拿到 `ETag`,后续请求带 `If-None-Match: <etag>`,内容未变会得到 `304 Not Modified` 且没有 body。

```ts
let etag: string | null = null;
let cache: SnapshotResponse | null = null;

async function loadTranslations(slug: string) {
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetch(`https://i18n.example.com/snapshot/${slug}`, { headers });

  if (res.status === 304) return cache!;

  etag = res.headers.get('ETag');
  cache = await res.json();
  return cache;
}
```

curl 校验:

```bash
curl -i https://i18n.example.com/snapshot/marketing-site \
  -H 'If-None-Match: W/"42"'
# HTTP/1.1 304 Not Modified
# ETag: W/"42"
# X-Bundle-Version: 42
```

### 锁定 bundle_version

也可以在 URL 上带 `?v=<n>` 锁定特定版本(若该版本仍存在),便于灰度发布时回退:

```
GET /snapshot/marketing-site?v=41
```

### 限流

snapshot 通道按 IP / token 限流,超过阈值返回 `429 Too Many Requests` 并附 `Retry-After` 秒数。

> **提示**:304 命中不计入限流额度,因此正确实现 ETag 是高 QPS 场景下的最佳做法。

---

## Locale 字典

> 适用对象:superuser、运维

所有 namespace 共享同一份"系统级 locale 字典"。namespace 配置里的 locale 列表只是对字典的 **引用**,字典是唯一的真相来源。

### 字典与 namespace locales 的关系

```
系统级 locale 字典(/dashboard/locales)
    │
    ├─ zh-cn  [启用]   ──┐
    ├─ en-us  [启用]   ──┼── 可被 namespace 引用
    ├─ ja-jp  [启用]   ──┘
    └─ ko-kr  [停用]      不可被引用,也不会出现在 snapshot

namespace A.locales = ['zh-cn', 'en-us']
namespace B.locales = ['zh-cn', 'ja-jp']
```

字典里的某个 locale **被启用** 时,所有 namespace 都可以在自己的 settings 里把它加入引用列表。**停用** 后:

- 已经引用该 locale 的 namespace 仍然保留旧数据,但 snapshot 中会过滤掉该 locale
- namespace settings 中无法新增引用

### 入口

打开 [/dashboard/locales](/dashboard/locales)(只对 superuser 可见)管理字典。

可以做的操作:

- **启用 / 停用**:切换 locale 是否对外可见
- **新增**:添加字典中没有的 locale(填入 BCP-47 标识与显示名)
- **删除**:仅当该 locale **未被任何 namespace 引用** 时可删

### 内置 locale

系统内置常用 locale(`zh-cn` / `en-us` / `ja-jp` / 等),启停可控,但不可删除。

> **警告**:内置 locale 不可删除,只能停用。如果想替换为自定义代码,请在新代码上启用,再停用旧代码。

### 错误码

涉及 locale 字典的常见错误:`locale_not_found`、`locale_disabled`、`locale_in_use`、`locale_builtin_undeletable`、`locale_dictionary_empty`。

### 字典引用完整性

namespace 引用的每个 locale 在创建/更新时都会经字典校验(`assertLocalesExist`),引用字典外或已禁用的 code 会被直接拒绝(`locale_not_found` / `locale_disabled`),因此不会产生悬空引用,运维无需定期巡检修补。

## 下一步

- 完整接口与字段:[API 参考](/docs/api) 与 [openapi.json](/openapi.json)
- 部署相关:[部署](/docs/deployment)
- 版本变更:[更新日志](/docs/changelog)
