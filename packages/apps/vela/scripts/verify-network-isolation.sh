#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
mkdir -p "$ROOT/.tmp/runtime/network-isolation"
VELA_TEST_TMP="$ROOT/.tmp/runtime/network-isolation" go run -C "$ROOT/core" ./cmd/network-isolation
