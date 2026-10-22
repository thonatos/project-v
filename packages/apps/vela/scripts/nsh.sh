#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
export TMPDIR="$ROOT/.tmp/runtime"
mkdir -p "$TMPDIR"

if [ -z "${NSH_SOURCE:-}" ]; then
  echo "Vela's NSH Rust integration requires the global NSH_SOURCE environment variable" >&2
  exit 127
fi

if command -v nsh >/dev/null 2>&1; then
  exec nsh "$@"
fi

if [ -x "$HOME/.nsh/bin/nsh" ]; then
  exec "$HOME/.nsh/bin/nsh" "$@"
fi

echo "Vela requires the globally installed NSH v0.1.1 toolchain" >&2
exit 127
