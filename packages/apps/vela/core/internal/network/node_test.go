package network

import (
	"context"
	"net"
	"testing"
)

type fakeNode struct{}

func (*fakeNode) Start() error                                           { return nil }
func (*fakeNode) Dial(context.Context, string, string) (net.Conn, error) { return nil, nil }
func (*fakeNode) Listen(string, string) (net.Listener, error)            { return nil, nil }
func (*fakeNode) Close() error                                           { return nil }

func TestManagerUsesOneNodeForBothDirections(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	manager, err := NewManager(node)
	if err != nil {
		t.Fatal(err)
	}
	if manager.Node != node {
		t.Fatal("manager did not retain the single node")
	}
	_, _ = manager.Node.Dial(context.Background(), "tcp", "example:1")
	_, _ = manager.Node.Listen("tcp", ":1")
}

func TestEmbeddedConstructionHasNoSystemNetworkingFeatures(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	node := NewEmbedded(directory, "vela-test")
	stateDirectory, hostname, hasTUN, tags := node.Configuration()
	if hasTUN {
		t.Fatal("Vela must not configure a TUN device")
	}
	if len(tags) != 0 {
		t.Fatalf("Vela must not advertise tags: %v", tags)
	}
	if stateDirectory != directory || hostname != "vela-test" {
		t.Fatalf("unexpected tsnet configuration: dir=%q hostname=%q", stateDirectory, hostname)
	}
	if err := node.Close(); err != nil {
		t.Fatalf("close before start: %v", err)
	}
}

func TestManagerRejectsMissingNode(t *testing.T) {
	t.Parallel()
	if _, err := NewManager(nil); err == nil {
		t.Fatal("expected missing node to fail")
	}
}
