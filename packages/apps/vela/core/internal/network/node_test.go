package network

import (
	"context"
	"net"
	"sync/atomic"
	"testing"
	"time"
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

func TestStartAsyncReturnsImmediatelyAndStartsOnce(t *testing.T) {
	t.Parallel()
	node := NewEmbedded(t.TempDir(), "vela-test")
	release := make(chan struct{})
	var calls int32
	node.start = func() error {
		atomic.AddInt32(&calls, 1)
		<-release
		return nil
	}

	started := time.Now()
	node.StartAsync()
	if elapsed := time.Since(started); elapsed > 200*time.Millisecond {
		t.Fatalf("StartAsync blocked for %s", elapsed)
	}
	if node.Running() {
		t.Fatal("Running must stay false while the background start is in flight")
	}
	if !node.Starting() {
		t.Fatal("Starting must report the issued background start")
	}

	node.StartAsync()
	close(release)

	deadline := time.Now().Add(2 * time.Second)
	for !node.Running() {
		if time.Now().After(deadline) {
			t.Fatal("the background start never completed")
		}
		time.Sleep(time.Millisecond)
	}
	if node.Starting() {
		t.Fatal("Starting must be false once the start completed")
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("start called %d times, want 1", got)
	}
}
