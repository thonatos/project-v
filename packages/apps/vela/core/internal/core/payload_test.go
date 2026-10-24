package core

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"
	"time"

	"implements.io/vela/internal/manifest"
	velapaths "implements.io/vela/internal/paths"
	"implements.io/vela/internal/remotes"
)

// TestStatusPayloadKeySets locks the iOS status contract before the Core is
// merged with the macOS one. Keys are asserted exactly: adding a field is a
// deliberate change, and a merge that drops one fails here.
func TestStatusPayloadKeySets(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	checker.publish("studio.example.ts.net", manifest.Service{
		ID: "opencode", Name: "OpenCode", Protocol: manifest.ProtocolHTTP, Port: 47845, Available: true,
	})
	checker.states["mini.example.ts.net"] = remotes.ManifestState{Checked: true, Err: remotes.ErrOffline}
	checker.states["old.example.ts.net"] = remotes.ManifestState{Checked: true, Err: remotes.ErrIncompatibleProtocol}
	checker.states["revoked.example.ts.net"] = remotes.ManifestState{Checked: true, Err: remotes.ErrUnauthorized}

	paths := velapaths.FromApplicationSupport(t.TempDir())
	writeRemotes(t, paths.Config, "studio.example.ts.net", "mini.example.ts.net", "old.example.ts.net", "revoked.example.ts.net")
	core, err := New(Options{Paths: paths, Node: fakeNode{}, Checker: checker, RetryDelay: time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = core.Close() })

	payload, err := core.Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	snapshot := payload.(map[string]any)
	assertKeys(t, "status", snapshot, []string{
		"deviceName", "network", "preferences", "remotes", "tailnetDevices", "tailscale",
	})

	items := snapshot["remotes"].([]RemoteSnapshot)
	if len(items) != 4 {
		t.Fatalf("remotes = %d, want 4", len(items))
	}
	for _, item := range items {
		encoded, err := json.Marshal(item)
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]any
		if err := json.Unmarshal(encoded, &fields); err != nil {
			t.Fatal(err)
		}
		assertKeys(t, "remote "+item.PrivateName, fields, []string{
			"compatible", "connection", "ips", "issue", "lastConnectedUtc", "name", "privateName", "services",
		})
	}

	byName := map[string]RemoteSnapshot{}
	for _, item := range items {
		byName[item.PrivateName] = item
	}
	for name, want := range map[string]struct {
		connection string
		compatible bool
		issue      string
	}{
		"studio.example.ts.net":  {"connected", true, ""},
		"mini.example.ts.net":    {"offline", true, "offline"},
		"old.example.ts.net":     {"offline", false, "incompatible"},
		"revoked.example.ts.net": {"offline", true, "unauthorized"},
	} {
		item := byName[name]
		if item.Connection != want.connection || item.Compatible != want.compatible || item.Issue != want.issue {
			t.Fatalf("%s = connection:%v compatible:%v issue:%v, want %+v",
				name, item.Connection, item.Compatible, item.Issue, want)
		}
	}
}

// TestOpenMappingStopsAfterThreeAttempts locks the iOS retry policy before the
// policies of both platforms move behind one Options struct.
func TestOpenMappingStopsAfterThreeAttempts(t *testing.T) {
	t.Parallel()
	checker := newFakeChecker()
	checker.scripts["studio.example.ts.net"] = []fakeCheck{
		{err: remotes.ErrOffline}, {err: remotes.ErrOffline}, {err: remotes.ErrOffline},
	}
	core := newTestCore(t, fakeNode{}, checker)

	started := time.Now()
	if _, err := core.OpenMapping(context.Background(), "studio.example.ts.net", "dsh"); !errors.Is(err, remotes.ErrOffline) {
		t.Fatalf("error = %v, want offline", err)
	}
	elapsed := time.Since(started)
	if checks := checker.checkCount("studio.example.ts.net"); checks != 3 {
		t.Fatalf("checks = %d, want exactly 3 attempts", checks)
	}
	// Attempts wait 1ms then 2ms (RetryDelay doubles per attempt), so a bounded
	// retry cannot finish faster than the sum of its backoff.
	if elapsed < 3*time.Millisecond {
		t.Fatalf("elapsed = %v, want at least 3ms of backoff", elapsed)
	}
}

func assertKeys(t *testing.T, label string, value map[string]any, want []string) {
	t.Helper()
	got := make([]string, 0, len(value))
	for key := range value {
		got = append(got, key)
	}
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("%s keys = %v, want %v", label, got, want)
	}
}
