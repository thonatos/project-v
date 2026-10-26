package core

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	velanetwork "implements.io/vela/internal/network"
)

type avatarRoundTrip func(*http.Request) (*http.Response, error)

func (roundTrip avatarRoundTrip) Do(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

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

func TestDownloadAvatarReturnsImageDataURL(t *testing.T) {
	t.Parallel()
	client := avatarRoundTrip(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", request.Method)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"image/jpeg"}},
			Body:       io.NopCloser(strings.NewReader("image")),
		}, nil
	})
	source, err := downloadAvatar(context.Background(), client, "https://gravatar.com/avatar/test")
	if err != nil {
		t.Fatal(err)
	}
	if source != "data:image/jpeg;base64,aW1hZ2U=" {
		t.Fatalf("source = %q", source)
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
