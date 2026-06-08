---
title: 更新日志
description: i18n-studio 各 change 的简要发布说明
---

# 更新日志

> 适用对象:全部用户

## 2026-06-08 — public-shell

- 新增 landing 首页 `/`,匿名可访问
- 管理后台搬迁到 `/dashboard/**`,旧 `/ns/*` 与 `/locales` 不再保留兼容
- 内置文档站 `/docs` 与 `/openapi.json`(独立 OpenAPI 资源)
- 文档管线由 mdx-js 全面切换为 unified / remark / rehype:`.md` 源 + build 期编译为静态 HTML,prerender 输出
- 文档结构精简为 5 篇:总览 / 综合指南 / API 参考 / 部署 / 更新日志(原 17 篇 mdx + 自渲染 OpenAPI 组件归并)

## 2026-06-07 — locale-management

- 引入系统级 locale 字典(`/dashboard/locales`),与 namespace locales 解耦
- namespace 仅引用启用集合,locale 删除前会校验是否被使用

## 2026-06-07 — modernization

- 引入 shadcn/ui shell + 命令面板(⌘K)+ dark mode
- 后台 UI 整体重构,移动端 Sheet 抽屉

(更老的版本见 git history)
