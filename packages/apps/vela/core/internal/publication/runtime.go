// Package publication composes Vela's tailnet-only manifest and service listeners.
package publication

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"

	"github.com/thonatos/project-v/vela/core/internal/authorization"
	velaconfig "github.com/thonatos/project-v/vela/core/internal/config"
	"github.com/thonatos/project-v/vela/core/internal/inbound"
	"github.com/thonatos/project-v/vela/core/internal/manifest"
	"github.com/thonatos/project-v/vela/core/internal/services"
	"github.com/thonatos/project-v/vela/core/internal/sharing"
	"github.com/thonatos/project-v/vela/core/internal/tunnel"
)

// Node is the only network capability required to publish tailnet listeners.
type Node interface {
	Listen(network, address string) (net.Listener, error)
}

// AuthorizerProvider resolves the current persisted tailnet identity policy.
type AuthorizerProvider func(context.Context) (authorization.Authorizer, error)

// Runtime owns every inbound listener created by Vela.
type Runtime struct {
	node       Node
	authorizer AuthorizerProvider
	dialLocal  func(context.Context, string) (net.Conn, error)

	operationMu sync.Mutex
	stateMu     sync.RWMutex
	deviceName  string
	health      map[string]services.State
	published   sharing.Published
	definitions map[string]velaconfig.LocalService
	control     *httpListener
	services    *sharing.Reconciler
	launchPath  LaunchPath
}

// LaunchPath returns the sign-in path a service currently publishes, or "" when
// it has none. DSH uses it to hand its per-process launch token to authorized
// devices; the result is read at manifest time and never stored.
type LaunchPath func(velaconfig.LocalService) string

// WithLaunchPath sets the hook that supplies a service's sign-in path.
func (runtime *Runtime) WithLaunchPath(launchPath LaunchPath) *Runtime {
	runtime.launchPath = launchPath
	return runtime
}

// New creates a stopped publication runtime.
func New(node Node, authorizer AuthorizerProvider) *Runtime {
	runtime := &Runtime{
		node: node, authorizer: authorizer,
		dialLocal: func(ctx context.Context, address string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "tcp", address)
		},
		health: map[string]services.State{}, definitions: map[string]velaconfig.LocalService{},
	}
	runtime.services = sharing.NewReconciler(runtime.openService)
	return runtime
}

// Reconcile makes listeners match current network, selection and health state.
func (runtime *Runtime) Reconcile(ctx context.Context, connected bool, enabled bool, definitions []velaconfig.LocalService, health map[string]services.State, deviceName string) error {
	runtime.operationMu.Lock()
	defer runtime.operationMu.Unlock()

	runtime.stateMu.Lock()
	previous := runtime.definitions
	runtime.deviceName = deviceName
	runtime.health = cloneHealth(health)
	runtime.definitions = make(map[string]velaconfig.LocalService, len(definitions))
	selected := make(map[string]bool, len(definitions))
	for _, service := range definitions {
		runtime.definitions[service.ID] = service
		selected[service.ID] = service.Shared
	}
	runtime.stateMu.Unlock()

	var problems []error
	if connected {
		if err := runtime.ensureControl(ctx); err != nil {
			problems = append(problems, err)
		}
	} else if runtime.control != nil {
		problems = append(problems, runtime.control.Close())
		runtime.control = nil
	}

	desired := sharing.Evaluate(connected, sharing.Selection{Enabled: enabled, Services: selected}, health)
	active := runtime.services.Active()
	for id, definition := range runtime.definitions {
		if old, ok := previous[id]; ok && old != definition {
			delete(active, id)
		}
	}
	if err := runtime.services.Reconcile(active); err != nil {
		problems = append(problems, err)
	}
	if err := runtime.services.Reconcile(desired); err != nil {
		problems = append(problems, err)
	}
	active = runtime.services.Active()
	runtime.stateMu.Lock()
	runtime.published = active
	runtime.stateMu.Unlock()
	return errors.Join(problems...)
}

// Published returns the successfully listening services.
func (runtime *Runtime) Published() sharing.Published {
	runtime.stateMu.RLock()
	defer runtime.stateMu.RUnlock()
	return runtime.published
}

// Close stops new inbound connections and then closes active service flows.
func (runtime *Runtime) Close() error {
	runtime.operationMu.Lock()
	defer runtime.operationMu.Unlock()
	var problems []error
	if runtime.control != nil {
		problems = append(problems, runtime.control.Close())
		runtime.control = nil
	}
	problems = append(problems, runtime.services.Reconcile(sharing.Published{}))
	runtime.stateMu.Lock()
	runtime.published = sharing.Published{}
	runtime.stateMu.Unlock()
	return errors.Join(problems...)
}

