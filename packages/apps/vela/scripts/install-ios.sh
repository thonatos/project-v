#!/bin/sh
# Installs a signed Vela.app on a connected iPhone without deleting the app,
# so its container (tsnet identity and WKWebsiteDataStore cookies) survives.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP=${1:-${APP:-"$ROOT/.tmp/ios-derived/Build/Products/Release-iphoneos/Vela.app"}}
DEVICE=${DEVICE_UDID:-}

if [ ! -d "$APP" ]; then
  echo "error: $APP not found; run scripts/build-ios.sh first" >&2
  exit 1
fi

if [ -z "$DEVICE" ]; then
  echo "error: set DEVICE_UDID (xcrun devicectl list devices)" >&2
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE" "$APP"
echo "installed $APP"
