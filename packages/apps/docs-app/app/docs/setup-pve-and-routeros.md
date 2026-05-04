---
title: PVE 与 RouterOS 安装配置
date: 2023-11-14
description: Proxmox VE 与 MikroTik RouterOS 的磁盘管理操作
tags: [pve, routeros, virtualization]
---

## 下载链接

- PVE: https://www.proxmox.com/en/downloads
- RouterOS: https://mikrotik.com/download

## 磁盘管理

### 查看磁盘信息

```bash
# 查看物理卷
pvs

# 查看卷组
vgs

# 查看块设备
lsblk
```

### 添加 LVM 存储

```bash
# 扫描可用 LVM
pvesm scan lvm

# 添加目录存储
pvesm add dir data --path /data
```

### 创建逻辑卷

```bash
# 创建 140G 大小的逻辑卷
lvcreate -L 140G -n data debian-vg

# 格式化为 ext4
mkfs.ext4 /dev/mapper/debian--vg-data

# 挂载
mount /dev/mapper/debian--vg-data /data
```

### 删除逻辑卷

```bash
# 先卸载
umount /dev/data/lv-ceph

# 删除逻辑卷
lvremove /dev/data/lv-ceph
```

### 缩减逻辑卷

**注意：缩减操作有数据丢失风险，请先备份重要数据。**

```bash
# 卸载分区
umount /home

# 检查文件系统
e2fsck -f /dev/mapper/debian--vg-home

# 先缩减文件系统到目标大小
resize2fs /dev/mapper/debian--vg-home 100G

# 再缩减逻辑卷
lvreduce -L 100G /dev/mapper/debian--vg-home

# 重新挂载
mount /dev/mapper/debian--vg-home /home
```

### 扩展逻辑卷

```bash
# 扩展逻辑卷到最大可用空间
lvextend -l +100%FREE /dev/data/lv-data

# 扩展文件系统（自动调整到卷大小）
resize2fs /dev/data/lv-data
```

## 注意事项

- 缩减逻辑卷前必须先缩减文件系统，否则会损坏数据
- `resize2fs` 对 ext4 文件系统有效，其他文件系统使用对应工具
- PVE 存储配置文件位于 `/etc/pve/storage.cfg`
