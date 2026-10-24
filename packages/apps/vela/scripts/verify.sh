#!/bin/sh
# One verification entry for both Vela clients. Release verification adds
# packaging and signing on top of this script; nothing here builds an app.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
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

# Structure and documentation contracts.
run structure node "$ROOT/tests/structure.test.mjs"
run protocol-docs sh "$ROOT/scripts/verify-protocol-docs.sh"
run documentation sh "$ROOT/scripts/verify-docs.sh"
run network-isolation sh "$ROOT/scripts/verify-network-isolation.sh"

# macOS surface: tokens, projections, layout and type checking.
run macos-theme node "$ROOT/macos/ui/tests/theme.test.mjs"
run shared-projections node "$ROOT/shared/ui/projections.test.mjs"
run shared-flows node "$ROOT/shared/ui/flows.test.mjs"
run shared-hostname node "$ROOT/shared/ui/hostname.test.mjs"
run macos-layout node "$ROOT/macos/ui/tests/desktop-layout.test.mjs"
run macos-nsh-check sh "$ROOT/scripts/nsh.sh" check "$ROOT/macos/ui/App.tsx"

# iOS surface: the same checks plus its dependency boundary.
run ios-theme node "$ROOT/ios/ui/tests/theme.test.mjs"
run ios-projections node "$ROOT/shared/ui/ios-projections.test.mjs"
run ios-structure node "$ROOT/ios/ui/tests/structure.test.mjs"
run ios-nsh-check sh "$ROOT/scripts/nsh.sh" check "$ROOT/ios/ui/App.tsx"
run ios-deps sh "$ROOT/scripts/verify-ios-deps.sh"

# Rust hosts (macOS binary and iOS staticlib).
run rust-format cargo fmt --manifest-path "$ROOT/Cargo.toml" --all --check
run rust-test cargo test --manifest-path "$ROOT/Cargo.toml" --locked --workspace
run rust-clippy cargo clippy --manifest-path "$ROOT/Cargo.toml" --locked --workspace --all-targets -- -D warnings
run ios-rust-check cargo check --manifest-path "$ROOT/Cargo.toml" --target aarch64-apple-ios -p vela-ios-native

# Go Core (both entry points share one module).
run go-race go test -C "$ROOT/core" -race ./...

echo "Vela verification passed; reports: $REPORTS"
