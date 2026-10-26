#!/bin/sh
# macOS UI, host and operating-system contract checks.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
. "$ROOT/scripts/verify-lib.sh"

run network-isolation sh "$ROOT/scripts/verify-network-isolation.sh"
run macos-theme node "$ROOT/macos/ui/tests/theme.test.mjs"
run macos-layout node "$ROOT/macos/ui/tests/desktop-layout.test.mjs"
run macos-semantics sh "$ROOT/scripts/nsh.sh" test "$ROOT/macos/ui/tests/semantics.test.tsx" --target macos
run macos-shell-smoke sh "$ROOT/scripts/nsh.sh" test "$ROOT/macos/ui/tests/shell-smoke.test.tsx" --target macos
run macos-release-contract sh "$ROOT/tests/release/macos-release.test.sh"
run macos-nsh-check sh "$ROOT/scripts/nsh.sh" check "$ROOT/macos/ui/App.tsx"
run rust-format cargo fmt --manifest-path "$ROOT/Cargo.toml" --all --check
run rust-test cargo test --manifest-path "$ROOT/Cargo.toml" --locked --workspace
run rust-clippy cargo clippy --manifest-path "$ROOT/Cargo.toml" --locked --workspace --all-targets -- -D warnings

echo "Vela macOS verification passed; reports: $REPORTS"
