#!/bin/sh
# Copy the pinned Sparkle distribution into Vela.app, thin it to arm64 and
# re-sign every nested boundary before the containing framework is signed.
set -eu

APP=${1:-}
SPARKLE_ROOT=${2:-${SPARKLE_HOME:-}}

fail() {
  echo "embed-sparkle: $*" >&2
  exit 1
}

test -n "$APP" && test -n "$SPARKLE_ROOT" || fail "usage: $0 APP SPARKLE_HOME"
test -d "$APP/Contents" || fail "App Contents does not exist: $APP"
SOURCE="$SPARKLE_ROOT/Sparkle.framework"
test -d "$SOURCE" || fail "Sparkle.framework does not exist under $SPARKLE_ROOT"

FRAMEWORKS="$APP/Contents/Frameworks"
DESTINATION="$FRAMEWORKS/Sparkle.framework"
mkdir -p "$FRAMEWORKS"
rm -rf "$DESTINATION"
ditto "$SOURCE" "$DESTINATION"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/vela-embed-sparkle.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
MACHOS="$WORK/machos"
find "$DESTINATION" -type f -print | while IFS= read -r FILE; do
  if file "$FILE" | grep -q 'Mach-O'; then
    printf '%s\n' "$FILE"
  fi
done >"$MACHOS"
test -s "$MACHOS" || fail "Sparkle.framework contains no Mach-O files"

while IFS= read -r FILE; do
  ARCHS=$(lipo -archs "$FILE" 2>/dev/null) || fail "cannot read architectures: ${FILE#"$APP/"}"
  case " $ARCHS " in
    *' arm64 '*) ;;
    *) fail "${FILE#"$APP/"}: Sparkle binary does not contain arm64 ($ARCHS)" ;;
  esac
  if test "$ARCHS" != arm64; then
    lipo "$FILE" -thin arm64 -output "$FILE.thin"
    chmod "$(stat -f '%Lp' "$FILE")" "$FILE.thin"
    mv "$FILE.thin" "$FILE"
  fi
done <"$MACHOS"

VERSION="$DESTINATION/Versions/B"
for BUNDLE in \
  "$VERSION/XPCServices/Downloader.xpc" \
  "$VERSION/XPCServices/Installer.xpc" \
  "$VERSION/Updater.app"
do
  test -d "$BUNDLE" || fail "missing nested Sparkle bundle: ${BUNDLE#"$APP/"}"
  codesign --force --sign - "$BUNDLE"
done
codesign --force --sign - "$DESTINATION"
codesign --verify --deep --strict "$DESTINATION"

test -L "$DESTINATION/Versions/Current" || fail "Versions/Current symlink was not preserved"
test -L "$DESTINATION/Sparkle" || fail "Sparkle binary symlink was not preserved"
echo "$DESTINATION"
