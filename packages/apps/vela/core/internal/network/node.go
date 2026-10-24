// Package network owns Vela's single embedded Tailscale node.
package network

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"

	"tailscale.com/client/local"
	"tailscale.com/tsnet"
)

// Node is the narrow userspace-networking seam used by Vela services.
type Node interface {
	Start() error
	Dial(context.Context, string, string) (net.Conn, error)
	Listen(string, string) (net.Listener, error)
	Close() error
}

// Embedded is one lazily-started tsnet.Server. It does not install a TUN,
// advertise routes, select an exit node, or modify system network settings.
type Embedded struct {
	server *tsnet.Server
	once   sync.Once
	// async guards StartAsync so a read-side status poll issues at most one
	// background start. It is separate from once because once still owns the
	// blocking Start path.
	async sync.Once
	mu    sync.Mutex
	err   error
	// start is the seam tests inject to exercise lazy startup without tsnet.
	// nil means the real tsnet server.
	start func() error
	// started is whether Start succeeded; starting is whether a background
	// start was issued and has not returned yet.
	started  bool
	starting bool
}

// NewEmbedded constructs Vela's only production network node.
func NewEmbedded(stateDirectory, hostname string) *Embedded {
	return &Embedded{server: &tsnet.Server{
		Dir:      stateDirectory,
		Hostname: hostname,
	}}
}

// Start brings up the userspace node at most once.
func (node *Embedded) Start() error {
	node.once.Do(func() {
		start := node.start
		if start == nil {
			start = node.server.Start
		}
		node.err = start()
		node.mu.Lock()
		node.started = node.err == nil
		node.starting = false
		node.mu.Unlock()
	})
	return node.err
}

// StartAsync asks the node to come up in the background and returns
// immediately. Read-side status polls use it so a cold client start never
// waits for tsnet; the blocking Start remains the entry for action paths.
func (node *Embedded) StartAsync() {
	if node.Running() {
		return
	}
	node.async.Do(func() {
		node.mu.Lock()
		node.starting = true
		node.mu.Unlock()
		go func() { _ = node.Start() }()
	})
}

// Running reports whether Start has completed successfully.
func (node *Embedded) Running() bool {
	node.mu.Lock()
	defer node.mu.Unlock()
	return node.started
}

// Starting reports whether a background start was issued but has not finished.
func (node *Embedded) Starting() bool {
	node.mu.Lock()
	defer node.mu.Unlock()
	return node.starting && !node.started
}

// Dial connects exclusively through the embedded tailnet node.
func (node *Embedded) Dial(ctx context.Context, network, address string) (net.Conn, error) {
	if err := node.Start(); err != nil {
		return nil, fmt.Errorf("start private network: %w", err)
	}
	return node.server.Dial(ctx, network, address)
}

// Listen accepts connections exclusively on the embedded tailnet node.
func (node *Embedded) Listen(network, address string) (net.Listener, error) {
	if err := node.Start(); err != nil {
		return nil, fmt.Errorf("start private network: %w", err)
	}
	return node.server.Listen(network, address)
}

// Close stops the userspace node after a successful start.
func (node *Embedded) Close() error {
	node.mu.Lock()
	started := node.started
	node.started = false
	node.mu.Unlock()
	if !started {
		return nil
	}
	return node.server.Close()
}

// Manager guarantees a single node owner for sharing and remote access.
type Manager struct {
	Node Node
}

// NewManager rejects missing node implementations.
func NewManager(node Node) (*Manager, error) {
	if node == nil {
		return nil, errors.New("private network node is required")
	}
	return &Manager{Node: node}, nil
}

// Configuration reports the security-relevant tsnet settings for diagnostics
// and startup tests without exposing the mutable server.
func (node *Embedded) Configuration() (stateDirectory, hostname string, hasTUN bool, tags []string) {
	return node.server.Dir, node.server.Hostname, node.server.Tun != nil, append([]string(nil), node.server.AdvertiseTags...)
}

// LocalClient returns the stable LocalAPI client for authentication and identity operations.
func (node *Embedded) LocalClient() (*local.Client, error) {
	if err := node.Start(); err != nil {
		return nil, fmt.Errorf("start private network: %w", err)
	}
	return node.server.LocalClient()
}
