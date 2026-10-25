#!/bin/sh
# Shared reporting helper for Vela's independently runnable verification gates.

set -eu

if [ -z "${ROOT:-}" ]; then
  echo "verify-lib: ROOT must name the Vela directory" >&2
  exit 2
fi

REPORTS="$ROOT/.tmp/release"
mkdir -p "$REPORTS"
export TMPDIR="$ROOT/.tmp/runtime"
mkdir -p "$TMPDIR"

run() {
  name=$1
  shift
  echo "==> $name"
  if ! "$@" >"$REPORTS/$name.log" 2>&1; then
    echo "verify: ${name} failed" >&2
    tail -n 40 "$REPORTS/$name.log" >&2
    exit 1
  fi
}
