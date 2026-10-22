package adapters

import (
	"bufio"
	"strings"
	"testing"
)

func TestOpenCodeIsTransparent(t *testing.T) {
	t.Parallel()
	request := "GET /auth/connect/code HTTP/1.1\r\nHost: 127.0.0.1:50001\r\nCookie: session=keep-me\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
	output, err := RewriteHeaderBlock(OpenCode, bufio.NewReader(strings.NewReader(request)))
	if err != nil {
		t.Fatal(err)
	}
	text := string(output)
	for _, expected := range []string{"/auth/connect/code", "Host: 127.0.0.1:50001", "Cookie: session=keep-me", "Upgrade: websocket"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("transparent header missing %q:\n%s", expected, text)
		}
	}
}

func TestDSHNormalizesLoopbackSameOriginAndPreservesAuth(t *testing.T) {
	t.Parallel()
	request := "GET /api HTTP/1.1\r\nHost: 127.0.0.1:50002\r\nOrigin: http://127.0.0.1:50002\r\nCookie: dsh=keep-me\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
	output, err := RewriteHeaderBlock(DSH, bufio.NewReader(strings.NewReader(request)))
	if err != nil {
		t.Fatal(err)
	}
	text := string(output)
	for _, expected := range []string{"Host: 127.0.0.1:3080", "Origin: http://127.0.0.1:3080", "Cookie: dsh=keep-me", "Upgrade: websocket"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("DSH header missing %q:\n%s", expected, text)
		}
	}
}

func TestDSHRejectsRemoteAuthorityAndUnknownTarget(t *testing.T) {
	t.Parallel()
	remote := "GET / HTTP/1.1\r\nHost: attacker.example\r\n\r\n"
	if _, err := RewriteHeaderBlock(DSH, bufio.NewReader(strings.NewReader(remote))); err == nil {
		t.Fatal("expected remote DSH authority to fail")
	}
	if _, err := ParseService("http://127.0.0.1:9000"); err == nil {
		t.Fatal("expected arbitrary target to fail")
	}
}
