#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
mkdir -p "$ROOT/.tmp/runtime"
TMP=$(mktemp -d "$ROOT/.tmp/runtime/protocol-docs.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

awk '
  /^```json$/ { json = 1; next }
  /^```$/ { json = 0; next }
  json && /^\{/ { print }
' "$ROOT/docs/control-protocol.md" > "$TMP/examples.jsonl"

while IFS= read -r line; do
  printf '%s' "$line" | jq -e . >/dev/null
done < "$TMP/examples.jsonl"

awk '!seen[$0]++ && /"type":"status.get"/' "$TMP/examples.jsonl" > "$TMP/input.jsonl"
awk '!seen[$0]++ && /"type":"events.subscribe"/' "$TMP/examples.jsonl" >> "$TMP/input.jsonl"
awk '!seen[$0]++ && /"type":"shutdown"/' "$TMP/examples.jsonl" >> "$TMP/input.jsonl"

go build -C "$ROOT/core" -o "$TMP/vela-core" ./cmd/vela-core
"$TMP/vela-core" < "$TMP/input.jsonl" > "$TMP/output.jsonl" 2> "$TMP/stderr.log"

test "$(wc -l < "$TMP/output.jsonl" | tr -d ' ')" = "3"
jq -e 'select(.type == "status" and .id == "status-1")' "$TMP/output.jsonl" >/dev/null
jq -e 'select(.type == "events.subscribed" and .id == "events-1")' "$TMP/output.jsonl" >/dev/null
jq -e 'select(.type == "stopped")' "$TMP/output.jsonl" >/dev/null

echo "Vela protocol documentation examples passed"
