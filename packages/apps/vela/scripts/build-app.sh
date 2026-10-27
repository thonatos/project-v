#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUT=${1:-"$ROOT/build/app"}
MACOSX_DEPLOYMENT_TARGET=14.0
export MACOSX_DEPLOYMENT_TARGET
CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET"
CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET"
export CGO_CFLAGS CGO_LDFLAGS
case "$OUT" in
  "$ROOT"/*) ;;
  *) echo "Vela build output must stay inside $ROOT" >&2; exit 2 ;;
esac
APP="$OUT/Vela.app"
CONTENTS="$APP/Contents"
SPARKLE_ROOT=${SPARKLE_HOME:-${VELA_TOOLCHAIN_CACHE:-}/sparkle}
test -n "$SPARKLE_ROOT" && test -d "$SPARKLE_ROOT/Sparkle.framework" || {
  echo "Vela build requires verified SPARKLE_HOME (run prepare-ci-toolchain.sh first)" >&2
  exit 127
}

rm -rf "$OUT"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Helpers" "$CONTENTS/Resources/nsh/assets"

sh "$ROOT/scripts/nsh.sh" build "$ROOT/macos/ui/App.tsx" --release -o "$OUT/ui"
# Remap the build machine's paths so panic locations and debug info in the
# shipped binary do not reveal the developer's home directory.
export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$ROOT=/vela --remap-path-prefix=$HOME=/home/user"
export RUSTFLAGS="$RUSTFLAGS -C link-arg=-Wl,-rpath,@executable_path/../Frameworks"
cargo build --manifest-path "$ROOT/Cargo.toml" --locked --release --package vela-host
go build -C "$ROOT/core" -trimpath -o "$CONTENTS/Helpers/vela-core" ./cmd/vela-core

cp "$ROOT/target/release/vela-host" "$CONTENTS/MacOS/Vela"
cp "$OUT/ui/bundle.nshc" "$CONTENTS/Resources/nsh/bundle.nshc"
test ! -d "$OUT/ui/assets" || cp -R "$OUT/ui/assets/." "$CONTENTS/Resources/nsh/assets/"

# Icon Composer icon: Assets.car carries the light, dark and tinted renditions
# macOS 26+ picks from; AppIcon.icns is the fallback for older systems.
xcrun actool "$ROOT/macos/app/AppIcon.icon" \
  --compile "$CONTENTS/Resources" \
  --platform macosx \
  --minimum-deployment-target 14.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$OUT/icon-partial.plist" \
  --output-format human-readable-text >/dev/null

cp "$ROOT/macos/app/Info.plist" "$CONTENTS/Info.plist"

chmod 755 "$CONTENTS/MacOS/Vela" "$CONTENTS/Helpers/vela-core"
sh "$ROOT/scripts/release/embed-sparkle.sh" "$APP" "$SPARKLE_ROOT" >/dev/null
codesign --force --sign - "$CONTENTS/Helpers/vela-core"
codesign --force --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
sh "$ROOT/scripts/release/macos-check-app.sh" "$APP"
echo "$APP"
