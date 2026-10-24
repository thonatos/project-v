#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUT=${1:-"$ROOT/build/app"}
case "$OUT" in
  "$ROOT"/*) ;;
  *) echo "Vela build output must stay inside $ROOT" >&2; exit 2 ;;
esac
APP="$OUT/Vela.app"
CONTENTS="$APP/Contents"

rm -rf "$OUT"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Helpers" "$CONTENTS/Resources/nsh/assets"

sh "$ROOT/scripts/nsh.sh" build "$ROOT/ui/App.tsx" --release -o "$OUT/ui"
cargo build --manifest-path "$ROOT/Cargo.toml" --locked --release --package vela-host
go build -C "$ROOT/core" -trimpath -o "$CONTENTS/Helpers/vela-core" ./cmd/vela-core

cp "$ROOT/target/release/vela-host" "$CONTENTS/MacOS/Vela"
cp "$OUT/ui/bundle.nshc" "$CONTENTS/Resources/nsh/bundle.nshc"
test ! -d "$OUT/ui/assets" || cp -R "$OUT/ui/assets/." "$CONTENTS/Resources/nsh/assets/"

# Icon Composer icon: Assets.car carries the light, dark and tinted renditions
# macOS 26+ picks from; AppIcon.icns is the fallback for older systems.
xcrun actool "$ROOT/icon/AppIcon.icon" \
  --compile "$CONTENTS/Resources" \
  --platform macosx \
  --minimum-deployment-target 14.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$OUT/icon-partial.plist" \
  --output-format human-readable-text >/dev/null

cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
  <key>CFBundleDisplayName</key><string>Vela</string>
  <key>CFBundleExecutable</key><string>Vela</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleIconName</key><string>AppIcon</string>
  <key>CFBundleIdentifier</key><string>io.implements.vela.macos</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Vela</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

chmod 755 "$CONTENTS/MacOS/Vela" "$CONTENTS/Helpers/vela-core"
codesign --force --sign - "$CONTENTS/Helpers/vela-core"
codesign --force --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
echo "$APP"
