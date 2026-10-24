package protocol

import (
	"bufio"
	"os"
	"path/filepath"
	"testing"
)

func fixturePath(name string) string {
	return filepath.Join("..", "..", "..", "shared", "protocol", "fixtures", name)
}

func TestValidFixturesRoundTrip(t *testing.T) {
	t.Parallel()
	file, err := os.Open(fixturePath("valid-v1.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		message, err := DecodeLine(scanner.Bytes())
		if err != nil {
			t.Fatalf("DecodeLine() error = %v", err)
		}
		encoded, err := EncodeLine(message)
		if err != nil {
			t.Fatalf("EncodeLine() error = %v", err)
		}
		if _, err := DecodeLine(encoded); err != nil {
			t.Fatalf("round trip error = %v", err)
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
}

func TestInvalidFixtures(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		code string
	}{
		{name: "invalid-version.jsonl", code: "unsupported_version"},
		{name: "invalid-type.jsonl", code: "unsupported_message"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			contents, err := os.ReadFile(fixturePath(test.name))
			if err != nil {
				t.Fatal(err)
			}
			_, err = DecodeLine(contents)
			if !IsCode(err, test.code) {
				t.Fatalf("error = %v, want code %q", err, test.code)
			}
		})
	}
}

func TestDiagnosticsAndPreferencesAreSupported(t *testing.T) {
	t.Parallel()
	for _, kind := range []string{"preferences.update", "preferences", "diagnostics.logs", "diagnostics.activity"} {
		if err := Validate(Message{Version: Version, ID: "req-1", Kind: kind}); err != nil {
			t.Fatalf("%s must be part of the control vocabulary: %v", kind, err)
		}
	}
}

func TestRequestRequiresID(t *testing.T) {
	t.Parallel()
	_, err := DecodeLine([]byte(`{"version":1,"type":"status.get","payload":{}}`))
	if !IsCode(err, "missing_id") {
		t.Fatalf("error = %v, want missing_id", err)
	}
}
