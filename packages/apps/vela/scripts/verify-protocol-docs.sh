#!/bin/sh
# Verifies that the protocol document's examples are valid JSON and that the
# real helper accepts the request examples. The document may be formatted at
# any line width, so blocks are compacted with jq instead of being read line by
# line.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
mkdir -p "$ROOT/.tmp/runtime"
TMP=$(mktemp -d "$ROOT/.tmp/runtime/protocol-docs.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

awk '
  /^```json$/ { json = 1; next }
  /^```$/ { json = 0; next }
  json { print }
' "$ROOT/docs/protocol.md" | jq -c . > "$TMP/examples.jsonl"

test -s "$TMP/examples.jsonl" || { echo "protocol.md has no JSON examples" >&2; exit 1; }

jq -c 'select(.type == "status.get")' "$TMP/examples.jsonl" | head -n 1 > "$TMP/input.jsonl"
jq -c 'select(.type == "events.subscribe")' "$TMP/examples.jsonl" | head -n 1 >> "$TMP/input.jsonl"
jq -c 'select(.type == "shutdown")' "$TMP/examples.jsonl" | head -n 1 >> "$TMP/input.jsonl"

go build -C "$ROOT/core" -o "$TMP/vela-core" ./cmd/vela-core
"$TMP/vela-core" < "$TMP/input.jsonl" > "$TMP/output.jsonl" 2> "$TMP/stderr.log"

test "$(wc -l < "$TMP/output.jsonl" | tr -d ' ')" = "3"
jq -e 'select(.type == "status" and .id == "status-1")' "$TMP/output.jsonl" >/dev/null
jq -e 'select(.type == "events.subscribed" and .id == "events-1")' "$TMP/output.jsonl" >/dev/null
jq -e 'select(.type == "stopped")' "$TMP/output.jsonl" >/dev/null

echo "Vela protocol documentation examples passed"
