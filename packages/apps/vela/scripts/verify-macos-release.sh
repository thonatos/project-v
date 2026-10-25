#!/bin/sh
# Complete local/CI release gate for the macOS Desktop artifact only.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUTPUT=${VELA_RELEASE_OUTPUT:-"$ROOT/.tmp/macos-release"}
BUILD="$OUTPUT/build"
PLATFORM="$OUTPUT/platform"
VERSION=$(node -p "require('$ROOT/package.json').version")

rm -rf "$OUTPUT"
mkdir -p "$BUILD" "$PLATFORM"

sh "$ROOT/scripts/verify-common.sh"
sh "$ROOT/scripts/verify-macos.sh"
sh "$ROOT/scripts/build-app.sh" "$BUILD"
sh "$ROOT/scripts/release/macos-check-app.sh" "$BUILD/Vela.app" "$VERSION"
sh "$ROOT/scripts/release/macos-smoke-app.sh" "$BUILD/Vela.app"
sh "$ROOT/scripts/release/macos-package-app.sh" "$BUILD/Vela.app" "$VERSION" "$PLATFORM"

echo "Vela macOS release gate passed: $PLATFORM"
