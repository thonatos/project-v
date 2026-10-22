package diagnostics

import (
	"strings"
	"testing"
	"time"
)

func TestJournalRedactsAndDropsOldestEntries(t *testing.T) {
	t.Parallel()
	journal := NewJournal(2)
	journal.now = func() time.Time { return time.Unix(0, 0).UTC() }

	journal.Record("info", "mapping", "opened http://127.0.0.1:3080/?token=secret-value")
	journal.Record("error", "auth", "Cookie: session=abc123")
	journal.Record("error", "proxy", "dial failed for opencode")

	entries := journal.Entries()
	if len(entries) != 2 {
		t.Fatalf("journal must stay bounded: %#v", entries)
	}
	if entries[0].Area != "auth" || entries[1].Area != "proxy" {
		t.Fatalf("journal must drop the oldest entry first: %#v", entries)
	}
	for _, entry := range entries {
		if strings.Contains(entry.Message, "secret-value") || strings.Contains(entry.Message, "abc123") {
			t.Fatalf("journal must redact credentials: %q", entry.Message)
		}
	}
	if entries[0].AtUTC != "1970-01-01T00:00:00Z" {
		t.Fatalf("journal must stamp entries in UTC: %q", entries[0].AtUTC)
	}
}

func TestJournalKeepsActionableFailureReasons(t *testing.T) {
	t.Parallel()
	journal := NewJournal(4)
	journal.Record("error", "proxy", "dial 127.0.0.1:4096: connection refused")

	entries := journal.Entries()
	if len(entries) != 1 || !strings.Contains(entries[0].Message, "connection refused") {
		t.Fatalf("journal must keep diagnosable error reasons: %#v", entries)
	}
}
