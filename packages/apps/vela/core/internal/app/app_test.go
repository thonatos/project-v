package app

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"testing"

	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/diagnostics"
	velapaths "github.com/thonatos/vela/core/internal/paths"
	"github.com/thonatos/vela/core/internal/vela"
	"tailscale.com/client/local"
)

type stubNode struct{}

func (stubNode) Dial(context.Context, string, string) (net.Conn, error) {
	return nil, errors.New("no dialer")
}

func (stubNode) LocalClient() (*local.Client, error) { return nil, errors.New("no local API in tests") }

func (stubNode) Listen(string, string) (net.Listener, error) {
	return nil, errors.New("no listeners in tests")
}

func (stubNode) Close() error { return nil }

func newTestApp(t *testing.T) (*App, *velaconfig.Store) {
	t.Helper()
	paths := velapaths.FromApplicationSupport(t.TempDir())
	store, err := velaconfig.Open(paths.Config)
	if err != nil {
		t.Fatal(err)
	}
	journal := diagnostics.NewJournal(50)
	noRefresh := 0
	core, err := vela.New(vela.Options{
		Paths: paths, Node: stubNode{}, Store: store, Journal: journal, RetryAttempts: &noRefresh,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = core.Close() })
	return New(Options{Core: core, Store: store, Node: stubNode{}, Journal: journal, Home: t.TempDir()}), store
}

func upsert(t *testing.T, application *App, fields map[string]any) (any, error) {
	t.Helper()
	raw, err := json.Marshal(fields)
	if err != nil {
		t.Fatal(err)
	}
	return application.serviceUpsert(raw)
}

func TestServiceUpsertValidation(t *testing.T) {
	t.Parallel()
	application, _ := newTestApp(t)

	for name, fields := range map[string]map[string]any{
		"missing name":          {"id": "", "name": "  ", "url": "http://127.0.0.1:3000/", "protocol": "http"},
		"non-loopback target":   {"id": "", "name": "docs", "url": "http://example.com/", "protocol": "http"},
		"tcp with adapter":      {"id": "", "name": "redis", "url": "tcp://127.0.0.1:6379", "protocol": "tcp", "adapter": "dsh"},
		"unknown adapter":       {"id": "", "name": "docs", "url": "http://127.0.0.1:3000/", "protocol": "http", "adapter": "nope"},
		"unknown preset":        {"id": "", "name": "docs", "url": "http://127.0.0.1:3000/", "protocol": "http", "preset": "nope"},
		"preset/protocol clash": {"id": "", "name": "redis", "url": "tcp://127.0.0.1:6379", "protocol": "tcp", "preset": "opencode"},
		"auth log without dsh":  {"id": "", "name": "docs", "url": "http://127.0.0.1:3000/", "protocol": "http", "authLog": "~/.dsh/log"},
	} {
		if _, err := upsert(t, application, fields); err == nil {
			t.Fatalf("%s: upsert must be rejected", name)
		}
	}
}

func TestServiceUpsertNormalisesAndKeepsAuthLog(t *testing.T) {
	t.Parallel()
	application, store := newTestApp(t)

	// A built-in preset assigns the stable id and port Core keeps for it.
	if _, err := upsert(t, application, map[string]any{
		"id": "", "name": " DSH ", "url": "http://127.0.0.1:3080/", "protocol": "http", "preset": "DSH", "adapter": "dsh",
		"authLog": "~/.dsh/logs/web.log",
	}); err != nil {
		t.Fatal(err)
	}
	services := store.Snapshot().Services
	if len(services) != 1 || services[0].ID != "dsh" || services[0].Port != velaconfig.DSHPort || services[0].Name != "DSH" {
		t.Fatalf("services = %+v", services)
	}
	if services[0].AuthLog == "" || services[0].AuthLog == "~/.dsh/logs/web.log" {
		t.Fatalf("authLog must be expanded, got %q", services[0].AuthLog)
	}
	expanded := services[0].AuthLog

	// Editing without authLog must not clear the value that is already stored.
	if _, err := upsert(t, application, map[string]any{
		"id": "dsh", "name": "DSH", "url": "http://127.0.0.1:3080/", "protocol": "http", "preset": "dsh", "adapter": "dsh", "shared": true,
	}); err != nil {
		t.Fatal(err)
	}
	services = store.Snapshot().Services
	if len(services) != 1 || !services[0].Shared || services[0].AuthLog != expanded {
		t.Fatalf("services = %+v", services)
	}

	// Dropping the DSH adapter drops the sign-in log with it.
	if _, err := upsert(t, application, map[string]any{
		"id": "dsh", "name": "DSH", "url": "http://127.0.0.1:3080/", "protocol": "http", "preset": "", "adapter": "", "authLog": "",
	}); err != nil {
		t.Fatal(err)
	}
	if got := store.Snapshot().Services[0].AuthLog; got != "" {
		t.Fatalf("non-DSH service kept a sign-in log: %q", got)
	}
}

func TestServiceUpsertRejectsDuplicateTarget(t *testing.T) {
	t.Parallel()
	application, _ := newTestApp(t)
	fields := map[string]any{"id": "", "name": "docs", "url": "http://localhost:3000/", "protocol": "http"}
	if _, err := upsert(t, application, fields); err != nil {
		t.Fatal(err)
	}
	// localhost folds into 127.0.0.1, so the same target cannot be added twice.
	fields["name"] = "docs again"
	fields["url"] = "http://127.0.0.1:3000/"
	if _, err := upsert(t, application, fields); err == nil {
		t.Fatal("a duplicate target must be rejected")
	}
}
