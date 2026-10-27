#!/bin/sh
set -eu

VELA_ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
CHECK="$VELA_ROOT/scripts/release/macos-check-app.sh"
SMOKE="$VELA_ROOT/scripts/release/macos-smoke-app.sh"
PACKAGE="$VELA_ROOT/scripts/release/macos-package-app.sh"
EMBED="$VELA_ROOT/scripts/release/embed-sparkle.sh"
BASE_TMP=${VELA_TEST_TMP:-"$VELA_ROOT/.tmp/tests"}
mkdir -p "$BASE_TMP"
WORK=$(mktemp -d "$BASE_TMP/vela-macos-release-tests.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM

fail() {
  echo "macos-release.test: $*" >&2
  exit 1
}

assert_fails_with() {
  EXPECTED=$1
  shift
  if "$@" >"$WORK/failure.out" 2>&1; then
    fail "command unexpectedly passed: $*"
  fi
  grep -q "$EXPECTED" "$WORK/failure.out" || {
    cat "$WORK/failure.out" >&2
    fail "failure did not mention: $EXPECTED"
  }
}

write_plist() {
  DESTINATION=$1
  IDENTIFIER=$2
  cat >"$DESTINATION" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Vela</string>
  <key>CFBundleIdentifier</key><string>$IDENTIFIER</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>SUFeedURL</key><string>https://raw.githubusercontent.com/thonatos/project-v/vela-updates/vela/macos/appcast.xml</string>
  <key>SUPublicEDKey</key><string>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</string>
  <key>SUScheduledCheckInterval</key><integer>86400</integer>
  <key>SUAutomaticallyUpdate</key><false/>
  <key>SUAllowsAutomaticUpdates</key><false/>
  <key>SUVerifyUpdateBeforeExtraction</key><true/>
</dict></plist>
EOF
}

compile_binary() {
  COMPILE_TARGET=$1
  COMPILE_DESTINATION=$2
  xcrun clang -target "$COMPILE_TARGET" -x c -o "$COMPILE_DESTINATION" - <<'EOF'
int main(void) { return 0; }
EOF
  chmod 755 "$COMPILE_DESTINATION"
}

compile_main() {
  COMPILE_DESTINATION=$1
  xcrun clang -target arm64-apple-macos14.0 -Wl,-rpath,@executable_path/../Frameworks -x c -o "$COMPILE_DESTINATION" - <<'EOF'
int main(void) { return 0; }
EOF
  chmod 755 "$COMPILE_DESTINATION"
}

make_app() {
  APP_PATH=$1
  HELPER_TARGET=${2:-arm64-apple-macos14.0}
  mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Helpers" "$APP_PATH/Contents/Resources/nsh"
  write_plist "$APP_PATH/Contents/Info.plist" io.implements.vela.macos
  compile_main "$APP_PATH/Contents/MacOS/Vela"
  compile_binary "$HELPER_TARGET" "$APP_PATH/Contents/Helpers/vela-core"
  printf 'fixture resource\n' >"$APP_PATH/Contents/Resources/nsh/bundle.nshc"
  codesign --force --sign - "$APP_PATH/Contents/Helpers/vela-core" >/dev/null
  codesign --force --sign - "$APP_PATH" >/dev/null
  SPARKLE_SOURCE="$APP_PATH.sparkle-source"
  make_sparkle "$SPARKLE_SOURCE"
  sh "$EMBED" "$APP_PATH" "$SPARKLE_SOURCE" >/dev/null
  codesign --force --sign - "$APP_PATH" >/dev/null
}

make_sparkle() {
  ROOT=$1
  VERSION="$ROOT/Sparkle.framework/Versions/B"
  mkdir -p \
    "$VERSION/Resources" \
    "$VERSION/Updater.app/Contents/MacOS" \
    "$VERSION/XPCServices/Downloader.xpc/Contents/MacOS" \
    "$VERSION/XPCServices/Installer.xpc/Contents/MacOS"
  compile_binary arm64-apple-macos14.0 "$VERSION/Sparkle"
  compile_binary arm64-apple-macos14.0 "$VERSION/Autoupdate"
  write_nested_plist "$VERSION/Resources/Info.plist" org.sparkle-project.Sparkle BNDL Sparkle
  write_nested_plist "$VERSION/Updater.app/Contents/Info.plist" org.sparkle-project.Updater APPL Updater
  write_nested_plist "$VERSION/XPCServices/Downloader.xpc/Contents/Info.plist" org.sparkle-project.Downloader XPC! Downloader
  write_nested_plist "$VERSION/XPCServices/Installer.xpc/Contents/Info.plist" org.sparkle-project.Installer XPC! Installer
  compile_binary arm64-apple-macos14.0 "$VERSION/Updater.app/Contents/MacOS/Updater"
  compile_binary arm64-apple-macos14.0 "$VERSION/XPCServices/Downloader.xpc/Contents/MacOS/Downloader"
  compile_binary arm64-apple-macos14.0 "$VERSION/XPCServices/Installer.xpc/Contents/MacOS/Installer"
  ln -s B "$ROOT/Sparkle.framework/Versions/Current"
  ln -s Versions/Current/Sparkle "$ROOT/Sparkle.framework/Sparkle"
  ln -s Versions/Current/Resources "$ROOT/Sparkle.framework/Resources"
  ln -s Versions/Current/Updater.app "$ROOT/Sparkle.framework/Updater.app"
  ln -s Versions/Current/XPCServices "$ROOT/Sparkle.framework/XPCServices"
}

write_nested_plist() {
  DESTINATION=$1
  IDENTIFIER=$2
  PACKAGE_TYPE=$3
  EXECUTABLE=$4
  cat >"$DESTINATION" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>$EXECUTABLE</string>
  <key>CFBundleIdentifier</key><string>$IDENTIFIER</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundlePackageType</key><string>$PACKAGE_TYPE</string>
</dict></plist>
EOF
}

GOOD="$WORK/good/Vela.app"
make_app "$GOOD"
test -L "$GOOD/Contents/Frameworks/Sparkle.framework/Versions/Current" || fail "Sparkle Current symlink was lost"
test "$(lipo -archs "$GOOD/Contents/Frameworks/Sparkle.framework/Versions/B/Sparkle")" = arm64 || fail "Sparkle was not thinned to arm64"
codesign --verify --deep --strict "$GOOD/Contents/Frameworks/Sparkle.framework" || fail "embedded Sparkle signature failed"
sh "$CHECK" "$GOOD" 0.1.0 >"$WORK/check-good.out"

BAD_METADATA="$WORK/bad-metadata/Vela.app"
ditto "$GOOD" "$BAD_METADATA"
write_plist "$BAD_METADATA/Contents/Info.plist" io.example.tampered
assert_fails_with 'CFBundleIdentifier' sh "$CHECK" "$BAD_METADATA" 0.1.0

BAD_ARCH="$WORK/bad-arch/Vela.app"
make_app "$BAD_ARCH" x86_64-apple-macos14.0
assert_fails_with 'architecture is x86_64' sh "$CHECK" "$BAD_ARCH" 0.1.0

BAD_MINOS="$WORK/bad-minos/Vela.app"
make_app "$BAD_MINOS" arm64-apple-macos15.0
assert_fails_with 'minos is 15.0' sh "$CHECK" "$BAD_MINOS" 0.1.0

MISSING_SPARKLE="$WORK/missing-sparkle/Vela.app"
ditto "$GOOD" "$MISSING_SPARKLE"
rm -rf "$MISSING_SPARKLE/Contents/Frameworks/Sparkle.framework"
assert_fails_with 'missing Contents/Frameworks/Sparkle.framework' sh "$CHECK" "$MISSING_SPARKLE" 0.1.0

BROKEN_SYMLINK="$WORK/broken-symlink/Vela.app"
ditto "$GOOD" "$BROKEN_SYMLINK"
rm "$BROKEN_SYMLINK/Contents/Frameworks/Sparkle.framework/Versions/Current"
mkdir "$BROKEN_SYMLINK/Contents/Frameworks/Sparkle.framework/Versions/Current"
assert_fails_with 'Versions/Current symlink is missing' sh "$CHECK" "$BROKEN_SYMLINK" 0.1.0

TAMPERED_SPARKLE="$WORK/tampered-sparkle/Vela.app"
ditto "$GOOD" "$TAMPERED_SPARKLE"
printf 'tampered\n' >>"$TAMPERED_SPARKLE/Contents/Frameworks/Sparkle.framework/Versions/B/Resources/Info.plist"
assert_fails_with 'code signature verification failed' sh "$CHECK" "$TAMPERED_SPARKLE" 0.1.0

OUTPUT="$WORK/release"
ZIP=$(sh "$PACKAGE" "$GOOD" 0.1.0 "$OUTPUT" | tail -n 1)
test "$ZIP" = "$OUTPUT/Vela-Desktop-0.1.0-macos-arm64.zip" || fail "unexpected asset path: $ZIP"
test -f "$ZIP" || fail "release ZIP was not created"
mkdir "$WORK/manual-unpack"
ditto -x -k "$ZIP" "$WORK/manual-unpack"
test -x "$WORK/manual-unpack/Vela.app/Contents/MacOS/Vela" || fail "ZIP lost main executable permission"
test -x "$WORK/manual-unpack/Vela.app/Contents/Helpers/vela-core" || fail "ZIP lost helper executable permission"
test -f "$WORK/manual-unpack/Vela.app/Contents/Resources/nsh/bundle.nshc" || fail "ZIP lost resources"
codesign --verify --deep --strict "$WORK/manual-unpack/Vela.app" || fail "ZIP broke codesign integrity"

FAKE="$WORK/fake/Vela.app"
mkdir -p "$FAKE/Contents/MacOS"
write_plist "$FAKE/Contents/Info.plist" io.implements.vela.macos
cat >"$FAKE/Contents/MacOS/Vela" <<'EOF'
#!/bin/sh
if test -n "${VELA_UPDATE_SMOKE:-}"; then
  echo "VELA_UPDATE_SMOKE check=1" >&2
  echo "VELA_UPDATE_SMOKE menu=selected" >&2
  exit 0
fi
test "$VELA_LIFECYCLE_SCRIPT" = close,reopen,quit
case "$HOME" in */macos-lifecycle.*/home) ;; *) exit 21 ;; esac
case "$TMPDIR" in */macos-lifecycle.*/tmp) ;; *) exit 22 ;; esac
echo "VELA_SMOKE generation=1 action=close window=0x1 view=0x2" >&2
echo "VELA_SMOKE core=Some((123, 1))" >&2
echo "VELA_SMOKE generation=1 action=reopen window=0x1 view=0x2" >&2
echo "VELA_SMOKE core=Some((123, 1))" >&2
echo "VELA_SMOKE action=quit" >&2
echo "VELA_LIFECYCLE terminated core=None" >&2
EOF
chmod 755 "$FAKE/Contents/MacOS/Vela"
SMOKE_TMP="$WORK/project/packages/apps/vela/.tmp"
DIAGNOSTICS="$WORK/diagnostics/macos-lifecycle-smoke.log"
VELA_SMOKE_TMP_ROOT="$SMOKE_TMP" VELA_SMOKE_DIAGNOSTICS="$DIAGNOSTICS" sh "$SMOKE" "$FAKE" >"$WORK/smoke-good.out"
test -d "$SMOKE_TMP" || fail "smoke did not use configured project-local temporary root"
test -z "$(find "$SMOKE_TMP" -mindepth 1 -print -quit)" || fail "smoke retained private HOME/TMPDIR data"

