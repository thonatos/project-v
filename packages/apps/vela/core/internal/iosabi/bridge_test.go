package iosabi

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"testing"

	velapaths "github.com/thonatos/vela/core/internal/paths"
	"github.com/thonatos/vela/core/internal/vela"
	"tailscale.com/client/local"
)

// stubNode keeps the bridge test offline: status never dials.
type stubNode struct{}

func (stubNode) Dial(context.Context, string, string) (net.Conn, error) {
	return nil, errors.New("no dialer")
}

func (stubNode) LocalClient() (*local.Client, error) { return nil, errors.New("no local API in tests") }

func (stubNode) Close() error { return nil }

func TestBridgeStatusRoundTrip(t *testing.T) {
	t.Parallel()
	core, err := vela.New(vela.Options{Paths: velapaths.FromApplicationSupport(t.TempDir()), Node: stubNode{}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = core.Close() })

	bridge := NewBridge(core, nil)
	t.Cleanup(bridge.Close)

	raw, err := bridge.RequestJSON("status.get", "")
	if err != nil {
		t.Fatal(err)
	}
	var envelope struct {
		Type    string          `json:"type"`
		ID      string          `json:"id"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal([]byte(raw), &envelope); err != nil {
		t.Fatalf("response is not JSON: %v\n%s", err, raw)
	}
	if envelope.Type != "status" || envelope.ID == "" {
		t.Fatalf("unexpected response: %s", raw)
	}
	var status struct {
		Network string `json:"network"`
		Remotes []any  `json:"remotes"`
	}
	if err := json.Unmarshal(envelope.Payload, &status); err != nil {
		t.Fatal(err)
	}
	if status.Network != "offline" || len(status.Remotes) != 0 {
		t.Fatalf("unexpected status payload: %s", envelope.Payload)
	}
}
