#!/bin/sh
# 使用 ditto 打包 Vela.app，并从新目录解压后复验完整产物契约。
set -eu

APP=${1:-}
VERSION=${2:-}
OUTPUT_DIR=${3:-}
DITTO=${DITTO:-ditto}

fail() {
  echo "macos-package-app: $*" >&2
  exit 1
}

test -n "$APP" && test -n "$VERSION" && test -n "$OUTPUT_DIR" || fail "usage: $0 APP VERSION OUTPUT_DIR"
test -d "$APP" || fail "App does not exist: $APP"
printf '%s\n' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "version must use X.Y.Z form: $VERSION"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
CHECK="$SCRIPT_DIR/macos-check-app.sh"
sh "$CHECK" "$APP" "$VERSION"

mkdir -p "$OUTPUT_DIR"
WORK=$(mktemp -d "$OUTPUT_DIR/.macos-package.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
ASSET="Vela-Desktop-$VERSION-macos-arm64.zip"
ZIP="$WORK/$ASSET"
UNPACKED="$WORK/unpacked"
mkdir -p "$UNPACKED"

"$DITTO" -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
"$DITTO" -x -k "$ZIP" "$UNPACKED"
UNPACKED_APP="$UNPACKED/$(basename "$APP")"
test -d "$UNPACKED_APP" || fail "ZIP does not contain $(basename "$APP")"
sh "$CHECK" "$UNPACKED_APP" "$VERSION"

test -d "$APP/Contents/Resources" || fail "source App has no Resources directory"
test -d "$UNPACKED_APP/Contents/Resources" || fail "ZIP lost the Resources directory"
diff -qr "$APP/Contents/Resources" "$UNPACKED_APP/Contents/Resources" >/dev/null || fail "ZIP changed App resources"

FILES="$WORK/files"
find "$APP/Contents" -type f -print >"$FILES"
while IFS= read -r FILE; do
  if file "$FILE" | grep -q 'Mach-O'; then
    RELATIVE=${FILE#"$APP/"}
    SOURCE_MODE=$(stat -f '%Lp' "$FILE")
    UNPACKED_MODE=$(stat -f '%Lp' "$UNPACKED_APP/$RELATIVE")
    test "$SOURCE_MODE" = "$UNPACKED_MODE" || fail "$RELATIVE: executable mode changed from $SOURCE_MODE to $UNPACKED_MODE"
  fi
done <"$FILES"

mv "$ZIP" "$OUTPUT_DIR/$ASSET"
echo "$OUTPUT_DIR/$ASSET"
