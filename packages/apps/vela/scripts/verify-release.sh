#!/bin/sh
# Release gate: the aggregate verification, then packaging and signing for
# both clients. iOS packaging is unsigned unless DEVELOPMENT_TEAM is set.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
REPORTS="$ROOT/.tmp/release"
BUILD="$ROOT/.tmp/release-build"
mkdir -p "$REPORTS"
export TMPDIR="$ROOT/.tmp/runtime"
mkdir -p "$TMPDIR"

run() {
  name=$1
  shift
  echo "==> $name"
  if ! "$@" >"$REPORTS/$name.log" 2>&1; then
    echo "verify-release: ${name} failed" >&2
    tail -n 40 "$REPORTS/$name.log" >&2
    exit 1
  fi
}

sh "$ROOT/scripts/verify.sh"

run app-build sh "$ROOT/scripts/build-app.sh" "$BUILD"
run app-signature codesign --verify --deep --strict --verbose=2 "$BUILD/Vela.app"
run ios-build sh "$ROOT/scripts/build-ios.sh"

echo "Vela release verification passed; reports: $REPORTS"
