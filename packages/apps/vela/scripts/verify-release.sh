#!/bin/sh
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
  "$@" >"$REPORTS/$name.log" 2>&1
}

run protocol-docs sh "$ROOT/scripts/verify-protocol-docs.sh"
run documentation sh "$ROOT/scripts/verify-docs.sh"
run theme node "$ROOT/ui/tests/theme.test.mjs"
run ui-model node "$ROOT/ui/tests/view-model.test.mjs"
run ui-layout node "$ROOT/ui/tests/desktop-layout.test.mjs"
run nsh-check sh "$ROOT/scripts/nsh.sh" check "$ROOT/ui/App.tsx"
run rust-format cargo fmt --manifest-path "$ROOT/Cargo.toml" --all --check
run rust-test cargo test --manifest-path "$ROOT/Cargo.toml" --locked --workspace
run rust-clippy cargo clippy --manifest-path "$ROOT/Cargo.toml" --locked --workspace --all-targets -- -D warnings
run go-race go test -C "$ROOT/core" -race ./...
run network-isolation sh "$ROOT/scripts/verify-network-isolation.sh"
run app-build sh "$ROOT/scripts/build-app.sh" "$BUILD"
run app-signature codesign --verify --deep --strict --verbose=2 "$BUILD/Vela.app"

echo "Vela release verification passed; reports: $REPORTS"
