---
title: 网络代理与 VPN 配置指南
date: 2023-11-17
description: 配置 Clash 代理、Docker 代理、WireGuard VPN 和 Cloudflare WARP
tags: [proxy, clash, docker, wireguard, warp, vpn, network]
---

本文档汇总网络代理与 VPN 配置。

## 目录

- [代理与 VPN](#代理与-vpn)
- [应用配置](#应用配置)

---

## 代理与 VPN

### Clash 代理

Clash 是一个基于规则的跨平台代理工具，支持多种代理协议和灵活的分流规则。

> [What is Clash? | Clash](https://clash.wiki/) - A rule-based tunnel in Go.

#### systemd 服务配置

创建 `/etc/systemd/system/clash.service`：

```ini
[Unit]
Description=Clash daemon, A rule-based proxy in Go.
After=network.target

[Service]
Type=simple
Restart=always
ExecStart=/usr/local/bin/clash -d /home/pi/workspace/clash

[Install]
WantedBy=multi-user.target
```

#### 基础配置

`config.yaml` 核心配置：

```yaml
# 基础设置
mixed-port: 7890 # HTTP/SOCKS5 混合端口
socks-port: 7891 # SOCKS5 端口
mode: rule # 规则模式
log-level: info # 日志级别

# 外部控制器
external-controller: 0.0.0.0:9090
secret: ''
external-ui: ./clash-dashboard
```

#### DNS 配置

DNS 分流配置可实现国内外域名解析分离：

```yaml
dns:
  enable: true
  ipv6: false
  listen: 0.0.0.0:5352
  default-nameserver:
    - 119.29.29.29
    - 223.5.5.5
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - 'https://dns.google/dns-query'
    - 'https://1.1.1.1/dns-query'
  fallback-filter:
    geoip: true
    ipcidr:
      - 240.0.0.0/4
      - 127.0.0.1/8
    domain:
      - +.google.com
      - +.youtube.com
```

配置说明：

- `nameserver`: 国内 DNS，用于解析国内域名
- `fallback`: 国外 DNS，用于解析被污染的域名
- `fallback-filter`: 过滤规则，防止 fallback 返回国内 IP

#### 代理提供者

使用文件方式管理代理节点：

```yaml
proxy-providers:
  vhk:
    type: file
    path: ./proxies/hk.yaml
    health-check:
      enable: true
      interval: 36000
      url: http://www.gstatic.com/generate_204
```

#### 规则提供者

使用远程规则集简化规则管理：

```yaml
rule-providers:
  reject:
    type: http
    behavior: domain
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt'
    path: ./ruleset/reject.yaml
    interval: 86400
  proxy:
    type: http
    behavior: domain
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt'
    path: ./ruleset/proxy.yaml
    interval: 86400
```

#### 规则配置

```yaml
rules:
  - RULE-SET,applications,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,proxy,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

#### 代理组策略

支持多种策略模式：

```yaml
proxy-groups:
  # 手动选择
  - name: PROXY_MU
    type: select
    proxies:
      - vhk
      - vus
      - DIRECT

  # 自动测速选择最快节点
  - name: PROXY_AU
    type: url-test
    proxies:
      - vhk
      - vsg
      - vus
    url: 'http://www.gstatic.com/generate_204'
    interval: 300

  # 负载均衡
  - name: PROXY_LB
    type: load-balance
    proxies:
      - vhk
      - vsg
    url: 'http://www.gstatic.com/generate_204'
    interval: 300

  # 主代理组
  - name: PROXY
    type: select
    proxies:
      - PROXY_MU
      - PROXY_AU
      - PROXY_LB
```

策略类型说明：

- `select`: 手动选择节点
- `url-test`: 自动选择延迟最低的节点
- `load-balance`: 负载均衡，分散流量到多个节点

---

### WireGuard VPN

WireGuard 是一个现代化的 VPN 协议，以简洁、高效和安全著称。

#### 安装依赖

```bash
# 更新软件源（可选，使用国内镜像）
sed -i 's@//.*archive.ubuntu.com@//mirrors.ustc.edu.cn@g' /etc/apt/sources.list

# 安装 WireGuard
apt update
apt install wireguard curl resolvconf
```

#### 启用 IP 转发

编辑 `/etc/sysctl.conf`：

```bash
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
```

应用配置：

```bash
sysctl -p
```

#### 获取网络信息

```bash
ip route
```

示例输出：

```
default via 192.168.1.1 dev eth0 metric 202
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.99
```

记录本机 IP（如 `192.168.1.99`）和网关地址（如 `192.168.1.1`）。

#### 配置 WireGuard

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

#### 生成密钥

```bash
# 生成私钥
wg genkey | tee privatekey | wg pubkey > publickey
```

#### 启动和管理

```bash
# 启动 WireGuard
wg-quick up wg

# 停止 WireGuard
wg-quick down wg

# 查看连接状态
wg show
```

#### 使用 nftables 配置 NAT

如果需要将其他设备流量转发到 WireGuard，使用 nftables 配置 NAT：

```nft
chain natpostrouting {
    type nat hook postrouting priority 100; policy accept;
    iifname $wg_iface oifname $pub_iface masquerade
}
```

> 参考: [How To Set Up WireGuard on Ubuntu 20.04](https://www.digitalocean.com/community/tutorials/how-to-set-up-wireguard-on-ubuntu-20-04)

---

### Cloudflare WARP

wgcf 是 Cloudflare WARP 的非官方跨平台 CLI 工具。

#### 相关资源

- wgcf 发布页: https://github.com/ViRb3/wgcf/releases
- WARP 脚本: https://gitlab.com/Misaka-blog/warp-script/

#### wgcf 使用

##### 账户配置文件

`wgcf-account.toml`:

```toml
access_token = ''
device_id = ''
license_key = ''
private_key = ''
```

##### 生成 WireGuard 配置

```bash
# 注册账户并生成配置
wgcf register
wgcf generate

# 获取优选 IP
warp-ip.sh
```

生成的 `wgcf-profile.conf` 文件包含完整的 WireGuard 配置。

#### Clash 集成

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

#### 优选 IP

WARP 的 endpoint IP 可能存在连接质量问题，可以使用脚本测试并选择最优 IP。

#### 注意事项

- WARP 免费版有流量限制
- Cloudflare 可能随时调整服务策略
- 建议定期更新配置以保持稳定连接

---

## 应用配置

### Docker 代理

在无法直接访问 Docker Hub 的环境中，可以通过配置 Docker daemon 使用代理来拉取镜像。

#### Daemon 配置

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

#### 重启服务

配置完成后重启 Docker daemon 使配置生效：

```bash
sudo systemctl restart docker
```

#### 验证配置

重启后可以验证代理是否生效：

```bash
# 查看 Docker info 中的代理配置
docker info | grep -i proxy

# 尝试拉取镜像测试
docker pull hello-world
```

#### 注意事项

- `no-proxy` 字段指定不走代理的地址，通常包含本地地址
- 代理地址支持 HTTP 和 HTTPS 协议
- 如果代理需要认证，格式为 `http://user:password@host:port`

> 参考: [Daemon proxy configuration](https://docs.docker.com/config/daemon/systemd/#httphttps-proxy)
