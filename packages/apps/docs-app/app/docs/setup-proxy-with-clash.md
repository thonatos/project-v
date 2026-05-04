---
title: Clash 代理配置指南
date: 2023-10-16
description: 使用 Clash 配置规则代理和 DNS 分流
tags: [proxy, clash, network]
---

> [What is Clash? | Clash](https://clash.wiki/) - A rule-based tunnel in Go.

Clash 是一个基于规则的跨平台代理工具，支持多种代理协议和灵活的分流规则。

## systemd 服务配置

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

## 基础配置

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

## DNS 配置

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

## 代理提供者

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

## 规则提供者

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

## 规则配置

```yaml
rules:
  - RULE-SET,applications,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,proxy,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

## 代理组策略

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
