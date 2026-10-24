package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/protocol"
)

// runCore builds the helper and feeds it one JSON Lines session. HOME is
// redirected to a temp directory so the run never touches the developer's
// Application Support, network state or logs.
func runCore(t *testing.T, home string, lines ...string) (stdout, stderr string) {
	t.Helper()
	binary := filepath.Join(t.TempDir(), "vela-core")
	build := exec.Command("go", "build", "-o", binary, ".")
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, output)
	}

	command := exec.Command(binary)
	command.Stdin = strings.NewReader(strings.Join(lines, "\n") + "\n")
	var out bytes.Buffer
	var errs bytes.Buffer
	command.Stdout = &out
	command.Stderr = &errs
	env := make([]string, 0, len(os.Environ())+1)
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, "HOME=") {
			env = append(env, entry)
		}
	}
	command.Env = append(env, "HOME="+home)
	if err := command.Run(); err != nil {
		t.Fatalf("run: %v, stderr: %s", err, errs.String())
	}
	return out.String(), errs.String()
}

func TestProcessStdoutIsProtocolOnly(t *testing.T) {
	t.Parallel()
	stdout, stderr := runCore(t, t.TempDir(),
		`{"version":1,"id":"status-1","type":"status.get","payload":{}}`,
		`{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`,
	)

	scanner := bufio.NewScanner(strings.NewReader(stdout))
	count := 0
	for scanner.Scan() {
		count++
		if _, err := protocol.DecodeLine(scanner.Bytes()); err != nil {
			t.Fatalf("stdout line %d is not protocol: %q: %v", count, scanner.Text(), err)
		}
	}
	if count != 2 {
		t.Fatalf("stdout lines = %d, want 2; stdout=%q", count, stdout)
	}
	if !strings.Contains(stderr, "control loop started") {
		t.Fatalf("stderr missing startup log: %q", stderr)
	}
}

// TestProcessStatusPayloadAndMappingPolicy locks the macOS status contract and
// the current mapping policy: while iOS refreshes a missing manifest with
// bounded retries, macOS answers from configuration and reports the service as
// unpublished. Both halves must survive the Core merge unchanged.
func TestProcessStatusPayloadAndMappingPolicy(t *testing.T) {
	t.Parallel()
	home := t.TempDir()
	writeHomeConfig(t, home, "studio.example.ts.net")

	stdout, stderr := runCore(t, home,
		`{"version":1,"id":"status-1","type":"status.get","payload":{}}`,
		`{"version":1,"id":"map-1","type":"mapping.open","payload":{"device":"studio.example.ts.net","service":"dsh"}}`,
		`{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`,
	)

	responses := map[string]protocol.Message{}
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		message, err := protocol.DecodeLine(scanner.Bytes())
		if err != nil {
			t.Fatalf("decode %q: %v", scanner.Text(), err)
		}
		responses[message.ID] = message
	}
	if len(responses) != 3 {
		t.Fatalf("responses = %d, want 3; stdout=%q", len(responses), stdout)
	}

	var status map[string]any
	for _, message := range responses {
		if message.ID == "status-1" {
			if message.Kind != "status" {
				t.Fatalf("status response type = %q", message.Kind)
			}
			if err := json.Unmarshal(message.Payload, &status); err != nil {
				t.Fatal(err)
			}
		}
	}
	if status == nil {
		t.Fatalf("no status payload in %q", stdout)
	}
	assertKeys(t, "status", status, []string{
		"deviceName", "network", "preferences", "remotes", "services", "sharing", "tailnetDevices", "tailscale",
	})

	remotes := status["remotes"].([]any)
	if len(remotes) != 1 {
		t.Fatalf("remotes = %d, want 1", len(remotes))
	}
	remote := remotes[0].(map[string]any)
	assertKeys(t, "remote", remote, []string{
		"compatible", "connection", "ips", "issue", "lastConnectedUtc", "name", "privateName", "services",
	})
	if remote["privateName"] != "studio.example.ts.net" || remote["connection"] != "offline" || remote["issue"] != "offline" {
		t.Fatalf("unexpected remote snapshot: %#v", remote)
	}

	for _, message := range responses {
		if message.ID != "map-1" {
			continue
		}
		if message.Kind != "error" {
			t.Fatalf("mapping.open type = %q, want error; payload=%s", message.Kind, message.Payload)
		}
		var payload protocol.ErrorPayload
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Code != "mapping_failed" || !strings.Contains(payload.Message, "not currently published") {
			t.Fatalf("mapping.open = %+v, want mapping_failed/unpublished", payload)
		}
	}
	if strings.Contains(stderr, "refresh failed") {
		t.Fatalf("macOS must not refresh the manifest when the service was never published; stderr=%q", stderr)
	}
}

func assertKeys(t *testing.T, label string, value map[string]any, want []string) {
	t.Helper()
	got := make([]string, 0, len(value))
	for key := range value {
		got = append(got, key)
	}
	if len(got) != len(want) {
		t.Fatalf("%s keys = %v, want %v", label, got, want)
	}
	for _, key := range want {
		if _, ok := value[key]; !ok {
			t.Fatalf("%s keys = %v, want %v", label, got, want)
		}
	}
}

func writeHomeConfig(t *testing.T, home, privateName string) {
	t.Helper()
	config := velaconfig.Default()
	config.Remotes = []velaconfig.RemoteMac{{Name: "Studio", PrivateName: privateName}}
	body, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(home, "Library", "Application Support", "Vela", "config.json")
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, append(body, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
}
