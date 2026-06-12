---
title: API 参考
description: 系统接口的鉴权、错误格式与路径前缀;完整规范见 OpenAPI 文档
---

# API 参考

i18n-studio 提供两组 HTTP 接口:

- **`/api/...`** — 管理 API,cookie session 鉴权;`/api/tasks/:id/*` 也接受 `scope=task` Bearer token
- **`/snapshot/...`** — 只读发布通道,匿名或 `scope=readonly` Bearer token

完整接口列表与 schema 请参考 [OpenAPI 规范](/openapi.json)。导入 Postman / Bruno / Insomnia 即可获得完整请求集合。

## 鉴权

| 类型                    | 用途            | 携带方式                        |
| ----------------------- | --------------- | ------------------------------- |
| Cookie session          | 管理 UI 与 API  | `__i18n_studio_session` cookie  |
| Bearer (scope=task)     | 翻译 worker     | `Authorization: Bearer <token>` |
| Bearer (scope=readonly) | snapshot 消费方 | `Authorization: Bearer <token>` |

cookie session 由 `/login` 颁发;Bearer token 由管理员在 namespace 设置中创建,当前 token 元数据包含名称、scope、prefix、创建时间与 revoked 状态。

## 路径前缀

| 前缀                        | 内容                                                                  | 是否需要登录                  |
| --------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| `/api/namespaces/...`       | 命名空间 / 词条 / 成员 / 邀请 / token / task / audit / quality / 同步 | cookie session                |
| `/api/tasks/:id/...`        | worker 操作单个任务                                                   | task Bearer 或 cookie session |
| `/snapshot/:slug[/:locale]` | 只读发布快照                                                          | 匿名(公共)或 readonly Bearer  |

## 错误格式

所有 4xx/5xx 响应统一返回:

```json
{
  "code": "forbidden",
  "message": "用户无权执行该操作",
  "details": {}
}
```

常见错误码:

| code                         | HTTP | 触发条件                             |
| ---------------------------- | ---- | ------------------------------------ |
| `invalid_json`               | 400  | 请求体不是合法 JSON                  |
| `unsupported_media_type`     | 415  | Content-Type 不是 `application/json` |
| `forbidden`                  | 403  | 鉴权通过但无权操作                   |
| `not_found`                  | 404  | 资源不存在                           |
| `validation_error`           | 422  | 字段校验失败                         |
| `locale_not_found`           | 404  | locale 不在系统字典                  |
| `locale_disabled`            | 422  | locale 已被禁用                      |
| `locale_in_use`              | 422  | 删除 locale 时仍被 namespace 引用    |
| `locale_builtin_undeletable` | 422  | 内置 locale 不可删除                 |
| `locale_dictionary_empty`    | 422  | 系统字典为空                         |

## 几个常用 endpoint

```bash
# 创建/更新词条(草稿)
curl -X POST https://i18n.example.com/api/namespaces/docs/entries \
  -H "Cookie: __i18n_studio_session=..." \
  -H "Content-Type: application/json" \
  -d '{ "key": "home.title", "translations": { "zh-cn": "首页", "en-us": "Home" }}'

# 发布(草稿 → 已发布)
curl -X POST https://i18n.example.com/api/namespaces/docs/entries/home.title/publish \
  -H "Cookie: __i18n_studio_session=..."

# Snapshot 消费(带 ETag)
curl https://i18n.example.com/snapshot/docs \
  -H 'If-None-Match: W/"42"'
```

详细参数与响应字段请查 [openapi.json](/openapi.json)。

## 资源分组

OpenAPI tags 分组对应:

- **namespaces** — 命名空间 CRUD、详情、设置
- **entries** — 词条 upsert / 详情 / 删除
- **versions** — 词条版本历史 + publish / discard / revert / batch
- **import / export** — 整个 namespace 的 JSON 导入导出
- **members** — 成员管理与角色
- **invitations** — pending invitation 创建、重发、撤销、接受
- **tokens** — `scope=task` / `scope=readonly` API token 管理
- **audit** — 高价值写操作的审计事件查询
- **quality** — 质量扫描、问题查询、resolve / suppress
- **tasks** — 翻译任务创建、item 级 lease / heartbeat / retry / results
- **sync** — 跨命名空间同步
- **snapshot** — 只读发布通道(`/snapshot/...`)

每组的具体 operation、请求 / 响应 schema 与错误码,在 [openapi.json](/openapi.json) 中均可查到。

## 与文档的关系

本页面只描述 API 的 **共性约定**(鉴权、错误格式、路径前缀)。具体 endpoint 的请求 / 响应字段不在文档里二次维护——避免与 openapi.json 漂移。需要查接口细节时,把 `/openapi.json` 导入到任意 OpenAPI 浏览工具即可。
