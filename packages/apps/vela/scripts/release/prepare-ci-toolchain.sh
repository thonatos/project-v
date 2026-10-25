#!/bin/sh
# Prepare the network-fetched NSH inputs only after their immutable identities
# have been checked. Node, pnpm, Rust, Go and Xcode are provisioned by the
# runner/workflow; this script verifies and reports their effective versions.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
TOOLCHAIN_FILE=${VELA_TOOLCHAIN_FILE:-"$ROOT/scripts/release/toolchain.json"}
INSTALL_ROOT=${1:-"${RUNNER_TEMP:?RUNNER_TEMP or an explicit install directory is required}/vela-toolchain"}

case "$INSTALL_ROOT" in
  ''|/) echo "拒绝不安全的工具链安装目录: $INSTALL_ROOT" >&2; exit 2 ;;
esac

node "$ROOT/scripts/release/check-toolchain.mjs" --declaration "$TOOLCHAIN_FILE"

json_value() {
  node -e 'const fs=require("fs"); const value=process.argv[2].split(".").reduce((v,k)=>v[k],JSON.parse(fs.readFileSync(process.argv[1],"utf8"))); process.stdout.write(String(value));' "$TOOLCHAIN_FILE" "$1"
}

NSH_VERSION=$(json_value nsh.version)
NODE_VERSION=$(json_value node)
PNPM_VERSION=$(json_value pnpm)
RUST_VERSION=$(json_value rust)
GO_VERSION=$(json_value go)
XCODE_VERSION=$(json_value xcode)
MACOS_VERSION=$(json_value macos)
ARCHITECTURE=$(json_value architecture)
ARCHIVE_FILE=$(json_value nsh.archive.file)
ARCHIVE_URL=$(json_value nsh.archive.url)
ARCHIVE_SHA256=$(json_value nsh.archive.sha256)
SOURCE_REPOSITORY=$(json_value nsh.source.repository)
SOURCE_COMMIT=$(json_value nsh.source.peeledCommit)

DOWNLOAD_DIR="$INSTALL_ROOT/downloads"
DIST_DIR="$INSTALL_ROOT/nsh"
SOURCE_DIR="$INSTALL_ROOT/nsh-source"
ARCHIVE="$DOWNLOAD_DIR/$ARCHIVE_FILE"
mkdir -p "$DOWNLOAD_DIR"
rm -rf "$DIST_DIR" "$SOURCE_DIR"

if [ -n "${NSH_ARCHIVE_FILE:-}" ]; then
  cp "$NSH_ARCHIVE_FILE" "$ARCHIVE"
elif [ -f "$ARCHIVE" ] && [ "$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')" = "$ARCHIVE_SHA256" ]; then
  echo "Using cached, verified $ARCHIVE_FILE"
else
  rm -f "$ARCHIVE"
  curl --proto '=https' --tlsv1.2 --fail --location --retry 3 --output "$ARCHIVE" "$ARCHIVE_URL"
fi

ACTUAL_SHA256=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$ARCHIVE_SHA256" ]; then
  echo "NSH 归档 SHA-256 摘要不匹配: $ARCHIVE" >&2
  echo "期望: $ARCHIVE_SHA256" >&2
  echo "实际: $ACTUAL_SHA256" >&2
  exit 1
fi

# Extraction and execution happen only after the digest check above.
mkdir -p "$DIST_DIR"
tar -xzf "$ARCHIVE" -C "$DIST_DIR"
NSH_BIN=$(find "$DIST_DIR" -type f -path '*/bin/nsh' | sed -n '1p')
if [ -z "$NSH_BIN" ]; then
  echo "已验证的 NSH 归档不含 bin/nsh" >&2
  exit 1
fi
chmod 755 "$NSH_BIN"

git init -q "$SOURCE_DIR"
git -C "$SOURCE_DIR" remote add origin "$SOURCE_REPOSITORY"
git -C "$SOURCE_DIR" fetch --quiet --depth 1 origin "$SOURCE_COMMIT"
git -C "$SOURCE_DIR" checkout --quiet --detach FETCH_HEAD
ACTUAL_SOURCE_COMMIT=$(git -C "$SOURCE_DIR" rev-parse HEAD)
if [ "$ACTUAL_SOURCE_COMMIT" != "$SOURCE_COMMIT" ]; then
  echo "NSH 源码提交不匹配: $ACTUAL_SOURCE_COMMIT（期望 $SOURCE_COMMIT）" >&2
  exit 1
fi

NSH_BIN_DIR=$(dirname "$NSH_BIN")
PATH="$NSH_BIN_DIR:$PATH"
export PATH
NSH_SOURCE="$SOURCE_DIR"
export NSH_SOURCE

if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$NSH_BIN_DIR" >>"$GITHUB_PATH"
fi
if [ -n "${GITHUB_ENV:-}" ]; then
  printf 'NSH_SOURCE=%s\n' "$NSH_SOURCE" >>"$GITHUB_ENV"
fi

echo "==> 已验证工具版本"
ACTUAL_NODE=$(node --version)
ACTUAL_PNPM=$(pnpm --version)
ACTUAL_RUST=$(rustc --version)
ACTUAL_GO=$(go version)
ACTUAL_NSH=$("$NSH_BIN" --version)
ACTUAL_XCODE=$(xcodebuild -version)
ACTUAL_MACOS=$(sw_vers -productVersion)
ACTUAL_ARCHITECTURE=$(uname -m)
printf '%s\n' "$ACTUAL_NODE" "$ACTUAL_PNPM" "$ACTUAL_RUST" "$ACTUAL_GO" "$ACTUAL_NSH" "$ACTUAL_XCODE" "$ACTUAL_MACOS" "$ACTUAL_ARCHITECTURE"

version_error() {
  echo "$1 版本不符合发布工具链声明: $2（期望 $3）" >&2
  exit 1
}

case "$ACTUAL_NODE" in v"$NODE_VERSION".*) ;; *) version_error Node.js "$ACTUAL_NODE" "$NODE_VERSION.x" ;; esac
[ "$ACTUAL_PNPM" = "$PNPM_VERSION" ] || version_error pnpm "$ACTUAL_PNPM" "$PNPM_VERSION"
case "$ACTUAL_RUST" in "rustc $RUST_VERSION "*) ;; *) version_error Rust "$ACTUAL_RUST" "$RUST_VERSION" ;; esac
case "$ACTUAL_GO" in *" go$GO_VERSION "*) ;; *) version_error Go "$ACTUAL_GO" "$GO_VERSION" ;; esac
case "$ACTUAL_NSH" in *" $NSH_VERSION"*) ;; *) version_error NSH "$ACTUAL_NSH" "$NSH_VERSION" ;; esac
case "$ACTUAL_XCODE" in "Xcode $XCODE_VERSION"*) ;; *) version_error Xcode "$ACTUAL_XCODE" "$XCODE_VERSION.x" ;; esac
[ "$ACTUAL_ARCHITECTURE" = "$ARCHITECTURE" ] || version_error architecture "$ACTUAL_ARCHITECTURE" "$ARCHITECTURE"
echo "macOS runner $ACTUAL_MACOS; deployment target $MACOS_VERSION"
echo "NSH source $ACTUAL_SOURCE_COMMIT"
echo "NSH $NSH_VERSION 已安装到 $DIST_DIR"
