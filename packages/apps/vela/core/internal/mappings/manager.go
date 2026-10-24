// Package mappings owns stable, reference-counted loopback service mappings.
package mappings

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/thonatos/vela/core/internal/tunnel"
)

type Key struct{ Device, Service string }
type Mapping struct {
	URL     string
	refs    int
	proxies []*tunnel.Proxy
}
type DialRemote func(context.Context, Key) (net.Conn, error)

// PreferredPort returns the port last used for one mapping, or 0 when Vela has
// not assigned one yet. Reusing it keeps the mapping URL — and therefore the
// browser's cookies and localStorage — stable across reopens.
type PreferredPort func(Key) int

// RememberPort persists the port a mapping actually bound.
type RememberPort func(Key, int)

// ResolveProtocol returns the remote service protocol ("http" or "tcp") used
// as the mapping URL scheme. Unknown or empty values map to "http".
type ResolveProtocol func(Key) string

// Address returns the host part of a mapping URL. The macOS app uses a
// per-service `.localhost` name so a shared system browser scopes cookies per
// service. iOS instead isolates by WKWebsiteDataStore and uses a bare
// 127.0.0.1, which every service adapter already recognizes as loopback.
type Address func(Key) string

type Manager struct {
	mu        sync.Mutex
	mappings  map[Key]*Mapping
	dial      DialRemote
	preferred PreferredPort
	remember  RememberPort
	protocol  ResolveProtocol
	address   Address
}

func New(dial DialRemote) *Manager {
	return &Manager{mappings: map[Key]*Mapping{}, dial: dial}
}

// WithStablePorts makes the manager reuse persisted ports for each mapping.
func (manager *Manager) WithStablePorts(preferred PreferredPort, remember RememberPort) *Manager {
	manager.preferred = preferred
	manager.remember = remember
	return manager
}

// WithProtocols makes mapping URLs follow the remote service protocol.
func (manager *Manager) WithProtocols(resolve ResolveProtocol) *Manager {
	manager.protocol = resolve
	return manager
}

// WithAddress overrides the host used in mapping URLs (iOS uses 127.0.0.1).
func (manager *Manager) WithAddress(address Address) *Manager {
	manager.address = address
	return manager
}

func (manager *Manager) host(key Key) string {
	if manager.address != nil {
		if value := manager.address(key); value != "" {
			return value
		}
	}
	return Hostname(key)
}

func (manager *Manager) scheme(key Key) string {
	if manager.protocol != nil && manager.protocol(key) == "tcp" {
		return "tcp"
	}
	return "http"
}

func listenLoopback(port int) (net.Listener, net.Listener, int, error) {
	first, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return nil, nil, 0, err
	}
	bound := first.Addr().(*net.TCPAddr).Port
	second, err := net.Listen("tcp6", fmt.Sprintf("[::1]:%d", bound))
	if err != nil {
		_ = first.Close()
		return nil, nil, 0, fmt.Errorf("listen on IPv6 loopback: %w", err)
	}
	return first, second, bound, nil
}

// Hostname derives the loopback host used for one mapping. Cookies are scoped
// by host and ignore the port, so a shared system browser would let the same
// service on two devices overwrite each other's login under a bare
// `127.0.0.1`. RFC 6761 reserves `.localhost` for loopback, so these names
// resolve without touching `/etc/hosts` and stay a secure context.
func Hostname(key Key) string {
	device := labelize(key.Device)
	service := labelize(key.Service)
	switch {
	case service == "" && device == "":
		return "vela.localhost"
	case device == "":
		return service + ".localhost"
	case service == "":
		return device + ".localhost"
	default:
		return service + "-" + device + ".localhost"
	}
}

// labelize reduces an identifier to one DNS label: the leading component of a
// MagicDNS name, lowercased, with unsupported characters folded to hyphens.
func labelize(value string) string {
	if cut := strings.IndexByte(value, '.'); cut >= 0 {
		value = value[:cut]
	}
	var builder strings.Builder
	for _, letter := range strings.ToLower(value) {
		switch {
		case letter >= 'a' && letter <= 'z', letter >= '0' && letter <= '9':
			builder.WriteRune(letter)
		case builder.Len() > 0:
			builder.WriteByte('-')
		}
	}
	return strings.Trim(builder.String(), "-")
}

func (manager *Manager) Open(ctx context.Context, key Key) (string, error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if existing := manager.mappings[key]; existing != nil {
		existing.refs++
		return existing.URL, nil
	}
	var (
		listener  net.Listener
		listener6 net.Listener
		port      int
		err       error
	)
	if manager.preferred != nil {
		if wanted := manager.preferred(key); wanted > 0 {
			listener, listener6, port, err = listenLoopback(wanted)
		}
	}
	if listener == nil {
		listener, listener6, port, err = listenLoopback(0)
	}
	if err != nil {
		return "", err
	}
	if manager.remember != nil {
		manager.remember(key, port)
	}
	dial := func(dialContext context.Context) (net.Conn, error) { return manager.dial(dialContext, key) }
	proxies := []*tunnel.Proxy{tunnel.New(listener, dial), tunnel.New(listener6, dial)}
	mapping := &Mapping{URL: fmt.Sprintf("%s://%s:%d", manager.scheme(key), manager.host(key), port), refs: 1, proxies: proxies}
	manager.mappings[key] = mapping
	for _, proxy := range proxies {
		// The mapping outlives the request that opened it. Its lifecycle is owned
		// by Close/CloseAll (including iOS suspend), not by a short-lived control
		// request or resume timeout context.
		go func() { _ = proxy.Serve(context.Background()) }()
	}
	return mapping.URL, nil
}

func (manager *Manager) Close(key Key) error {
	manager.mu.Lock()
	mapping := manager.mappings[key]
	if mapping == nil {
		manager.mu.Unlock()
		return nil
	}
	mapping.refs--
	if mapping.refs > 0 {
		manager.mu.Unlock()
		return nil
	}
	delete(manager.mappings, key)
	manager.mu.Unlock()
	var problems []error
	for _, proxy := range mapping.proxies {
		if err := proxy.Close(); err != nil {
			problems = append(problems, err)
		}
	}
	return errors.Join(problems...)
}

func (manager *Manager) Snapshot(key Key) (string, int, bool) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	mapping := manager.mappings[key]
	if mapping == nil {
		return "", 0, false
	}
	return mapping.URL, mapping.refs, true
}

// CloseAll closes every local listener during application shutdown.
func (manager *Manager) CloseAll() error {
	manager.mu.Lock()
	mappings := manager.mappings
	manager.mappings = map[Key]*Mapping{}
	manager.mu.Unlock()
	var problems []error
	for _, mapping := range mappings {
		for _, proxy := range mapping.proxies {
			if err := proxy.Close(); err != nil {
				problems = append(problems, err)
			}
		}
	}
	return errors.Join(problems...)
}
