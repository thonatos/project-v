package core

import (
	"strings"
	"testing"

	velanetwork "implements.io/vela/internal/network"
)

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

func TestAvatarURLRequiresOptionPreferenceAndEmail(t *testing.T) {
	t.Parallel()
	self := velanetwork.DeviceInfo{User: "Owner@Example.COM"}
	url := avatarURL(self, true)
	if !strings.HasPrefix(url, "https://gravatar.com/avatar/") || !strings.HasSuffix(url, "?s=128&d=404") {
		t.Fatalf("avatarURL = %q, want a Gravatar link", url)
	}
	if got := avatarURL(self, false); got != "" {
		t.Fatalf("avatarURL with the preference off = %q, want empty", got)
	}
	for _, value := range []any{
		velanetwork.DeviceInfo{User: "owner"},
		map[string]any{"name": "Vela"},
		nil,
	} {
		if got := avatarURL(value, true); got != "" {
			t.Fatalf("avatarURL(%#v) = %q, want empty", value, got)
		}
	}
}
