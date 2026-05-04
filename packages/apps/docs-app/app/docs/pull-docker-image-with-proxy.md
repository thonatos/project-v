---
title: Docker 代理配置
date: 2024-10-05
description: 配置 Docker daemon 使用代理拉取镜像
tags: [docker, linux, proxy]
---

在无法直接访问 Docker Hub 的环境中，可以通过配置 Docker daemon 使用代理来拉取镜像。

## Daemon 配置

创建或编辑 `/etc/docker/daemon.json` 文件：

```json
{
  "proxies": {
    "http-proxy": "http://{host}:{port}",
    "https-proxy": "http://{host}:{port}",
    "no-proxy": "localhost, 127.0.0.0/8"
  }
}
```

将 `{host}` 和 `{port}` 替换为实际的代理服务器地址和端口。

## 重启服务

配置完成后重启 Docker daemon 使配置生效：

```bash
sudo systemctl restart docker
```

## 验证配置

重启后可以验证代理是否生效：

```bash
# 查看 Docker info 中的代理配置
docker info | grep -i proxy

# 尝试拉取镜像测试
docker pull hello-world
```

## 注意事项

- `no-proxy` 字段指定不走代理的地址，通常包含本地地址
- 代理地址支持 HTTP 和 HTTPS 协议
- 如果代理需要认证，格式为 `http://user:password@host:port`

> 参考: [Daemon proxy configuration](https://docs.docker.com/config/daemon/systemd/#httphttps-proxy)
