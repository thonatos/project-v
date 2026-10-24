#!/bin/sh
# Clang wrapper Go uses for its iOS cgo targets. Go invokes the wrapper for
# both the device and the simulator; IOS_SDK selects which SDK and therefore
# which Mach-O platform the archive records.
set -eu

SDK=${IOS_SDK:-iphoneos}
MIN=${IOS_MIN_VERSION:-17.0}
ARCH=${GOARCH:-arm64}

case "$SDK" in
  iphonesimulator)
    TARGET="${ARCH}-apple-ios${MIN}-simulator"
    ;;
  *)
    TARGET="${ARCH}-apple-ios${MIN}"
    ;;
esac

exec xcrun --sdk "$SDK" clang -target "$TARGET" "$@"
