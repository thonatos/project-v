#!/bin/sh
# Builds Vela for iPhone. Set DEVELOPMENT_TEAM (and optionally DESTINATION or
# CONFIGURATION) to sign it for a device.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
CONFIGURATION=${CONFIGURATION:-Release}
DESTINATION=${DESTINATION:-generic/platform=iOS}
DERIVED=${DERIVED_DATA:-"$ROOT/.tmp/ios-derived"}

if [ "${SKIP_CORE_BUILD:-0}" != "1" ]; then
  sh "$ROOT/scripts/build-ios-core.sh" "$ROOT/build/ios"
fi

SIGNING=""
if [ -n "${DEVELOPMENT_TEAM:-}" ]; then
  SIGNING="DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM CODE_SIGN_STYLE=Automatic"
else
  SIGNING="CODE_SIGNING_ALLOWED=NO"
  echo "warning: DEVELOPMENT_TEAM is unset; building without signing" >&2
fi

PLATFORM=iphoneos
ARCH_FLAG=""
case "$DESTINATION" in
  *Simulator*) PLATFORM=iphonesimulator; ARCH_FLAG="ARCHS=arm64" ;;
esac

# Keep the build machine's paths out of panic messages in the Rust host, the
# same way the macOS packaging does.
export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$ROOT=/vela --remap-path-prefix=$HOME=/home/user"

# shellcheck disable=SC2086
xcodebuild \
  -project "$ROOT/ios/app/Vela.xcodeproj" \
  -scheme Vela \
  -configuration "$CONFIGURATION" \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  $SIGNING $ARCH_FLAG \
  build

APP="$DERIVED/Build/Products/$CONFIGURATION-$PLATFORM/Vela.app"
if [ ! -d "$APP" ]; then
  echo "built, but $APP is missing" >&2
  exit 1
fi
echo "App: $APP"
