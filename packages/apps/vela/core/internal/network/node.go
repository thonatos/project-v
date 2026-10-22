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
	server  *tsnet.Server
	once    sync.Once
	mu      sync.Mutex
	err     error
	started bool
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
		node.err = node.server.Start()
		if node.err == nil {
			node.mu.Lock()
			node.started = true
			node.mu.Unlock()
		}
	})
	return node.err
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
