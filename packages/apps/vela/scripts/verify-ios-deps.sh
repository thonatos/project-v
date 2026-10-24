#!/bin/sh
# Fails when the iOS Core pulls in the macOS-only servicing packages.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

FORBIDDEN="publication sharing inbound authorization services"
DEPS=$(go list -C core -deps ./mobile)

for package in $FORBIDDEN; do
  if printf '%s\n' "$DEPS" | grep -Eq "/internal/${package}$"; then
    echo "iOS Core must not depend on internal/${package}" >&2
    exit 1
  fi
done

# The access core is the only place iOS obtains control services; keep the
# check honest if it quietly starts importing a forbidden package.
DEPS_ACCESS=$(go list -C core -deps ./internal/access)
for package in $FORBIDDEN; do
  if printf '%s\n' "$DEPS_ACCESS" | grep -Eq "/internal/${package}$"; then
    echo "iOS access core must not depend on internal/${package}" >&2
    exit 1
  fi
done

echo "iOS Core dependency check passed"
