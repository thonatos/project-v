#!/bin/sh
# 在隔离用户目录中执行有界的 Vela 窗口生命周期 smoke。
set -eu

APP=${1:-}
TIMEOUT_SECONDS=${VELA_SMOKE_TIMEOUT_SECONDS:-15}

fail() {
  echo "macos-smoke-app: $*" >&2
  exit 1
}

test -n "$APP" || fail "usage: $0 APP"
test -f "$APP/Contents/Info.plist" || fail "invalid App bundle: $APP"
EXECUTABLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist" 2>/dev/null) || fail "missing CFBundleExecutable"
PROGRAM="$APP/Contents/MacOS/$EXECUTABLE"
test -x "$PROGRAM" || fail "main executable is missing or not executable"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
VELA_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
REPO_ROOT=$(CDPATH= cd -- "$VELA_ROOT/../../.." && pwd)
TMP_ROOT=${VELA_SMOKE_TMP_ROOT:-"$VELA_ROOT/.tmp"}
DIAGNOSTICS=${VELA_SMOKE_DIAGNOSTICS:-"$VELA_ROOT/.tmp/release/macos-lifecycle-smoke.log"}
mkdir -p "$TMP_ROOT"
WORK=$(mktemp -d "$TMP_ROOT/macos-lifecycle.XXXXXX")
HOME_DIR="$WORK/home"
TEMP_DIR="$WORK/tmp"
RAW_LOG="$WORK/raw.log"
SANITIZED_LOG="$WORK/diagnostics.log"
mkdir -p "$HOME_DIR" "$TEMP_DIR"
PID=

cleanup() {
  if test -n "$PID" && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT HUP INT TERM

sanitize() {
  sed \
    -e "s|$HOME_DIR|<isolated-home>|g" \
    -e "s|$TEMP_DIR|<isolated-tmp>|g" \
    -e "s|$REPO_ROOT|<repo>|g" \
    -e 's|https://[^[:space:]]*|<redacted-url>|g' \
    -e 's|http://[^[:space:]]*|<redacted-url>|g' \
    -e 's/\(authkey\|token\|secret\)[=:][^[:space:]]*/\1=<redacted>/g' \
    "$RAW_LOG" | tail -n 80 >"$SANITIZED_LOG"
}

preserve_diagnostics() {
  sanitize
  mkdir -p "$(dirname "$DIAGNOSTICS")"
  cp "$SANITIZED_LOG" "$DIAGNOSTICS"
}

HOME="$HOME_DIR" \
TMPDIR="$TEMP_DIR" \
VELA_LIFECYCLE_SCRIPT=close,reopen,quit \
  "$PROGRAM" >"$RAW_LOG" 2>&1 &
PID=$!

ELAPSED=0
while kill -0 "$PID" 2>/dev/null; do
  if test "$ELAPSED" -ge "$TIMEOUT_SECONDS"; then
    preserve_diagnostics
    echo "macos-smoke-app: timed out after ${TIMEOUT_SECONDS}s" >&2
    cat "$DIAGNOSTICS" >&2
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

STATUS=0
wait "$PID" || STATUS=$?
PID=
if test "$STATUS" -ne 0; then
  preserve_diagnostics
  echo "macos-smoke-app: App exited with status $STATUS" >&2
  cat "$DIAGNOSTICS" >&2
  exit 1
fi

for ACTION in close reopen quit; do
  grep -q "VELA_SMOKE .*action=$ACTION" "$RAW_LOG" || {
    preserve_diagnostics
    echo "macos-smoke-app: missing lifecycle action: $ACTION" >&2
    cat "$DIAGNOSTICS" >&2
    exit 1
  }
done
grep -q '^VELA_LIFECYCLE terminated core=None$' "$RAW_LOG" || {
  preserve_diagnostics
  fail "formal quit left the Core helper observable"
}

CORE_IDENTITIES=$(sed -n 's/^.*VELA_SMOKE core=Some((\([0-9][0-9]*, [0-9][0-9]*\))).*$/\1/p' "$RAW_LOG")
test "$(printf '%s\n' "$CORE_IDENTITIES" | sed '/^$/d' | wc -l | tr -d ' ')" -eq 2 || {
  preserve_diagnostics
  echo "macos-smoke-app: Core did not remain observable through close/reopen" >&2
  cat "$DIAGNOSTICS" >&2
  exit 1
}
test "$(printf '%s\n' "$CORE_IDENTITIES" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')" -eq 1 || {
  preserve_diagnostics
  echo "macos-smoke-app: Core process changed during close/reopen" >&2
  cat "$DIAGNOSTICS" >&2
  exit 1
}

UPDATE_LOG="$WORK/update.log"
HOME="$HOME_DIR" TMPDIR="$TEMP_DIR" VELA_UPDATE_SMOKE=1 "$PROGRAM" >"$UPDATE_LOG" 2>&1 &
PID=$!
ELAPSED=0
while kill -0 "$PID" 2>/dev/null; do
  if test "$ELAPSED" -ge "$TIMEOUT_SECONDS"; then
    cp "$UPDATE_LOG" "$RAW_LOG"
    preserve_diagnostics
    fail "update menu smoke timed out"
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
wait "$PID" || fail "update menu smoke failed"
PID=
if test "$(grep -c '^VELA_UPDATE_SMOKE check=1$' "$UPDATE_LOG")" -ne 1; then
  cp "$UPDATE_LOG" "$RAW_LOG"
  preserve_diagnostics
  fail "update menu did not invoke exactly one native check"
fi
if ! grep -q '^VELA_UPDATE_SMOKE menu=selected$' "$UPDATE_LOG"; then
  cp "$UPDATE_LOG" "$RAW_LOG"
  preserve_diagnostics
  fail "update menu item was not selected through AppKit"
fi

echo "macos-smoke-app: Core start, close/reopen and graceful quit passed"
