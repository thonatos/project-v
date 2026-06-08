---
title: 部署
description: i18n-studio 的 Docker 部署、环境变量、数据卷、升级流程与反向代理建议
---

# 部署

> 适用对象:运维

i18n-studio 是 React Router v7 全栈应用,数据持久化到本地 SQLite(`data/i18n.db`,WAL 模式)。推荐用官方 Docker 镜像运行。

## Docker 启动

```bash
docker run -d \
  --name i18n-studio \
  -p 3000:3000 \
  -v /opt/i18n-studio/data:/app/data \
  -e SESSION_SECRET=change-me \
  thonatos/i18n-studio:latest
```

挂载 `/app/data` 目录持久化 SQLite 文件,容器重建数据不丢。

## 环境变量

| 变量             | 必填 | 默认值         | 说明                                         |
| ---------------- | ---- | -------------- | -------------------------------------------- |
| `SESSION_SECRET` | 是   | —              | cookie session 加密密钥,随机字符串 ≥ 32 字符 |
| `PORT`           | 否   | `3000`         | 监听端口                                     |
| `DATABASE_URL`   | 否   | `data/i18n.db` | SQLite 文件路径,相对工作目录                 |

## 数据卷

容器把 SQLite 文件写在 `/app/data` 下,WAL 模式会同时产生:

- `i18n.db` — 主库
- `i18n.db-wal` — write-ahead log
- `i18n.db-shm` — 共享内存索引

三个文件需一同备份与恢复,缺一个会导致库无法打开。

## 升级流程

1. 拉取新镜像 `docker pull thonatos/i18n-studio:<tag>`
2. 备份 `data/` 目录(三个 SQLite 文件一起)
3. 用新镜像重新启动容器,容器入口会自动执行:
   ```bash
   pnpm db:migrate     # drizzle 自动迁移
   ```
4. 必要时手动跑一次:
   ```bash
   docker exec -it i18n-studio pnpm repair:locales
   ```
   该命令会给已存在的 namespace 修补缺失的系统级 locale 字典记录(详见综合指南中的 [Locale 字典](/docs/guide#locale-字典))
5. 确认 `/dashboard` 可正常加载

> **警告**:升级前请务必备份 `data/i18n.db` 与 `data/i18n.db-wal`、`data/i18n.db-shm` 三个文件。drizzle 迁移失败时只能用旧文件回滚。

## 反向代理

snapshot 通道支持 ETag,反向代理(Nginx / Caddy)需要保留 `If-None-Match` 与 `ETag` 头才能让 304 命中正确生效。Nginx 示例:

```nginx
location /snapshot/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header If-None-Match $http_if_none_match;
  proxy_pass_header ETag;
}
```

## 健康检查

```bash
curl -fsS http://localhost:3000/healthz
```

容器编排可基于 `/healthz` 做存活探针。
