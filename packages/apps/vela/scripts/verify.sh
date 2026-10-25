#!/bin/sh
# Aggregate compatibility entry: compose every independently runnable gate.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

sh "$ROOT/scripts/verify-common.sh"
sh "$ROOT/scripts/verify-macos.sh"
sh "$ROOT/scripts/verify-ios.sh"

echo "Vela verification passed; reports: $ROOT/.tmp/release"
