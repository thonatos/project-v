package diagnostics

import (
	"sync"
	"time"
)

// Entry is one redacted operational event safe to show in the UI.
type Entry struct {
	AtUTC   string `json:"atUtc"`
	Level   string `json:"level"`
	Area    string `json:"area"`
	Message string `json:"message"`
}

// Journal keeps a bounded, redacted history of operational events. It never
// stores request bodies, credentials or authentication URLs.
type Journal struct {
	mu      sync.Mutex
	entries []Entry
	limit   int
	now     func() time.Time
}

// NewJournal creates a journal that keeps at most limit entries.
func NewJournal(limit int) *Journal {
	if limit <= 0 {
		limit = 200
	}
	return &Journal{entries: make([]Entry, 0, limit), limit: limit, now: time.Now}
}

// Record appends one redacted event, dropping the oldest entry when full.
func (journal *Journal) Record(level, area, message string) {
	entry := Entry{
		AtUTC:   journal.now().UTC().Format(time.RFC3339),
		Level:   level,
		Area:    area,
		Message: Redact(message),
	}
	journal.mu.Lock()
	defer journal.mu.Unlock()
	if len(journal.entries) == journal.limit {
		journal.entries = append(journal.entries[:0], journal.entries[1:]...)
	}
	journal.entries = append(journal.entries, entry)
}

// Entries returns a detached copy, newest last.
func (journal *Journal) Entries() []Entry {
	journal.mu.Lock()
	defer journal.mu.Unlock()
	entries := make([]Entry, len(journal.entries))
	copy(entries, journal.entries)
	return entries
}
