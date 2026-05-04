---
title: Cloudflare WARP 配置
date: 2023-10-18
description: 使用 wgcf 配置 Cloudflare WARP 并集成到 Clash
tags: [cloudflare, warp, clash, vpn]
---

> wgcf 是 Cloudflare Warp 的非官方跨平台 CLI 工具。

## 相关资源

- wgcf 发布页: https://github.com/ViRb3/wgcf/releases
- WARP 脚本: https://gitlab.com/Misaka-blog/warp-script/

## wgcf 使用

### 账户配置文件

`wgcf-account.toml`:

```toml
access_token = ''
device_id = ''
license_key = ''
private_key = ''
```

### 生成 WireGuard 配置

```bash
# 注册账户并生成配置
wgcf register
wgcf generate

# 获取优选 IP
warp-ip.sh
```

生成的 `wgcf-profile.conf` 文件包含完整的 WireGuard 配置。

## Clash 集成

将 WireGuard 配置转换为 Clash 格式：

```yaml
proxies:
  - name: wg
    type: wireguard
    server: 162.159.192.43
    port: 934
    ip: 172.16.0.2
    ipv6: 2606:4700:110:85b3:819b:54cb:93b7:e127
    private-key: <private_key>
    public-key: <public_key>
    udp: true
```

配置说明：

- `server`: WARP endpoint IP 地址
- `port`: WARP 端口
- `ip`: 客户端内网 IPv4 地址
- `ipv6`: 客户端内网 IPv6 地址
- `private-key`: 从 wgcf 配置获取
- `public-key`: WARP 服务器公钥（从配置文件获取）

## 优选 IP

WARP 的 endpoint IP 可能存在连接质量问题，可以使用脚本测试并选择最优 IP。

## 注意事项

- WARP 免费版有流量限制
- Cloudflare 可能随时调整服务策略
- 建议定期更新配置以保持稳定连接
