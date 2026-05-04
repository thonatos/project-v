---
title: WireGuard 配置指南
date: 2023-11-13
description: 在 Ubuntu 上安装和配置 WireGuard VPN
tags: [vpn, wireguard, network]
---

WireGuard 是一个现代化的 VPN 协议，以简洁、高效和安全著称。

## 安装依赖

```bash
# 更新软件源（可选，使用国内镜像）
sed -i 's@//.*archive.ubuntu.com@//mirrors.ustc.edu.cn@g' /etc/apt/sources.list

# 安装 WireGuard
apt update
apt install wireguard curl resolvconf
```

## 启用 IP 转发

编辑 `/etc/sysctl.conf`：

```bash
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
```

应用配置：

```bash
sysctl -p
```

## 获取网络信息

```bash
ip route
```

示例输出：

```
default via 192.168.1.1 dev eth0 metric 202
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.99
```

记录本机 IP（如 `192.168.1.99`）和网关地址（如 `192.168.1.1`）。

## 配置 WireGuard

创建 `/etc/wireguard/wg.conf`：

```ini
[Interface]
PrivateKey = <privateKey>
Address = 172.16.0.2/32
DNS = 114.114.114.114
MTU = 1280

PostUp = ip rule add table 200 from <ip>
PostUp = ip route add table 200 default via <gateway>
PreDown = ip rule delete table 200 from <ip>
PreDown = ip route delete table 200 default via <gateway>

[Peer]
PublicKey = <publicKey>
AllowedIPs = 0.0.0.0/0
Endpoint = engage.cloudflareclient.com:2408
```

配置说明：

- `PrivateKey`: WireGuard 私钥，使用 `wg genkey` 生成
- `Address`: VPN 内网地址
- `PostUp/PreDown`: 路由规则，确保流量正确路由
- `AllowedIPs`: `0.0.0.0/0` 表示所有流量都走 VPN
- `Endpoint`: 服务器端点地址

## 生成密钥

```bash
# 生成私钥
wg genkey | tee privatekey | wg pubkey > publickey
```

## 启动和管理

```bash
# 启动 WireGuard
wg-quick up wg

# 停止 WireGuard
wg-quick down wg

# 查看连接状态
wg show
```

## 使用 nftables 配置 NAT

如果需要将其他设备流量转发到 WireGuard，使用 nftables 配置 NAT：

```nft
chain natpostrouting {
    type nat hook postrouting priority 100; policy accept;
    iifname $wg_iface oifname $pub_iface masquerade
}
```

> 参考: [How To Set Up WireGuard on Ubuntu 20.04](https://www.digitalocean.com/community/tutorials/how-to-set-up-wireguard-on-ubuntu-20-04)
