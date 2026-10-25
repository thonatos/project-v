#!/bin/sh
# iOS UI, dependency boundary and cross-target host checks.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
. "$ROOT/scripts/verify-lib.sh"

run ios-theme node "$ROOT/ios/ui/tests/theme.test.mjs"
run ios-projections node "$ROOT/shared/ui/ios-projections.test.mjs"
run ios-signing node "$ROOT/ios/ui/tests/signing.test.mjs"
run ios-structure node "$ROOT/ios/ui/tests/structure.test.mjs"
run ios-nsh-check sh "$ROOT/scripts/nsh.sh" check "$ROOT/ios/ui/App.tsx"
run ios-deps sh "$ROOT/scripts/verify-ios-deps.sh"
run ios-rust-check cargo check --manifest-path "$ROOT/Cargo.toml" --target aarch64-apple-ios -p vela-ios-native

echo "Vela iOS verification passed; reports: $REPORTS"
