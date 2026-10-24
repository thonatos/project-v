#!/bin/sh
# Builds the Go Core once for the device and once for the arm64 simulator and
# packages both slices as an XCFramework. Both slices are arm64, so lipo cannot
# merge them into one fat archive; XCFramework is the correct container.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUT=${1:-"$ROOT/build/ios"}
case "$OUT" in
  /*) ;;
  *) OUT="$ROOT/$OUT" ;;
esac
CC="$ROOT/scripts/ios-clang.sh"

rm -rf "$OUT"
mkdir -p "$OUT/device" "$OUT/simulator"

export CGO_ENABLED=1
export GOOS=ios
export GOARCH=arm64
export CC

echo "building Go Core for iOS device (arm64)"
# The platform marker changes Go's build-cache key: without it the simulator
# build would reuse the device objects (identical command line, different
# clang target).
IOS_SDK=iphoneos CGO_CFLAGS="-O2 -g -DVELA_IOS_DEVICE=1" \
  go build -C "$ROOT/core" -buildmode=c-archive -o "$OUT/device/libvela-core.a" ./cmd/vela-mobile

echo "building Go Core for iOS simulator (arm64)"
IOS_SDK=iphonesimulator CGO_CFLAGS="-O2 -g -DVELA_IOS_SIMULATOR=1" \
  go build -C "$ROOT/core" -buildmode=c-archive -o "$OUT/simulator/libvela-core.a" ./cmd/vela-mobile

lipo -info "$OUT/device/libvela-core.a"
lipo -info "$OUT/simulator/libvela-core.a"

rm -rf "$OUT/VelaCore.xcframework"
xcodebuild -create-xcframework \
  -library "$OUT/device/libvela-core.a" -headers "$OUT/device" \
  -library "$OUT/simulator/libvela-core.a" -headers "$OUT/simulator" \
  -output "$OUT/VelaCore.xcframework" >/dev/null

echo "VelaCore.xcframework:"
find "$OUT/VelaCore.xcframework" -maxdepth 2 -type d | sed "s|$OUT/||"