func (runtime *Runtime) ensureControl(ctx context.Context) error {
	if runtime.control != nil {
		return nil
	}
	listener, err := runtime.authorizedListener(ctx, manifest.ControlPort)
	if err != nil {
		return fmt.Errorf("open Vela control listener: %w", err)
	}
	provider := manifest.Provider{
		DeviceName: func() string {
			runtime.stateMu.RLock()
			defer runtime.stateMu.RUnlock()
			return runtime.deviceName
		},
		Services: func() []manifest.Service {
			runtime.stateMu.RLock()
			defer runtime.stateMu.RUnlock()
			items := []manifest.Service{}
			for id := range runtime.published {
				definition, ok := runtime.definitions[id]
				if !ok {
					continue
				}
				protocol := definition.Protocol
				if protocol == "" {
					protocol = velaconfig.ProtocolHTTP
				}
				if protocol == velaconfig.ProtocolTCP {
					items = append(items, manifest.Service{ID: id, Name: definition.Name, Protocol: protocol, Preset: definition.Preset, Port: definition.Port, Available: runtime.health[id] == services.StateAvailable})
					continue
				}
				path := "/"
				if parsed, err := url.Parse(definition.URL); err == nil {
					path = parsed.EscapedPath()
					if path == "" {
						path = "/"
					}
					if parsed.RawQuery != "" {
						path += "?" + parsed.RawQuery
					}
				}
				if runtime.launchPath != nil {
					if launch := runtime.launchPath(definition); launch != "" {
						path = launch
					}
				}
				items = append(items, manifest.Service{ID: id, Name: definition.Name, Protocol: protocol, Preset: definition.Preset, Port: definition.Port, Path: path, Available: runtime.health[id] == services.StateAvailable, Adapter: definition.Adapter})
			}
			return items
		},
	}
	runtime.control = serveHTTP(listener, provider.Handler())
	return nil
}

func (runtime *Runtime) openService(serviceID string) (sharing.Listener, error) {
	runtime.stateMu.RLock()
	service, ok := runtime.definitions[serviceID]
	runtime.stateMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("service definition not found: %s", serviceID)
	}
	listener, err := runtime.authorizedListener(context.Background(), service.Port)
	if err != nil {
		return nil, err
	}
	listener = inbound.AdaptListener{Listener: listener, Adapter: service.Adapter}
	proxy := tunnel.New(listener, func(ctx context.Context) (net.Conn, error) {
		address, err := localAddress(service.URL)
		if err != nil {
			return nil, err
		}
		return runtime.dialLocal(ctx, address)
	})
	go func() { _ = proxy.Serve(context.Background()) }()
	return proxy, nil
}

func localAddress(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != velaconfig.ProtocolHTTP && parsed.Scheme != velaconfig.ProtocolTCP) || parsed.Host == "" {
		return "", errors.New("service target must be a loopback HTTP or TCP URL")
	}
	host := parsed.Hostname()
	if parsed.Scheme == velaconfig.ProtocolTCP && parsed.Port() == "" {
		return "", errors.New("TCP service target requires a port")
	}
	if host != "localhost" && host != "127.0.0.1" && host != "::1" {
		return "", errors.New("service target must be loopback")
	}
	return parsed.Host, nil
}

func (runtime *Runtime) authorizedListener(ctx context.Context, port int) (net.Listener, error) {
	authorizer, err := runtime.authorizer(ctx)
	if err != nil {
		return nil, err
	}
	listener, err := runtime.node.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return nil, err
	}
	return inbound.AuthorizedListener{Listener: listener, Authorizer: authorizer}, nil
}

func cloneHealth(health map[string]services.State) map[string]services.State {
	copy := make(map[string]services.State, len(health))
	for service, state := range health {
		copy[service] = state
	}
	return copy
}

type httpListener struct {
	listener net.Listener
	server   *http.Server
	done     chan struct{}
}

func serveHTTP(listener net.Listener, handler http.Handler) *httpListener {
	service := &httpListener{listener: listener, server: &http.Server{Handler: handler}, done: make(chan struct{})}
	go func() {
		defer close(service.done)
		_ = service.server.Serve(listener)
	}()
	return service
}

func (service *httpListener) Close() error {
	err := service.server.Close()
	_ = service.listener.Close()
	<-service.done
	return err
}
