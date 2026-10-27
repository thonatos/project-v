#!/bin/sh
# 验证 Vela macOS 发布 App 的元数据、Mach-O 兼容性与 ad-hoc 签名。
set -eu

APP=${1:-}
EXPECTED_VERSION=${2:-}
EXPECTED_BUNDLE_ID=${3:-io.implements.vela.macos}
MAX_MIN_OS=${4:-14.0}

fail() {
  echo "macos-check-app: $*" >&2
  exit 1
}

test -n "$APP" || fail "usage: $0 APP [VERSION [BUNDLE_ID [MAX_MIN_OS]]]"
test -d "$APP" || fail "App does not exist: $APP"
PLIST="$APP/Contents/Info.plist"
test -f "$PLIST" || fail "missing Contents/Info.plist"

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" 2>/dev/null || fail "missing Info.plist key: $1"
}

BUNDLE_ID=$(plist_value CFBundleIdentifier)
VERSION=$(plist_value CFBundleShortVersionString)
EXECUTABLE=$(plist_value CFBundleExecutable)
DECLARED_MIN_OS=$(plist_value LSMinimumSystemVersion)
BUILD=$(plist_value CFBundleVersion)
FEED_URL=$(plist_value SUFeedURL)
PUBLIC_KEY=$(plist_value SUPublicEDKey)

test "$BUNDLE_ID" = "$EXPECTED_BUNDLE_ID" || fail "CFBundleIdentifier is $BUNDLE_ID, expected $EXPECTED_BUNDLE_ID"
printf '%s\n' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "CFBundleShortVersionString is not X.Y.Z: $VERSION"
if test -n "$EXPECTED_VERSION"; then
  test "$VERSION" = "$EXPECTED_VERSION" || fail "CFBundleShortVersionString is $VERSION, expected $EXPECTED_VERSION"
fi
test "$DECLARED_MIN_OS" = "$MAX_MIN_OS" || fail "LSMinimumSystemVersion is $DECLARED_MIN_OS, expected $MAX_MIN_OS"
printf '%s\n' "$BUILD" | grep -Eq '^[1-9][0-9]*$' || fail "CFBundleVersion must be a positive integer: $BUILD"
test "$FEED_URL" = "https://raw.githubusercontent.com/thonatos/project-v/vela-updates/vela/macos/appcast.xml" || fail "SUFeedURL is not the stable Vela feed"
printf '%s' "$PUBLIC_KEY" | base64 --decode >/dev/null 2>&1 || fail "SUPublicEDKey is not base64"
test "$(printf '%s' "$PUBLIC_KEY" | base64 --decode | wc -c | tr -d ' ')" = 32 || fail "SUPublicEDKey must decode to 32 bytes"

MAIN="$APP/Contents/MacOS/$EXECUTABLE"
CORE="$APP/Contents/Helpers/vela-core"
test -x "$MAIN" || fail "main executable is missing or not executable: Contents/MacOS/$EXECUTABLE"
test -x "$CORE" || fail "Core helper is missing or not executable: Contents/Helpers/vela-core"

SPARKLE="$APP/Contents/Frameworks/Sparkle.framework"
SPARKLE_VERSION="$SPARKLE/Versions/B"
test -d "$SPARKLE_VERSION" || fail "missing Contents/Frameworks/Sparkle.framework/Versions/B"
test -L "$SPARKLE/Versions/Current" || fail "Sparkle Versions/Current symlink is missing"
test "$(readlink "$SPARKLE/Versions/Current")" = B || fail "Sparkle Versions/Current must point to B"
for RELATIVE in \
  Sparkle \
  Autoupdate \
  Updater.app/Contents/MacOS/Updater \
  XPCServices/Downloader.xpc/Contents/MacOS/Downloader \
  XPCServices/Installer.xpc/Contents/MacOS/Installer
do
  test -x "$SPARKLE_VERSION/$RELATIVE" || fail "Sparkle executable is missing: Contents/Frameworks/Sparkle.framework/Versions/B/$RELATIVE"
done
otool -l "$MAIN" | awk '$1 == "cmd" && $2 == "LC_RPATH" { wanted=1; next } wanted && $1 == "path" { print $2; wanted=0 }' | \
  grep -qx '@executable_path/../Frameworks' || fail "main executable is missing the Sparkle Frameworks rpath"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/vela-macos-check.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
MACHOS="$WORK/machos"
FILES="$WORK/files"
find "$APP/Contents" -type f -print >"$FILES"
while IFS= read -r FILE; do
  if file "$FILE" | grep -q 'Mach-O'; then
    printf '%s\n' "$FILE"
  fi
done <"$FILES" >"$MACHOS"
test -s "$MACHOS" || fail "App contains no Mach-O files"

version_not_above() {
  awk -v actual="$1" -v maximum="$2" 'BEGIN {
    split(actual, a, "."); split(maximum, m, ".")
    for (i = 1; i <= 3; i++) {
      av = (a[i] == "" ? 0 : a[i]) + 0
      mv = (m[i] == "" ? 0 : m[i]) + 0
      if (av < mv) exit 0
      if (av > mv) exit 1
    }
    exit 0
  }'
}

while IFS= read -r FILE; do
  RELATIVE=${FILE#"$APP/"}
  ARCHS=$(lipo -archs "$FILE" 2>/dev/null) || fail "$RELATIVE: cannot read architectures"
  test "$ARCHS" = "arm64" || fail "$RELATIVE: architecture is $ARCHS, expected arm64"

  MIN_OS=$(otool -l "$FILE" | awk '
    $1 == "cmd" && ($2 == "LC_BUILD_VERSION" || $2 == "LC_VERSION_MIN_MACOSX") { wanted = 1; next }
    wanted && ($1 == "minos" || $1 == "version") { print $2; exit }
  ')
  test -n "$MIN_OS" || fail "$RELATIVE: no macOS minimum version load command"
  version_not_above "$MIN_OS" "$MAX_MIN_OS" || fail "$RELATIVE: minos is $MIN_OS, maximum is $MAX_MIN_OS"

  SIGNATURE=$(codesign -d --verbose=4 "$FILE" 2>&1) || fail "$RELATIVE: missing or unreadable code signature"
  printf '%s\n' "$SIGNATURE" | grep -q '^Signature=adhoc$' || fail "$RELATIVE: signature is not ad-hoc"
  printf '%s\n' "$SIGNATURE" | grep -q '^TeamIdentifier=not set$' || fail "$RELATIVE: TeamIdentifier must not be set"
  codesign --verify --strict "$FILE" >/dev/null 2>&1 || fail "$RELATIVE: code signature verification failed"
done <"$MACHOS"

APP_SIGNATURE=$(codesign -d --verbose=4 "$APP" 2>&1) || fail "App signature is missing or unreadable"
printf '%s\n' "$APP_SIGNATURE" | grep -q '^Signature=adhoc$' || fail "App signature is not ad-hoc"
printf '%s\n' "$APP_SIGNATURE" | grep -q '^TeamIdentifier=not set$' || fail "App TeamIdentifier must not be set"
codesign --verify --deep --strict "$APP" >/dev/null 2>&1 || fail "App code signature verification failed"
codesign --verify --deep --strict "$SPARKLE" >/dev/null 2>&1 || fail "Sparkle framework signature verification failed"

echo "macos-check-app: Vela.app $VERSION is a valid macOS arm64 ad-hoc bundle"