cat >"$FAKE/Contents/MacOS/Vela" <<'EOF'
#!/bin/sh
echo "private path: $HOME/Library/Application Support/Vela" >&2
echo "VELA_SMOKE generation=1 action=close window=0x1 view=0x2" >&2
exit 7
EOF
chmod 755 "$FAKE/Contents/MacOS/Vela"
assert_fails_with '<isolated-home>' env VELA_SMOKE_TMP_ROOT="$SMOKE_TMP" VELA_SMOKE_DIAGNOSTICS="$DIAGNOSTICS" sh "$SMOKE" "$FAKE"
if grep -q "$SMOKE_TMP/macos-lifecycle" "$WORK/failure.out"; then
  fail "smoke failure leaked its isolated HOME path"
fi
test -z "$(find "$SMOKE_TMP" -mindepth 1 -print -quit)" || fail "failed smoke retained raw diagnostics"
test -f "$DIAGNOSTICS" || fail "failed smoke did not retain sanitized diagnostics"
grep -q '<isolated-home>' "$DIAGNOSTICS" || fail "retained diagnostics were not sanitized"
if grep -q "$SMOKE_TMP/macos-lifecycle" "$DIAGNOSTICS"; then
  fail "retained diagnostics leaked their isolated HOME path"
fi

grep -q '^MACOSX_DEPLOYMENT_TARGET=14.0$' "$VELA_ROOT/scripts/build-app.sh" || fail "build-app does not pin macOS 14"
grep -q '^export MACOSX_DEPLOYMENT_TARGET$' "$VELA_ROOT/scripts/build-app.sh" || fail "build-app does not export deployment target"
grep -q 'macos-check-app.sh' "$VELA_ROOT/scripts/build-app.sh" || fail "build-app does not verify Mach-O outputs"

PRODUCTION_PLIST="$VELA_ROOT/macos/app/Info.plist"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUFeedURL' "$PRODUCTION_PLIST")" = \
  'https://raw.githubusercontent.com/thonatos/project-v/vela-updates/vela/macos/appcast.xml' || fail "production feed URL is missing"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$PRODUCTION_PLIST")" = \
  '3BI5sbsu8dEoDZQl/AVeL7Fdaa32BzMtePfG0Z2XXF8=' || fail "production public update key is missing"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUScheduledCheckInterval' "$PRODUCTION_PLIST")" = 86400 || fail "scheduled check interval must be one day"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUAutomaticallyUpdate' "$PRODUCTION_PLIST")" = false || fail "silent updates must stay disabled"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUAllowsAutomaticUpdates' "$PRODUCTION_PLIST")" = false || fail "automatic installation must not be offered"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUVerifyUpdateBeforeExtraction' "$PRODUCTION_PLIST")" = true || fail "archives must be verified before extraction"
if grep -Eq 'Developer ID|notari[sz]' "$PRODUCTION_PLIST"; then
  fail "Info.plist must not claim Developer ID signing or notarization"
fi

echo "macos-release.test: App fixtures, lifecycle isolation and ditto round trip passed"
