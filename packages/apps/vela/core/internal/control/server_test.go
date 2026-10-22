package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"testing"

	"github.com/thonatos/project-v/vela/core/internal/protocol"
)

func TestControlLoopKeepsLogsOffStdout(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"status-1","type":"status.get","payload":{}}`,
		`{"version":1,"id":"events-1","type":"events.subscribe","payload":{}}`,
		`{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`,
	}, "\n"))
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	server := Server{In: input, Out: &stdout, Logger: log.New(&stderr, "", 0)}

	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	if len(lines) != 3 {
		t.Fatalf("stdout lines = %d, want 3: %q", len(lines), stdout.String())
	}
	for _, line := range lines {
		if _, err := protocol.DecodeLine([]byte(line)); err != nil {
			t.Fatalf("stdout contains non-protocol line %q: %v", line, err)
		}
	}
	if strings.Contains(stdout.String(), "control loop") {
		t.Fatalf("stdout contains log output: %q", stdout.String())
	}
	if !strings.Contains(stderr.String(), "control loop started") || !strings.Contains(stderr.String(), "control loop stopped") {
		t.Fatalf("stderr missing lifecycle logs: %q", stderr.String())
	}
}

func TestInvalidMessageDoesNotStopLoop(t *testing.T) {
	t.Parallel()
	input := strings.NewReader("not-json\n" + `{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`)
	var stdout bytes.Buffer
	if err := (Server{In: input, Out: &stdout}).Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("stdout lines = %d, want 2", len(lines))
	}
	first, err := protocol.DecodeLine([]byte(lines[0]))
	if err != nil || first.Kind != "error" {
		t.Fatalf("first response = %#v, %v", first, err)
	}
	last, err := protocol.DecodeLine([]byte(lines[1]))
	if err != nil || last.Kind != "stopped" {
		t.Fatalf("last response = %#v, %v", last, err)
	}
}

func TestMappingCommandsReturnURLAndErrors(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"map-1","type":"mapping.open","payload":{"device":"home","service":"opencode"}}`,
		`{"version":1,"id":"map-2","type":"mapping.open","payload":{"device":"home","service":"unknown"}}`,
		`{"version":1,"id":"map-3","type":"mapping.close","payload":{"device":"home","service":"opencode"}}`,
		`{"version":1,"id":"stop","type":"shutdown","payload":{}}`,
	}, "\n"))
	var output bytes.Buffer
	closed := false
	server := Server{
		In: input, Out: &output,
		OpenMapping: func(_ context.Context, _, service string) (string, error) {
			if service != "opencode" {
				return "", errors.New("unknown service")
			}
			return "http://127.0.0.1:49152", nil
		},
		CloseMapping: func(_, _ string) error { closed = true; return nil },
	}
	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	first, _ := protocol.DecodeLine([]byte(lines[0]))
	second, _ := protocol.DecodeLine([]byte(lines[1]))
	if first.Kind != "mapping" || !strings.Contains(string(first.Payload), "http://127.0.0.1:49152") {
		t.Fatalf("first=%#v", first)
	}
	if second.Kind != "error" || !closed {
		t.Fatalf("second=%#v closed=%v", second, closed)
	}
}

func TestRemoteRefreshUsesLiveRefresher(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"refresh","type":"remote.refresh","payload":{}}`,
		`{"version":1,"id":"stop","type":"shutdown","payload":{}}`,
	}, "\n"))
	var output bytes.Buffer
	called := false
	server := Server{
		In: input, Out: &output,
		RemoteRefresh: func(context.Context) (any, error) {
			called = true
			return []map[string]any{{"privateName": "home.example.ts.net", "connection": "connected"}}, nil
		},
	}
	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	first, err := protocol.DecodeLine([]byte(strings.Split(strings.TrimSpace(output.String()), "\n")[0]))
	if err != nil || first.Kind != "remotes" || !called || !strings.Contains(string(first.Payload), `"connected"`) {
		t.Fatalf("first=%#v called=%v err=%v", first, called, err)
	}
}

func TestDeviceAndServiceCommandsUseCoreWriters(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"device","type":"device.update","payload":{"name":"Studio Mini"}}`,
		`{"version":1,"id":"service","type":"service.upsert","payload":{"name":"Docs","url":"http://127.0.0.1:3000"}}`,
		`{"version":1,"id":"remove","type":"service.remove","payload":{"id":"docs"}}`,
		`{"version":1,"id":"stop","type":"shutdown","payload":{}}`,
	}, "\n"))
	var output bytes.Buffer
	server := Server{
		In: input, Out: &output,
		DeviceUpdate:  func(_ context.Context, name string) (any, error) { return map[string]string{"deviceName": name}, nil },
		ServiceUpsert: func(raw json.RawMessage) (any, error) { return []string{string(raw)}, nil },
		ServiceRemove: func(id string) (any, error) { return []string{id}, nil },
	}
	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	for index, kind := range []string{"status", "services", "services", "stopped"} {
		message, err := protocol.DecodeLine([]byte(lines[index]))
		if err != nil || message.Kind != kind {
			t.Fatalf("line %d=%#v err=%v", index, message, err)
		}
	}
}

// "Re-check" must use the identity check, not start an interactive login, so a
// device removed in the admin console comes back as needs-auth instead of a
// fresh login URL.
func TestReconnectRechecksIdentityWithoutStartingLogin(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"r","type":"auth.reconnect","payload":{}}`,
		`{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`,
	}, "\n"))
	var stdout bytes.Buffer
	started := false
	server := Server{
		In:  input,
		Out: &stdout,
		AuthStart: func(context.Context) (any, error) {
			started = true
			return map[string]any{"authUrl": "https://login"}, nil
		},
		AuthReconnect: func(context.Context) (any, error) { return map[string]any{"state": "needs-auth"}, nil },
	}
	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if started {
		t.Fatal("a re-check must not start an interactive login")
	}
	first, err := protocol.DecodeLine([]byte(strings.Split(strings.TrimSpace(stdout.String()), "\n")[0]))
	if err != nil || first.Kind != "status" || !strings.Contains(string(first.Payload), "needs-auth") {
		t.Fatalf("re-check response = %#v err=%v", first, err)
	}
}

// Without a dedicated handler, auth.reconnect keeps its previous behaviour.
func TestReconnectFallsBackToAuthStart(t *testing.T) {
	t.Parallel()
	input := strings.NewReader(strings.Join([]string{
		`{"version":1,"id":"r","type":"auth.reconnect","payload":{}}`,
		`{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`,
	}, "\n"))
	var stdout bytes.Buffer
	server := Server{In: input, Out: &stdout, AuthStart: func(context.Context) (any, error) { return map[string]any{"authUrl": "https://login"}, nil }}
	if err := server.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	first, err := protocol.DecodeLine([]byte(strings.Split(strings.TrimSpace(stdout.String()), "\n")[0]))
	if err != nil || first.Kind != "auth.url" {
		t.Fatalf("fallback response = %#v err=%v", first, err)
	}
}
