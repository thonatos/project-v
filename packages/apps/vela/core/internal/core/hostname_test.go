package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestHostnameRuleMatchesSharedFixture reads the same cases the TypeScript
// form checks, so a rejected name is rejected identically on both sides.
func TestHostnameRuleMatchesSharedFixture(t *testing.T) {
	t.Parallel()
	path := filepath.Join("..", "..", "..", "shared", "protocol", "fixtures", "hostname-validation.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Valid   []string `json:"valid"`
		Invalid []string `json:"invalid"`
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Valid) == 0 || len(fixture.Invalid) == 0 {
		t.Fatal("fixture must list both valid and invalid names")
	}
	for _, name := range fixture.Valid {
		if !ValidHostname(name) {
			t.Fatalf("ValidHostname(%q) = false, want true", name)
		}
	}
	for _, name := range fixture.Invalid {
		if ValidHostname(name) {
			t.Fatalf("ValidHostname(%q) = true, want false", name)
		}
	}
}
