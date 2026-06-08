---
title: 总览
description: i18n-studio 系统能力总览与四类角色导航
---

# i18n-studio 文档

> 适用对象:全部用户

i18n-studio 把"草稿 → 发布 → 历史"建模成跨命名空间的协作流程,自带翻译任务、Snapshot 缓存通道与内置 OpenAPI 文档。

## 主要能力

- **词条管理**:草稿与已发布双轨,逐条 publish/discard/revert,版本历史可追溯
- **跨命名空间同步**:按 prefix / entry_ids 白名单从源空间拉取或推送,strategy 可选
- **任务化协作**:把翻译工作切成 task,生成 scoped Bearer token,worker claim 后写回
- **Snapshot 通道**:只读快照路径与管理 API 解耦,ETag 304 + bundle_version,前端运行时可缓存
- **系统级 locale 字典**:全站统一 locale 库,启停可控

## 角色导航

四类角色,各看各的:

- **管理员** — 创建命名空间、写词条、邀请成员
  - [综合指南](/docs/guide) → "快速开始"、"词条工作流"、"跨空间同步"
- **集成方** — 在前端 / 服务端消费已发布的翻译
  - [综合指南](/docs/guide#snapshot-消费) → [API 参考](/docs/api)
- **翻译 worker** — 自动化或人工 worker 拉取并写回翻译
  - [综合指南](/docs/guide#翻译任务) → [API 参考](/docs/api)
- **运维** — 部署 / 升级 / locale 字典维护
  - [部署](/docs/deployment) → [综合指南](/docs/guide#locale-字典)

## API 总览

`/api/...`(管理 API,cookie session 或 Bearer scope=task)与 `/snapshot/...`(只读发布通道,scope=readonly)分离。完整 OpenAPI 文档可在 [openapi.json](/openapi.json) 下载,导入 Postman / Bruno / Insomnia 即可使用。

> **提示**:后台路径已从 `/ns/...` 迁移到 `/dashboard/...`。
