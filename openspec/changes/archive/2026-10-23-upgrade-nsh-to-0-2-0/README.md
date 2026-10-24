# upgrade-nsh-to-0-2-0

将 NSH 工具链与 Rust crates 从 0.1.1 升级到 0.2.0（nsh-ui-mobile -> nsh-base）

## 升级记录

- 升级前版本：`nsh 0.1.1`（`~/.nsh`，252 MB）
- 备份路径：`~/.nsh.bak-0.1.1`，已验证其 `bin/nsh --version` 输出 `0.1.1`
- `NSH_SOURCE`：升级前未设置，本机也不存在 NSH 源码 checkout；本次升级改为指向 `~/.nsh/source`（v0.2.0 tag）
