---
title: Ubuntu 安装配置 CoreDNS
date: 2023-10-17
description: 使用 CoreDNS 配置自定义 DNS 解析服务
tags: [linux, dns, coredns]
---

CoreDNS 是云原生的 DNS 服务器，配置简洁，功能强大。相比 dnsmasq 和 unbound 更灵活。

## DNS 服务对比

| 名称    | 特点                     |
| ------- | ------------------------ |
| dnsmasq | 轻量，但不支持非 53 端口 |
| unbound | 功能强大，配置繁琐       |
| CoreDNS | 云原生，配置简单，插件化 |

## 安装 CoreDNS

下载地址: https://github.com/coredns/coredns/releases

```bash
# 解压并安装
tar xzf coredns_*.tar.gz
mv coredns /usr/local/bin/
```

## 创建 systemd 服务

`/etc/systemd/system/coredns.service`:

```ini
[Unit]
Description=CoreDNS DNS Server
After=network.target

[Service]
Type=simple
Restart=always
ExecStart=/usr/local/bin/coredns -conf /home/pi/workspace/coredns/config.cfg

[Install]
WantedBy=multi-user.target
```

## DNS 配置文件

`config.cfg`:

```
. {
    log
    cache 300

    # 阿里系域名使用阿里 DNS
    forward tmall.com 223.5.5.5
    forward taobao.com 223.5.5.5
    forward alipay.com 223.5.5.5
    forward alicdn.com 223.5.5.5
    forward aliyun.com 223.5.5.5

    # 腾讯系域名使用腾讯 DNS
    forward jd.com 119.28.28.28
    forward qq.com 119.28.28.28
    forward weixin.com 119.28.28.28

    # 其他域名
    forward mi.com 119.29.29.29
    forward bilibili.com 119.29.29.29

    # 默认上游 DNS
    forward . 127.0.0.1:1053
}
```

配置说明：

- `log`: 启用查询日志
- `cache`: 缓存时间（秒）
- `forward`: 指定域名使用特定上游 DNS

## 启动服务

```bash
# 停用 systemd-resolved（避免端口冲突）
systemctl stop systemd-resolved
systemctl disable systemd-resolved

# 启动 CoreDNS
systemctl start coredns.service
systemctl enable coredns.service
```

## 验证 DNS

```bash
# 使用 dig 测试
dig @localhost taobao.com

# 查看日志
journalctl -u coredns -f
```

## 注意事项

- 默认 DNS 端口 53，需要停用 systemd-resolved
- 可配置多个上游 DNS 服务器
- 支持多种插件扩展功能（hosts、file、etcd 等）
