#!/bin/sh
# Explicit, local iOS Simulator acceptance. This is evidence to collect before
# completing a change; it is never part of default verification or CI/release.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

if [ "${CI:-}" = "true" ]; then
  echo "iOS Simulator acceptance is local-only and must not run in CI" >&2
  exit 2
fi

. "$ROOT/scripts/verify-lib.sh"
run ios-semantics sh "$ROOT/scripts/nsh.sh" test "$ROOT/ios/ui/tests/semantics.test.tsx" --target ios

echo "Vela local iOS Simulator acceptance passed; reports: $REPORTS"
