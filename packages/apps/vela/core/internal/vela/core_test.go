package vela

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/manifest"
	velapaths "github.com/thonatos/vela/core/internal/paths"
	"github.com/thonatos/vela/core/internal/remoteclient"
	"github.com/thonatos/vela/core/internal/remotes"
	"tailscale.com/client/local"
)

type fakeNode struct {
	dial func(context.Context, string, string) (net.Conn, error)
}

func (node fakeNode) Dial(ctx context.Context, network, address string) (net.Conn, error) {
	if node.dial == nil {
		return nil, errors.New("no dialer")
	}
	return node.dial(ctx, network, address)
}

func (fakeNode) LocalClient() (*local.Client, error) {
	return nil, errors.New("no local API in tests")
}

func (fakeNode) Close() error { return nil }

type fakeChecker struct {
	mu      sync.Mutex
	states  map[string]remotes.ManifestState
	scripts map[string][]fakeCheck
	checks  map[string]int
}

type fakeCheck struct {
	document manifest.Document
	err      error
}

func newFakeChecker() *fakeChecker {
	return &fakeChecker{states: map[string]remotes.ManifestState{}, scripts: map[string][]fakeCheck{}, checks: map[string]int{}}
}

func (checker *fakeChecker) publish(privateName string, services ...manifest.Service) {
	checker.mu.Lock()
	defer checker.mu.Unlock()
	checker.states[privateName] = remotes.ManifestState{
		Checked: true,
		Entry:   remoteclient.Entry{Document: manifest.Document{Version: manifest.Version, Device: "Remote", Services: services}},
	}
}

func (checker *fakeChecker) Check(_ context.Context, privateName string) (remotes.CheckResult, error) {
	checker.mu.Lock()
	defer checker.mu.Unlock()
	checker.checks[privateName]++
	script := checker.scripts[privateName]
	if len(script) > 0 {
		next := script[0]
		if len(script) > 1 {
			checker.scripts[privateName] = script[1:]
		}
		state := remotes.ManifestState{Checked: true, Entry: remoteclient.Entry{Document: next.document}, Err: next.err}
		checker.states[privateName] = state
		if next.err != nil {
			return remotes.CheckResult{}, next.err
		}
		return remotes.CheckResult{DeviceName: next.document.Device, ProtocolVersion: next.document.Version}, nil
	}
	state := checker.states[privateName]
	if state.Err != nil {
		return remotes.CheckResult{}, state.Err
	}
	return remotes.CheckResult{DeviceName: state.Entry.Document.Device, ProtocolVersion: state.Entry.Document.Version}, nil
}

func (checker *fakeChecker) State(privateName string) (remotes.ManifestState, bool) {
	checker.mu.Lock()
	defer checker.mu.Unlock()
	state, ok := checker.states[privateName]
	return state, ok
}

func (checker *fakeChecker) checkCount(privateName string) int {
	checker.mu.Lock()
	defer checker.mu.Unlock()
	return checker.checks[privateName]
}

func attempts(count int) *int { return &count }

func newTestCore(t *testing.T, node Node, checker ManifestChecker) *Core {
	t.Helper()
	paths := velapaths.FromApplicationSupport(t.TempDir())
	core, err := New(Options{
		Paths:         paths,
		Node:          node,
		Checker:       checker,
		RetryDelay:    time.Millisecond,
		RetryAttempts: attempts(3),
		// The iOS policy: every mapping binds 127.0.0.1. The macOS default
		// (per-service hostnames) is covered by the mappings package.
		Address: "127.0.0.1",
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = core.Close() })
	return core
}

func TestStatusDistinguishesOnlineOfflineAndIncompatible(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	published := manifest.Service{ID: "opencode", Name: "OpenCode", Protocol: manifest.ProtocolHTTP, Port: 47845, Available: true}
	checker.publish("studio.example.ts.net", published)
	checker.states["mini.example.ts.net"] = remotes.ManifestState{Checked: true, Err: remotes.ErrOffline}
	checker.states["old.example.ts.net"] = remotes.ManifestState{Checked: true, Err: remotes.ErrIncompatibleProtocol}

	paths := velapaths.FromApplicationSupport(t.TempDir())
	writeRemotes(t, paths.Config, "studio.example.ts.net", "mini.example.ts.net", "old.example.ts.net")
	core, err := New(Options{Paths: paths, Node: fakeNode{}, Checker: checker, RetryDelay: time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = core.Close() })

	payload, err := core.Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	snapshot := payload.(map[string]any)["remotes"].([]RemoteSnapshot)
	if len(snapshot) != 3 {
		t.Fatalf("remotes = %#v", snapshot)
	}
	byName := map[string]RemoteSnapshot{}
	for _, item := range snapshot {
		byName[item.PrivateName] = item
	}
	if byName["studio.example.ts.net"].Connection != "connected" || byName["studio.example.ts.net"].Issue != "" {
		t.Fatalf("online remote = %#v", byName["studio.example.ts.net"])
	}
	if byName["mini.example.ts.net"].Connection != "offline" || byName["mini.example.ts.net"].Issue != "offline" {
		t.Fatalf("offline remote = %#v", byName["mini.example.ts.net"])
	}
	if byName["old.example.ts.net"].Compatible || byName["old.example.ts.net"].Issue != "incompatible" {
		t.Fatalf("incompatible remote = %#v", byName["old.example.ts.net"])
	}
}

