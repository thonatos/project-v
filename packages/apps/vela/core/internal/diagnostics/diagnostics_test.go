package diagnostics

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRedactsSensitiveFixture(t *testing.T) {
	t.Parallel()
	contents, err := os.ReadFile(filepath.Join("..", "..", "..", "shared", "protocol", "fixtures", "sensitive-diagnostics.txt"))
	if err != nil {
		t.Fatal(err)
	}
	redacted := Redact(string(contents))
	for _, forbidden := range []string{
		"tskey-auth-super-secret",
		"Bearer private-token",
		"vela_session=secret-cookie",
		"login.tailscale.com/a/secret-login",
		"token=private-query-token",
	} {
		if strings.Contains(redacted, forbidden) {
			t.Fatalf("redacted output contains %q:\n%s", forbidden, redacted)
		}
	}
	if strings.Count(redacted, "[REDACTED]") < 5 {
		t.Fatalf("expected redaction markers:\n%s", redacted)
	}
}

func TestSnapshotCannotCarryBusinessContent(t *testing.T) {
	t.Parallel()
	encoded, err := Marshal(Snapshot{
		Version:      "0.1.0",
		NetworkState: "connected",
		Services: map[string]string{
			"opencode": "available",
			"dsh":      "unavailable",
		},
		LastError: "Authorization: Bearer private-token",
	})
	if err != nil {
		t.Fatal(err)
	}
	text := string(encoded)
	for _, forbiddenField := range []string{`"prompt"`, `"fileContent"`, `"requestBody"`, "private-token"} {
		if strings.Contains(text, forbiddenField) {
			t.Fatalf("snapshot contains forbidden content %q: %s", forbiddenField, text)
		}
	}
}
