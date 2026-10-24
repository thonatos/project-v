package services

import "testing"

func TestTargetKeyFoldsLoopbackNames(t *testing.T) {
	cases := []struct {
		protocol string
		target   string
		want     string
	}{
		{ProtocolHTTP, "http://127.0.0.1:49374/api/info", "127.0.0.1:49374"},
		{ProtocolHTTP, "http://localhost:3080/", "127.0.0.1:3080"},
		{ProtocolHTTP, "http://127.0.0.1/path", "127.0.0.1:80"},
		{ProtocolHTTP, "http://[::1]:8188/", "[::1]:8188"},
		{ProtocolTCP, "tcp://127.0.0.1:6379", "127.0.0.1:6379"},
		{ProtocolTCP, "tcp://localhost:5432", "127.0.0.1:5432"},
	}
	for _, test := range cases {
		key, err := TargetKey(test.protocol, test.target)
		if err != nil {
			t.Fatalf("TargetKey(%q, %q): %v", test.protocol, test.target, err)
		}
		if key != test.want {
			t.Errorf("TargetKey(%q, %q) = %q, want %q", test.protocol, test.target, key, test.want)
		}
	}
}

func TestTargetKeyRejectsNonLoopback(t *testing.T) {
	for _, test := range []struct{ protocol, target string }{
		{ProtocolHTTP, "http://192.168.1.5:3080/"},
		{ProtocolHTTP, "https://127.0.0.1:3080/"},
		{ProtocolTCP, "tcp://10.0.0.1:6379"},
	} {
		if _, err := TargetKey(test.protocol, test.target); err == nil {
			t.Errorf("TargetKey(%q, %q) accepted a non-loopback target", test.protocol, test.target)
		}
	}
}
