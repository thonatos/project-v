---
title: 使用 nftables 替代 iptables
date: 2023-11-12
description: 配置 nftables 实现透明代理和 NAT
tags: [linux, nftables, firewall]
---

nftables 是 Linux 新一代的防火墙框架，取代了 iptables，提供更简洁的配置语法和更好的性能。

## 启用 IP 转发

编辑 `/etc/sysctl.conf`：

```bash
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
```

## 安装 nftables

```bash
apt install nftables

# 创建配置目录
mkdir /etc/nftables.conf.d
```

## 定义私有地址列表

创建 `/etc/nftables.conf.d/private.nft`：

```nft
define private_list = {
    0.0.0.0/8,
    10.0.0.0/8,
    127.0.0.0/8,
    169.254.0.0/16,
    172.16.0.0/12,
    192.168.0.0/16,
    224.0.0.0/4,
    240.0.0.0/4
}
```

这些地址不应走代理，包含本地网络、私有网络和保留地址。

## 主配置文件

创建 `/etc/nftables.conf`：

```nft
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables.conf.d/private.nft"

table ip nat {
    chain proxy {
        ip daddr $private_list return
        ip protocol tcp redirect to :7892
    }
    chain prerouting {
        type nat hook prerouting priority 0; policy accept;
        jump proxy
    }
}
```

配置说明：

- `flush ruleset`: 清空现有规则
- `table ip nat`: 创建 NAT 表
- `chain prerouting`: PREROUTING 钩子，处理进入的流量
- `redirect to :7892`: 将流量重定向到本地代理端口

## 应用规则

```bash
# 应用配置
nft -f /etc/nftables.conf

# 查看规则
nft list ruleset

# 设置开机自动加载
systemctl enable nftables
systemctl start nftables
```

## 与 iptables 的对比

nftables 语法更统一，规则可以原子性更新，支持更灵活的表达式。iptables 规则可以通过 `iptables-translate` 工具转换为 nftables 语法：

```bash
iptables-translate -t nat -A PREROUTING -p tcp -j REDIRECT --to-port 7892
```