func TestSuspendClosesListenerAndResumeUsesSamePort(t *testing.T) {
	t.Parallel()
	echo := echoServer(t)
	checker := newFakeChecker()
	checker.publish("studio.example.ts.net", manifest.Service{ID: "opencode", Name: "OpenCode", Protocol: manifest.ProtocolHTTP, Port: 47845, Available: true})
	node := fakeNode{dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp", echo)
	}}
	core := newTestCore(t, node, checker)

	url, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "opencode")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(url, "http://127.0.0.1:") {
		t.Fatalf("iOS mapping URL must use loopback, got %q", url)
	}
	address := strings.TrimPrefix(url, "http://")
	dialEcho(t, address)

	if err := core.Suspend(); err != nil {
		t.Fatal(err)
	}
	if core.session.Suspended() == false {
		t.Fatal("session did not suspend")
	}
	if connection, err := net.DialTimeout("tcp", address, 200*time.Millisecond); err == nil {
		connection.Close()
		t.Fatal("listener still accepts connections while suspended")
	}

	if err := core.Resume(context.Background()); err != nil {
		t.Fatal(err)
	}
	resumed, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "opencode")
	if err != nil {
		t.Fatal(err)
	}
	if resumed != url {
		t.Fatalf("resume moved the mapping: %q -> %q", url, resumed)
	}
	if core.session.Suspended() {
		t.Fatal("session stayed suspended")
	}
	dialEcho(t, address)
}

func TestOpenMappingRetriesUntilRemoteRecovers(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	checker.scripts["studio.example.ts.net"] = []fakeCheck{
		{err: remotes.ErrOffline},
		{err: remotes.ErrOffline},
		{document: manifest.Document{Version: manifest.Version, Device: "Studio", Services: []manifest.Service{{ID: "dsh", Name: "DSH", Protocol: manifest.ProtocolHTTP, Port: 47846, Available: true}}}},
	}
	core := newTestCore(t, fakeNode{}, checker)
	if _, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "dsh"); err != nil {
		t.Fatal(err)
	}
	if checks := checker.checkCount("studio.example.ts.net"); checks != 3 {
		t.Fatalf("checks = %d, want 3 automatic attempts", checks)
	}
}

func TestDSHMappingFetchesTheCurrentLaunchPath(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	stale := manifest.Service{ID: "dsh", Name: "DSH", Protocol: manifest.ProtocolHTTP, Port: 47846, Path: "/?token=old", Adapter: "dsh", Available: true}
	checker.publish("studio.example.ts.net", stale)
	fresh := stale
	fresh.Path = "/?token=new"
	checker.scripts["studio.example.ts.net"] = []fakeCheck{{document: manifest.Document{Version: manifest.Version, Device: "Studio", Services: []manifest.Service{fresh}}}}
	core := newTestCore(t, fakeNode{}, checker)
	url, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "dsh")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(url, "/?token=new") {
		t.Fatalf("a DSH mapping must use the launch path DSH publishes now, got %q", url)
	}
}

func TestOpenMappingDoesNotRetryAuthorizationFailure(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	checker.scripts["studio.example.ts.net"] = []fakeCheck{{err: remotes.ErrUnauthorized}}
	core := newTestCore(t, fakeNode{}, checker)
	if _, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "dsh"); !errors.Is(err, remotes.ErrUnauthorized) {
		t.Fatalf("error = %v, want unauthorized", err)
	}
	if checks := checker.checkCount("studio.example.ts.net"); checks != 1 {
		t.Fatalf("checks = %d, want one attempt", checks)
	}
}

func echoServer(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	go func() {
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer connection.Close()
				_, _ = io.Copy(connection, connection)
			}()
		}
	}()
	return listener.Addr().String()
}

func dialEcho(t *testing.T, address string) {
	t.Helper()
	connection, err := net.DialTimeout("tcp", address, time.Second)
	if err != nil {
		t.Fatalf("mapping %s is not listening: %v", address, err)
	}
	defer connection.Close()
	if _, err := connection.Write([]byte("v")); err != nil {
		t.Fatal(err)
	}
	buffer := make([]byte, 1)
	if _, err := io.ReadFull(connection, buffer); err != nil || buffer[0] != 'v' {
		t.Fatalf("echo through mapping failed: %v %q", err, buffer)
	}
}

func writeRemotes(t *testing.T, path string, names ...string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	config := velaconfig.Default()
	config.Remotes = nil
	for _, name := range names {
		config.Remotes = append(config.Remotes, velaconfig.RemoteMac{Name: name, PrivateName: name})
	}
	body, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, append(body, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
}
