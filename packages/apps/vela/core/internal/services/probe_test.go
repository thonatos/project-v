package services

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProbeClassifiesResponses(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		status int
		state  State
		reason string
	}{
		{name: "successful", status: http.StatusOK, state: StateAvailable, reason: "responding"},
		{name: "authentication-required", status: http.StatusUnauthorized, state: StateAvailable, reason: "responding"},
		{name: "server-error", status: http.StatusServiceUnavailable, state: StateUnavailable, reason: "server_error"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(test.status)
			}))
			defer server.Close()
			result := NewProber().Probe(context.Background(), Service{ID: "test", URL: server.URL, Timeout: time.Second})
			if result.State != test.state || result.Reason != test.reason || result.StatusCode != test.status {
				t.Fatalf("result = %#v", result)
			}
		})
	}
}

func TestProbeClassifiesRefusedAndTimeout(t *testing.T) {
	t.Parallel()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	listener.Close()
	refused := NewProber().Probe(context.Background(), Service{ID: "refused", URL: "http://" + address, Timeout: time.Second})
	if refused.Reason != "connection_refused" {
		t.Fatalf("refused = %#v", refused)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	timedOut := NewProber().Probe(context.Background(), Service{ID: "timeout", URL: server.URL, Timeout: 10 * time.Millisecond})
	if timedOut.Reason != "timeout" {
		t.Fatalf("timed out = %#v", timedOut)
	}
}

func TestProbeRejectsNonLoopbackAndWatchRefreshes(t *testing.T) {
	t.Parallel()
	prober := NewProber()
	invalid := prober.Probe(context.Background(), Service{ID: "invalid", URL: "https://example.com"})
	if invalid.Reason != "invalid_target" {
		t.Fatalf("invalid = %#v", invalid)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	results := make(chan Result, 3)
	go prober.Watch(ctx, Service{ID: "watch", URL: server.URL}, 5*time.Millisecond, results)
	<-results
	<-results
	cancel()
}

func TestValidateURLRejectsNonLoopbackTargets(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"https://127.0.0.1:3000", "http://192.168.1.2:3000", "http://example.com"} {
		if ValidateURL(value) == nil {
			t.Fatalf("accepted %q", value)
		}
	}
	if err := ValidateURL("http://127.0.0.1:3000/path"); err != nil {
		t.Fatal(err)
	}
}
