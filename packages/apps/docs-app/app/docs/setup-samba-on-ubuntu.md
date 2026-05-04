---
title: Ubuntu 安装配置 Samba
date: 2023-11-15
description: 在 Ubuntu 上配置 Samba 文件共享服务
tags: [linux, samba, file-sharing]
---

Samba 是 Linux/Unix 系统上实现 SMB/CIFS 协议的服务，可与 Windows 系统共享文件。

## 安装 Samba

```bash
apt update
apt install samba
```

## 配置 Samba 用户密码

为系统用户设置 Samba 访问密码：

```bash
smbpasswd -a USERNAME
```

`USERNAME` 应为系统已存在的用户。

## 配置共享目录

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

## 重启服务

```bash
service smbd restart

# 如启用了防火墙，开放 Samba 端口
ufw allow samba
```

## 访问共享

### Windows

在资源管理器地址栏输入：

```
\\<server-ip>\data
```

### Linux

使用 `smbclient` 或挂载：

```bash
# 使用 smbclient 访问
smbclient //<server-ip>/data -U username

# 挂载到本地
mount -t cifs //<server-ip>/data /mnt/share -o user=username
```

## 挂载 HFS+ 格式磁盘

如果需要共享 macOS HFS+ 格式的磁盘：

```bash
apt install hfsplus
mount -t hfsplus -o force,rw /dev/sdx# /media/mntpoint
```

## 注意事项

- 共享目录需有正确的文件系统权限
- 建议限制访问用户，不要使用 guest ok = yes
- 定期备份 smb.conf 配置文件
