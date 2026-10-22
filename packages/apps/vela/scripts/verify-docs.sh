#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
SHARING="$ROOT/docs/sharing-and-dsh.md"
GUIDE="$ROOT/docs/user-guide.md"

fail() {
  echo "verify-docs: $1" >&2
  exit 1
}

require() {
  grep -q "$1" "$2" || fail "$3"
}

for value in 49374 3080 47844 47845 47846; do
  require "$value" "$SHARING" "sharing-and-dsh.md must document port $value"
done

# Every topic a user needs, named by what it covers rather than by one exact heading.
require '## 首次连接' "$GUIDE" "the guide must cover connecting for the first time"
require '## 账户' "$GUIDE" "the guide must cover the account page"
require '## 共享这台 Mac' "$GUIDE" "the guide must cover sharing this Mac"
require '## 添加其他设备' "$GUIDE" "the guide must cover adding another device"
require '## 转发远端服务' "$GUIDE" "the guide must cover forwarding a remote service"
require '## OpenCode 与 DSH' "$GUIDE" "the guide must cover OpenCode pairing and DSH authentication"
require '## 退出语义' "$GUIDE" "the guide must cover quit semantics"
require '## 故障排查' "$GUIDE" "the guide must cover troubleshooting"
require '## 卸载与回滚' "$GUIDE" "the guide must cover uninstall and rollback"

# Keyboard shortcuts are written with the macOS glyph.
require '⌘W' "$GUIDE" "the guide must explain that closing the window keeps Vela running"
require '⌘Q' "$GUIDE" "the guide must explain that quitting stops the connection"

# Vela forwards to the user's own browser and must say so, including the
# stable-host reason and the resulting exposure.
require '.localhost' "$GUIDE" "the guide must explain the stable loopback host names"
require '浏览器' "$GUIDE" "the guide must explain that services open in the user's browser"
require '本机其他进程' "$GUIDE" "the guide must state who else can reach a forwarded address"

require '不修改系统 VPN' "$SHARING" "sharing-and-dsh.md must state Vela does not change system networking"
require '不会删除或修改 OpenCode、DSH' "$GUIDE" "the guide must state uninstall leaves other tools untouched"

echo "Vela user and sharing documentation passed"
