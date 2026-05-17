---
title: Ubuntu Server 基础配置指南
date: 2023-11-17
description: 在 Ubuntu 上配置 ssh 密钥认证、nftables 防火墙、samba 文件共享、aria2 下载工具和 coredns DNS 服务
tags: [linux, ssh, samba, aria2, nftables, coredns, server]
---

本文档汇总 Ubuntu Server 基础配置，包括 ssh 登录、防火墙和常用服务。

## 目录

- [基础配置](#基础配置)
  - [ssh 密钥认证](#ssh-密钥认证)
  - [nftables 防火墙](#nftables-防火墙)
- [应用配置](#应用配置)
  - [samba 文件共享](#samba-文件共享)
  - [aria2 下载工具](#aria2-下载工具)
  - [coredns DNS 服务](#coredns-dns-服务)

---

## 基础配置

### ssh 密钥认证

使用 ssh 密钥认证比密码认证更安全，且可实现免密码登录。

#### 生成密钥对

```bash
ssh-keygen -t rsa -b 4096
```

按提示输入保存路径和密码（可选）。建议使用高强度密码保护私钥。

支持的密钥类型：

- `rsa`: 传统 RSA 密钥，兼容性好
- `ed25519`: 新一代算法，更安全高效（推荐）

#### 配置服务器

添加公钥到 `authorized_keys`：

```bash
echo <publicKey> >> ~/.ssh/authorized_keys

# 确保权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

启用公钥认证，编辑 `/etc/ssh/sshd_config`：

```bash
PubkeyAuthentication yes
```

重启 ssh 服务：

```bash
systemctl restart sshd
```

#### 使用密钥登录

```bash
ssh -i <privateKey> user@host
```

#### 禁用密码登录（可选）

编辑 `/etc/ssh/sshd_config`：

```bash
PasswordAuthentication no
```

#### SSH 配置文件

编辑 `~/.ssh/config` 简化登录：

```bash
Host myserver
    HostName example.com
    User myuser
    IdentityFile ~/.ssh/mykey
```

之后可直接使用 `ssh myserver` 连接。

#### 注意事项

- 私钥必须妥善保管，不要泄露
- 建议使用密码保护私钥
- 定期检查 authorized_keys，移除不需要的公钥
- 生产环境建议禁用密码登录

---

### nftables 防火墙

nftables 是 Linux 新一代的防火墙框架，取代了 iptables，提供更简洁的配置语法和更好的性能。

#### 启用 IP 转发

编辑 `/etc/sysctl.conf`：

```bash
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
```

#### 安装 nftables

```bash
apt install nftables

# 创建配置目录
mkdir /etc/nftables.conf.d
```

#### 定义私有地址列表

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

#### 主配置文件

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

#### 应用规则

```bash
# 应用配置
nft -f /etc/nftables.conf

# 查看规则
nft list ruleset

# 设置开机自动加载
systemctl enable nftables
systemctl start nftables
```

#### 与 iptables 的对比

nftables 语法更统一，规则可以原子性更新，支持更灵活的表达式。iptables 规则可以通过 `iptables-translate` 工具转换为 nftables 语法：

```bash
iptables-translate -t nat -A PREROUTING -p tcp -j REDIRECT --to-port 7892
```

---

## 应用配置

### samba 文件共享

samba 是 Linux/Unix 系统上实现 SMB/CIFS 协议的服务，可与 Windows 系统共享文件。

#### 安装 samba

```bash
apt update
apt install samba
```

#### 配置 samba 用户密码

为系统用户设置 samba 访问密码：

```bash
smbpasswd -a USERNAME
```

`USERNAME` 应为系统已存在的用户。

#### 配置共享目录

编辑 `/etc/samba/smb.conf`，添加共享配置：

```ini
[data]
comment = Samba Share on Ubuntu
path = /data

read only = no
guest ok = no

browseable = yes
writeable = yes

create mask = 0644
directory mask = 0755
force user = root
```

配置说明：

- `path`: 共享目录路径
- `read only`: 是否只读
- `guest ok`: 是否允许匿名访问
- `create mask`: 新文件权限
- `directory mask`: 新目录权限
- `force user`: 强制使用指定用户身份访问文件

#### 重启服务

```bash
service smbd restart

# 如启用了防火墙，开放 samba 端口
ufw allow samba
```

#### 访问共享

**Windows**

在资源管理器地址栏输入：

```
\\<server-ip>\data
```

**Linux**

使用 `smbclient` 或挂载：

```bash
# 使用 smbclient 访问
smbclient //<server-ip>/data -U username

# 挂载到本地
mount -t cifs //<server-ip>/data /mnt/share -o user=username
```

#### 挂载 HFS+ 格式磁盘

如果需要共享 macOS HFS+ 格式的磁盘：

```bash
apt install hfsplus
mount -t hfsplus -o force,rw /dev/sdx# /media/mntpoint
```

#### 注意事项

- 共享目录需有正确的文件系统权限
- 建议限制访问用户，不要使用 guest ok = yes
- 定期备份 smb.conf 配置文件

---

### aria2 下载工具

aria2 是一个轻量级的多协议下载工具，支持 HTTP/HTTPS、FTP、BitTorrent 和 Metalink。

#### 安装 aria2

```bash
apt update
apt install aria2
```

#### 配置 aria2

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

#### 创建 systemd 服务

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

#### 启动服务

```bash
# 启动服务
systemctl start aria2

# 设置开机自启
systemctl enable aria2

# 查看服务状态
systemctl status aria2
```

#### Web UI 管理

aria2 支持通过 Web UI 进行管理，推荐使用 [AriaNg](https://github.com/mayswind/AriaNg) 或 [webui-aria2](https://github.com/ziahamza/webui-aria2)。

访问 RPC 接口地址：`http://<server-ip>:9800`，使用配置的密码进行认证。

---

### coredns 服务

coredns 是云原生的 DNS 服务器，配置简洁，功能强大。相比 dnsmasq 和 unbound 更灵活。

#### DNS 服务对比

| 名称    | 特点                     |
| ------- | ------------------------ |
| dnsmasq | 轻量，但不支持非 53 端口 |
| unbound | 功能强大，配置繁琐       |
| coredns | 云原生，配置简单，插件化 |

#### 安装 coredns

下载地址: https://github.com/coredns/coredns/releases

```bash
# 解压并安装
tar xzf coredns_*.tar.gz
mv coredns /usr/local/bin/
```

#### 创建 systemd 服务

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

#### DNS 配置文件

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

#### 启动服务

```bash
# 停用 systemd-resolved（避免端口冲突）
systemctl stop systemd-resolved
systemctl disable systemd-resolved

# 启动 coredns
systemctl start coredns.service
systemctl enable coredns.service
```

#### 验证 DNS

```bash
# 使用 dig 测试
dig @localhost taobao.com

# 查看日志
journalctl -u coredns -f
```

#### 注意事项

- 默认 DNS 端口 53，需要停用 systemd-resolved
- 可配置多个上游 DNS 服务器
- 支持多种插件扩展功能（hosts、file、etcd 等）
