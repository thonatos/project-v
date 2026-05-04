---
title: Ubuntu 安装配置 Aria2
date: 2023-11-17
description: 在 Ubuntu 上安装和配置 Aria2 下载工具
tags: [linux, aria2, download]
---

Aria2 是一个轻量级的多协议下载工具，支持 HTTP/HTTPS、FTP、BitTorrent 和 Metalink。

## 安装 Aria2

```bash
apt update
apt install aria2
```

## 配置 Aria2

创建配置文件 `/root/aria2/aria2.conf`：

```ini
# 下载目录
dir=/media/sda-ext/download

# 断点续传
continue=true
disable-ipv6=true

# RPC 服务
enable-rpc=true
rpc-listen-all=true
rpc-listen-port=9800
rpc-secret=admin
rpc-allow-origin-all=true

# 下载优化
max-concurrent-downloads=5
max-connection-per-server=16
```

配置说明：

- `dir`: 下载文件保存目录
- `rpc-secret`: RPC 接口密码，用于 Web UI 认证
- `max-connection-per-server`: 单服务器最大连接数，提升下载速度

## 创建 systemd 服务

创建服务文件 `/etc/systemd/system/aria2.service`：

```ini
[Unit]
Description=Aria2, Download Manager
After=network.target

[Service]
Type=simple
Restart=always
ExecStart=/usr/bin/aria2c --conf-path=/root/aria2/aria2.conf

[Install]
WantedBy=multi-user.target
```

## 启动服务

```bash
# 启动服务
systemctl start aria2

# 设置开机自启
systemctl enable aria2

# 查看服务状态
systemctl status aria2
```

## Web UI 管理

Aria2 支持通过 Web UI 进行管理，推荐使用 [AriaNg](https://github.com/mayswind/AriaNg) 或 [webui-aria2](https://github.com/ziahamza/webui-aria2)。

访问 RPC 接口地址：`http://<server-ip>:9800`，使用配置的密码进行认证。
