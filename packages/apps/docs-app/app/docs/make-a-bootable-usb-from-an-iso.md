---
title: 制作可启动 USB 安装盘
date: 2023-11-11
description: 使用 dd 命令将 ISO 写入 USB 设备制作启动盘
tags: [linux, usb, installation]
---

## 查看磁盘列表

在 macOS 上查看可用磁盘：

```bash
diskutil list
```

在 Linux 上：

```bash
lsblk
```

确认目标 USB 设备路径（如 `/dev/sdX` 或 `/dev/disk2`）。

## 写入 ISO 到 USB

使用 `dd` 命令写入：

```bash
sudo dd bs=4M if=/path/to/file.iso of=/dev/sdX status=progress oflag=sync
```

参数说明：

- `bs=4M`: 设置块大小为 4MB，提高写入效率
- `if`: 输入文件，即 ISO 镜像路径
- `of`: 输出设备，即 USB 设备路径
- `status=progress`: 显示写入进度
- `oflag=sync`: 同步写入，确保数据完整写入

## macOS 特别说明

macOS 上可能需要先卸载 USB 设备：

```bash
# 卸载设备（不是推出）
diskutil unmountDisk /dev/diskN

# 使用 /dev/rdiskN（原始设备）写入更快
sudo dd if=/path/to/file.iso of=/dev/rdiskN bs=4m status=progress
```

## 注意事项

- 确认目标设备路径正确，错误的路径可能导致数据丢失
- USB 设备容量需大于 ISO 文件大小
- 写入完成后可能需要弹出设备再重新插入使用
