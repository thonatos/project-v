#!/bin/sh
# Platform-neutral protocol, projection, configuration and Go Core checks.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
. "$ROOT/scripts/verify-lib.sh"

run structure node "$ROOT/tests/structure.test.mjs"
run protocol-docs sh "$ROOT/scripts/verify-protocol-docs.sh"
run documentation sh "$ROOT/scripts/verify-docs.sh"
run shared-projections node "$ROOT/shared/ui/projections.test.mjs"
run shared-version node "$ROOT/shared/ui/version.test.mjs"
run shared-flows node "$ROOT/shared/ui/flows.test.mjs"
run shared-operations node "$ROOT/shared/ui/operations.test.mjs"
run shared-clipboard node "$ROOT/shared/ui/clipboard.test.mjs"
run capabilities node "$ROOT/tests/capabilities.test.mjs"
run shared-hostname node "$ROOT/shared/ui/hostname.test.mjs"
run release-toolchain node "$ROOT/tests/release-toolchain.test.mjs"
run release-manifest node "$ROOT/tests/release-manifest-assemble.test.mjs"
run update-feed node "$ROOT/tests/update-feed.test.mjs"
run update-feed-publish node "$ROOT/tests/update-feed-publish.test.mjs"
run release-workflows node "$ROOT/tests/release-workflows.test.mjs"
run verify-gates node "$ROOT/tests/verify-gates.test.mjs"
run go-race go test -C "$ROOT/core" -race ./...

echo "Vela common verification passed; reports: $REPORTS"
