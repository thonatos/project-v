---
title: SSH 密钥认证配置
date: 2023-11-14
description: 配置 SSH 公钥认证实现免密码登录
tags: [linux, ssh, security]
---

使用 SSH 密钥认证比密码认证更安全，且可实现免密码登录。

## 生成密钥对

### 生成私钥

```bash
ssh-keygen -t rsa -b 4096
```

按提示输入保存路径和密码（可选）。建议使用高强度密码保护私钥。

支持的密钥类型：

- `rsa`: 传统 RSA 密钥，兼容性好
- `ed25519`: 新一代算法，更安全高效（推荐）

### 从私钥生成公钥

```bash
ssh-keygen -y -f ./<privateKey>.pem
```

## 配置服务器

### 添加公钥到 authorized_keys

```bash
echo <publicKey> >> ~/.ssh/authorized_keys

# 确保权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 启用公钥认证

编辑 `/etc/ssh/sshd_config`：

```bash
PubkeyAuthentication yes
```

重启 SSH 服务：

```bash
systemctl restart sshd
```

## 使用密钥登录

```bash
ssh -i <privateKey> user@host
```

如果私钥有密码保护，会提示输入密码。

## 禁用密码登录（可选）

提高安全性，禁用密码认证：

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
```

## SSH 配置文件简化登录

编辑 `~/.ssh/config`：

```bash
Host myserver
    HostName example.com
    User myuser
    IdentityFile ~/.ssh/mykey
```

之后可直接使用 `ssh myserver` 连接。

## 注意事项

- 私钥必须妥善保管，不要泄露
- 建议使用密码保护私钥
- 定期检查 authorized_keys，移除不需要的公钥
- 生产环境建议禁用密码登录
