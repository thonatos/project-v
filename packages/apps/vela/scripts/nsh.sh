#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
export TMPDIR="$ROOT/.tmp/runtime"
mkdir -p "$TMPDIR"

if [ -z "${NSH_SOURCE:-}" ] && [ -d "$HOME/.nsh/source" ]; then
  # development.md asks developers to export NSH_SOURCE; fall back to the
  # installer's documented checkout location so the scripts work out of the box.
  NSH_SOURCE="$HOME/.nsh/source"
  export NSH_SOURCE
fi

if [ -z "${NSH_SOURCE:-}" ]; then
  echo "Vela's NSH Rust integration requires NSH_SOURCE (or a checkout at ~/.nsh/source)" >&2
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
