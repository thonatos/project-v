package buildinfo

import "testing"

func TestName(t *testing.T) {
	if Name != "vela-core" {
		t.Fatalf("unexpected helper name %q", Name)
	}
}
