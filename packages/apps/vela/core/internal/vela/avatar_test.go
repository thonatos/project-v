package vela

import "testing"

func TestNormalizedEmail(t *testing.T) {
	t.Parallel()
	for input, want := range map[string]string{
		" Owner@Example.COM ": "owner@example.com",
		"owner":               "",
		"@example.com":        "",
		"owner@":              "",
		"a@b@c":               "",
	} {
		if got := normalizedEmail(input); got != want {
			t.Errorf("normalizedEmail(%q) = %q, want %q", input, got, want)
		}
	}
}
