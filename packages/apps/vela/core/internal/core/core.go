// Package core implements the read-side Core shared by the macOS and iOS clients.
//
// It reuses the macOS Core's identity, manifest, mapping, tunnel and control
// packages but never publishes or probes local services: iOS only dials peers
// that were shared with it.
package core

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"implements.io/vela/internal/adapters"
	"implements.io/vela/internal/buildinfo"
	velaconfig "implements.io/vela/internal/config"
	"implements.io/vela/internal/control"
	"implements.io/vela/internal/diagnostics"
	"implements.io/vela/internal/manifest"
	"implements.io/vela/internal/mappings"
	velanetwork "implements.io/vela/internal/network"
	velapaths "implements.io/vela/internal/paths"
	"implements.io/vela/internal/protocol"
	"implements.io/vela/internal/remoteclient"
	"implements.io/vela/internal/remotes"
	"tailscale.com/client/local"
	"tailscale.com/ipn"
)

// DefaultRetryAttempts is how many manifest refreshes one mapping open makes
// before reporting the remote as unavailable.
const DefaultRetryAttempts = 3

// Node is the network seam the Core dials through. *network.Embedded
// implements it; tests provide a fake.
type Node interface {
	Dial(context.Context, string, string) (net.Conn, error)
	LocalClient() (*local.Client, error)
	Close() error
}

// ManifestChecker is the remote handshake seam; *remotes.ManifestChecker
// implements it.
type ManifestChecker interface {
	Check(context.Context, string) (remotes.CheckResult, error)
	State(string) (remotes.ManifestState, bool)
}

// Options configures one iOS Core.
type Options struct {
	Paths velapaths.Writable
	Node  Node
	// Store is an already-open configuration store. Callers that need the
	// device name before the node exists open it once and share it; nil lets
	// New open Paths.Config itself.
	Store *velaconfig.Store
	// Journal is shared with the platform layer so its records appear in the
	// same diagnostics a client copies. nil creates a fresh journal.
	Journal *diagnostics.Journal
	// Checker overrides the tsnet manifest checker in tests.
	Checker ManifestChecker
	// ManifestPort overrides the remote control port (tests).
	ManifestPort int
	// RetryAttempts bounds manifest refreshes when a service is not in the
	// cache. nil keeps DefaultRetryAttempts; zero disables the refresh, which
	// is the macOS policy: it reports the service as unpublished immediately.
	RetryAttempts *int
	// Address overrides the loopback host mappings bind to. Empty keeps the
	// per-service hostname macOS uses; "127.0.0.1" is the iOS policy.
	Address string
	// Avatar includes a Gravatar URL in Status when the preference is enabled.
	// Only the iOS client renders it.
	Avatar bool
	// RetryDelay is the base backoff between automatic retries.
	RetryDelay time.Duration
	// Now overrides the clock in tests.
	Now func() time.Time
	// Logger receives operational errors; nil discards them.
	Logger *log.Logger
}

// Core owns identity, peers, manifests, loopback mappings and read-side
// handlers. Publication and service sharing are composed on top by macOS.
type Core struct {
	paths    velapaths.Writable
	store    *velaconfig.Store
	node     Node
	journal  *diagnostics.Journal
	checker  ManifestChecker
	registry remotes.Registry
	manager  *mappings.Manager
	session  *mappings.Session
	logger   *log.Logger
	now      func() time.Time
	attempts int
	delay    time.Duration
	signing  string
	avatar   bool

	peerMu        sync.Mutex
	peerSignature string
}

// New loads configuration from Paths and constructs the access Core.
func New(options Options) (*Core, error) {
	if options.Node == nil {
		return nil, errors.New("private network node is required")
	}
	store := options.Store
	if store == nil {
		opened, err := velaconfig.Open(options.Paths.Config)
		if err != nil {
			return nil, err
		}
		store = opened
	}
	logger := options.Logger
	if logger == nil {
		logger = log.New(io.Discard, "", 0)
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}
	journal := options.Journal
	if journal == nil {
		journal = diagnostics.NewJournal(300)
		journal.Record("info", "core", fmt.Sprintf("%s core started with control protocol v%d", buildinfo.Name, protocol.Version))
	}

	checker := options.Checker
	if checker == nil {
		transport := &http.Transport{DialContext: options.Node.Dial, ForceAttemptHTTP2: false}
		checker = &remotes.ManifestChecker{
			Cache: remoteclient.New(&http.Client{Transport: transport, Timeout: 4 * time.Second}),
			Port:  options.ManifestPort,
		}
	}

	manager := mappings.New(mappings.RemoteDial(options.Node, func(device, service string) (int, bool) {
		published, ok := resolveRemoteService(checker, device, service)
		return published.Port, ok
	})).
		WithProtocols(func(key mappings.Key) string {
			service, _ := resolveRemoteService(checker, key.Device, key.Service)
			return service.Protocol
		}).
		WithStablePorts(
			func(key mappings.Key) int {
				for _, remembered := range store.Snapshot().MappingPorts {
					if remembered.PrivateName == key.Device && remembered.Service == key.Service {
						return remembered.Port
					}
				}
				return 0
			},
			func(key mappings.Key, port int) {
				if err := store.Update(func(config *velaconfig.Config) error {
					for index := range config.MappingPorts {
						if config.MappingPorts[index].PrivateName == key.Device && config.MappingPorts[index].Service == key.Service {
							config.MappingPorts[index].Port = port
							return nil
						}
					}
					config.MappingPorts = append(config.MappingPorts, velaconfig.MappingPort{PrivateName: key.Device, Service: key.Service, Port: port})
					return nil
				}); err != nil {
					logger.Printf("remember mapping port: %v", err)
				}
			},
		)

	attempts := DefaultRetryAttempts
	if options.RetryAttempts != nil {
		attempts = *options.RetryAttempts
	}
	if attempts < 0 {
		attempts = 0
	}
	delay := options.RetryDelay
	if delay <= 0 {
		delay = 300 * time.Millisecond
	}

	core := &Core{
		paths:    options.Paths,
		store:    store,
		node:     options.Node,
		journal:  journal,
		checker:  checker,
		registry: remotes.Registry{Store: store, Checker: checker, Now: now},
		manager:  manager,
		session:  mappings.NewSession(manager),
		logger:   logger,
		now:      now,
		attempts: attempts,
		delay:    delay,
		avatar:   options.Avatar,
	}
	if options.Address != "" {
		// iOS isolates cookies with a WKWebsiteDataStore per device+service, so
		// every URL can stay on 127.0.0.1; macOS keeps the per-service hostname.
		manager.WithAddress(func(mappings.Key) string { return options.Address })
	}
	return core, nil
}

// Paths returns the writable boundary this Core owns.
func (core *Core) Paths() velapaths.Writable { return core.paths }

// Store exposes the shared configuration store so a platform layer can read
// service and sharing choices without opening the same file twice.
func (core *Core) Store() *velaconfig.Store { return core.store }

// AuthStatus reports the embedded node's identity state. The macOS layer uses
// it to decide whether services may be published.
func (core *Core) AuthStatus(ctx context.Context) (velanetwork.AuthState, error) {
	return core.authStatus(ctx)
}

// SetSigningExpiry records the embedded provisioning profile's expiry, which
// the Rust host reads from embedded.mobileprovision at launch.
func (core *Core) SetSigningExpiry(value string) {
	core.signing = strings.TrimSpace(value)
}

// Journal exposes the redacted diagnostics journal.
func (core *Core) Journal() *diagnostics.Journal { return core.journal }

// Suspend releases every loopback listener for the background scene.
func (core *Core) Suspend() error {
	core.journal.Record("info", "lifecycle", "suspended: loopback listeners closed")
	return core.session.Suspend()
}

// Resume recreates the mappings that were open before Suspend.
func (core *Core) Resume(ctx context.Context) error {
	urls, err := core.session.Resume(ctx)
	if err != nil {
		core.journal.Record("error", "lifecycle", fmt.Sprintf("resume failed: %v", err))
		return err
	}
	for key, url := range urls {
		core.journal.Record("info", "lifecycle", fmt.Sprintf("resumed %s/%s at %s", key.Device, key.Service, url))
	}
	return nil
}

// Close stops the network node and every listener. It is idempotent.
func (core *Core) Close() error {
	return errors.Join(core.session.Suspend(), core.node.Close())
}

// Status is the read-side snapshot: identity, peers and remote manifests.
// macOS adds probed services and sharing; iOS may add signing and an avatar.
func (core *Core) Status(ctx context.Context) (any, error) {
	config := core.store.Snapshot()
	state, _ := core.authStatus(ctx)
	deviceName := config.DeviceName
	if state.Hostname != "" {
		deviceName = state.Hostname
	}
	var self any = map[string]any{"name": deviceName, "ips": []string{}, "backend": string(state.State)}
	var peers any = []velanetwork.DeviceInfo{}
	if client, err := core.node.LocalClient(); err == nil {
		if status, err := client.Status(ctx); err == nil {
			local, visible := velanetwork.Snapshot(status)
			self, peers = local, visible
			if local.Name != "" {
				deviceName = local.Name
			}
			core.logPeers(visible)
		}
	}
	payload := map[string]any{
		"network":        state.State,
		"deviceName":     deviceName,
		"preferences":    config.Preferences,
		"tailscale":      self,
		"tailnetDevices": peers,
		"remotes":        core.remoteSnapshot(),
	}
	if core.signing != "" {
		payload["signing"] = map[string]string{"expiresAt": core.signing}
	}
	if core.avatar && config.Preferences.GravatarAvatar {
		if local, ok := self.(velanetwork.DeviceInfo); ok {
			if email := normalizedEmail(local.User); email != "" {
				hash := sha256.Sum256([]byte(email))
				payload["avatarUrl"] = fmt.Sprintf("https://gravatar.com/avatar/%x?s=128&d=404", hash)
			}
		}
	}
	return payload, nil
}

func normalizedEmail(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if strings.Count(value, "@") != 1 || strings.HasPrefix(value, "@") || strings.HasSuffix(value, "@") {
		return ""
	}
	return value
}

// OpenMapping exposes one remote service on a loopback port. A manifest that
// is missing or stale is refreshed automatically, with bounded retries.
func (core *Core) OpenMapping(ctx context.Context, device, service string) (string, error) {
	published, ok := resolveRemoteService(core.checker, device, service)
	if !ok && core.attempts > 0 {
		if err := core.refreshWithRetry(ctx, device); err != nil {
			core.journal.Record("error", "mapping", fmt.Sprintf("%s/%s manifest unavailable: %v", device, service, err))
			return "", err
		}
		published, ok = resolveRemoteService(core.checker, device, service)
	}
	if !ok {
		core.journal.Record("error", "mapping", fmt.Sprintf("%s/%s is not currently published", device, service))
		return "", errors.New("remote service is not currently published")
	}
	if published.Adapter == string(adapters.DSH) {
		// DSH issues a new launch token whenever it restarts, so fetch the
		// current one; a failed refresh keeps the cached manifest.
		if _, err := core.checker.Check(ctx, device); err == nil {
			if fresh, ok := resolveRemoteService(core.checker, device, service); ok {
				published = fresh
			}
		}
	}
	key := mappings.Key{Device: device, Service: service}
	base, err := core.session.Open(ctx, key)
	if err != nil {
		core.journal.Record("error", "mapping", fmt.Sprintf("open %s/%s failed: %v", device, service, err))
		return "", err
	}
	core.journal.Record("info", "mapping", fmt.Sprintf("opened %s/%s", device, service))
	if published.Protocol != manifest.ProtocolTCP && published.Path != "" && published.Path != "/" {
		return strings.TrimSuffix(base, "/") + published.Path, nil
	}
	return base, nil
}

// CloseMapping releases one loopback listener.
func (core *Core) CloseMapping(device, service string) error {
	core.journal.Record("info", "mapping", fmt.Sprintf("closed %s/%s", device, service))
	return core.session.Close(mappings.Key{Device: device, Service: service})
}

// RefreshRemotes checks every saved device and returns the refreshed list.
func (core *Core) RefreshRemotes(ctx context.Context) any {
	configured := core.store.Snapshot().Remotes
	var group sync.WaitGroup
	for _, remote := range configured {
		privateName := remote.PrivateName
		group.Add(1)
		go func() {
			defer group.Done()
			if _, err := core.registry.Refresh(ctx, privateName); err != nil {
				core.journal.Record("error", "remote", fmt.Sprintf("%s refresh failed: %v", privateName, err))
				return
			}
			core.journal.Record("info", "remote", fmt.Sprintf("%s refreshed", privateName))
		}()
	}
	group.Wait()
	return core.remoteSnapshot()
}

// refreshWithRetry retries the remote handshake a bounded number of times.
// The UI offers a manual retry by calling remote.refresh again.
func (core *Core) refreshWithRetry(ctx context.Context, device string) error {
	var last error
	for attempt := 0; attempt < core.attempts; attempt++ {
		if _, err := core.checker.Check(ctx, device); err == nil {
			return nil
		} else {
			last = err
		}
		if errors.Is(last, remotes.ErrUnauthorized) || errors.Is(last, remotes.ErrIncompatibleProtocol) {
			return last
		}
		if attempt == core.attempts-1 {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(core.delay * time.Duration(1<<attempt)):
		}
	}
	return last
}

// RemoteSnapshot is one saved device as the control protocol returns it.
// Every field is always present: the UI distinguishes "no issue" from "not
// checked yet" by the connection value, not by a missing key.
type RemoteSnapshot struct {
	Name             string             `json:"name"`
	PrivateName      string             `json:"privateName"`
	LastConnectedUTC string             `json:"lastConnectedUtc"`
	Connection       string             `json:"connection"`
	Compatible       bool               `json:"compatible"`
	Issue            string             `json:"issue"`
	Services         []manifest.Service `json:"services"`
	IPs              []string           `json:"ips"`
}

func (core *Core) remoteSnapshot() []RemoteSnapshot {
	configured := core.store.Snapshot().Remotes
	addresses := core.remoteAddresses()
	items := make([]RemoteSnapshot, 0, len(configured))
	for _, remote := range configured {
		item := RemoteSnapshot{
			Name: remote.Name, PrivateName: remote.PrivateName, LastConnectedUTC: remote.LastConnectedUTC,
			Connection: "offline", Compatible: true, Issue: "offline", Services: []manifest.Service{},
			IPs: addresses[remote.PrivateName],
		}
		if item.IPs == nil {
			item.IPs = []string{}
		}
		if state, ok := core.checker.State(remote.PrivateName); ok && state.Checked {
			switch {
			case state.Err == nil:
				item.Connection = "connected"
				item.Issue = ""
				item.Services = state.Entry.Document.Services
			case errors.Is(state.Err, remotes.ErrIncompatibleProtocol):
				item.Compatible = false
				item.Issue = "incompatible"
			case errors.Is(state.Err, remotes.ErrUnauthorized):
				item.Issue = "unauthorized"
			}
		}
		items = append(items, item)
	}
	return items
}

func (core *Core) remoteAddresses() map[string][]string {
	addresses := map[string][]string{}
	client, err := core.node.LocalClient()
	if err != nil {
		return addresses
	}
	status, err := client.Status(context.Background())
	if err != nil {
		return addresses
	}
	_, peers := velanetwork.Snapshot(status)
	for _, peer := range peers {
		if peer.DNSName != "" {
			addresses[peer.DNSName] = peer.IPs
		}
	}
	return addresses
}

// logPeers records the tailnet peer set when it changes. Device discovery on
// the add sheet depends on these peers carrying MagicDNS names, so the set is
// worth having in the redacted journal.
func (core *Core) logPeers(peers []velanetwork.DeviceInfo) {
	names := make([]string, 0, len(peers))
	for _, peer := range peers {
		name := peer.DNSName
		if name == "" {
			name = peer.Name + "(no-dns)"
		}
		names = append(names, name)
	}
	slices.Sort(names)
	signature := strings.Join(names, ", ")
	core.peerMu.Lock()
	changed := signature != core.peerSignature
	core.peerSignature = signature
	core.peerMu.Unlock()
	if changed {
		core.journal.Record("info", "network", fmt.Sprintf("tailnet peers=%d %s", len(names), signature))
		core.logger.Printf("iOS tailnet peers=%d %s", len(names), signature)
	}
}

func (core *Core) authStatus(ctx context.Context) (velanetwork.AuthState, error) {
	client, err := core.node.LocalClient()
	if err != nil {
		return velanetwork.AuthState{State: velanetwork.StateOffline}, err
	}
	return velanetwork.AuthController{Client: client}.Status(ctx)
}

// hostnamePattern is the Tailscale hostname rule the rename form pre-checks.
// `shared/protocol/fixtures/hostname-validation.json` pins both implementations
// to the same cases.
var hostnamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,62}$`)

// ValidHostname reports whether name is a legal Tailscale hostname.
func ValidHostname(name string) bool { return hostnamePattern.MatchString(name) }

// DiagnosticActivity lists the mappings this Core holds open. The macOS layer
// adds its published service set; a read-only client reports none.
func (core *Core) DiagnosticActivity() (any, error) {
	config := core.store.Snapshot()
	items := []map[string]any{}
	for _, remote := range config.Remotes {
		state, known := core.checker.State(remote.PrivateName)
		if !known {
			continue
		}
		for _, published := range state.Entry.Document.Services {
			url, refs, open := core.session.Snapshot(mappings.Key{Device: remote.PrivateName, Service: published.ID})
			if !open {
				continue
			}
			items = append(items, map[string]any{
				"device": remote.Name, "privateName": remote.PrivateName, "service": published.ID,
				"url": url, "connections": refs,
			})
		}
	}
	return map[string]any{"mappings": items, "published": map[string]bool{}}, nil
}

// Server builds the control server with every read-side handler.
func (core *Core) Server() control.Server {
	return control.Server{
		Logger:       core.logger,
		OpenMapping:  core.OpenMapping,
		CloseMapping: core.CloseMapping,
		Shutdown: func() error {
			return errors.Join(core.session.Suspend(), core.node.Close())
		},
		AuthStart: func(ctx context.Context) (any, error) {
			auth, err := core.authController()
			if err != nil {
				return nil, err
			}
			authContext, cancel := context.WithTimeout(ctx, 4*time.Second)
			defer cancel()
			state, err := auth.StartInteractive(authContext)
			if err != nil {
				core.journal.Record("error", "auth", fmt.Sprintf("interactive login failed: %v", err))
			} else {
				core.journal.Record("info", "auth", fmt.Sprintf("login state=%s", state.State))
			}
			return state, err
		},
		AuthReconnect: func(ctx context.Context) (any, error) {
			auth, err := core.authController()
			if err != nil {
				return nil, err
			}
			client, err := core.node.LocalClient()
			if err != nil {
				return nil, err
			}
			recheckContext, cancel := context.WithTimeout(ctx, 12*time.Second)
			defer cancel()
			state, err := auth.Recheck(recheckContext, func(ctx context.Context) error { return client.Start(ctx, ipn.Options{}) })
			if err != nil {
				core.journal.Record("error", "auth", fmt.Sprintf("re-check failed: %v", err))
				return state, err
			}
			if state.State == velanetwork.StateNeedsAuth {
				core.journal.Record("warn", "auth", "this device is no longer on the tailnet; sign in again")
			} else {
				core.journal.Record("info", "auth", fmt.Sprintf("re-check state=%s", state.State))
			}
			return state, nil
		},
		AuthLogout: func(ctx context.Context) (any, error) {
			auth, err := core.authController()
			if err != nil {
				return nil, err
			}
			if err := core.session.Suspend(); err != nil {
				return nil, err
			}
			core.journal.Record("info", "auth", "signed out")
			return auth.Logout(ctx)
		},
		Status: core.Status,
		PreferencesSet: func(raw json.RawMessage) (any, error) {
			var selection velaconfig.Preferences
			if err := json.Unmarshal(raw, &selection); err != nil {
				return nil, err
			}
			if !velaconfig.ValidAppearance(selection.Appearance) {
				return nil, errors.New("appearance must be system, light or dark")
			}
			if err := core.store.Update(func(config *velaconfig.Config) error { config.Preferences = selection; return nil }); err != nil {
				return nil, err
			}
			core.journal.Record("info", "preferences", fmt.Sprintf("appearance=%s hud=%t verbose=%t gravatar=%t", selection.Appearance, selection.PerformanceHUD, selection.VerboseLogs, selection.GravatarAvatar))
			return core.store.Snapshot().Preferences, nil
		},
		DiagnosticLogs: func() (any, error) {
			return map[string]any{"entries": core.journal.Entries()}, nil
		},
		DiagnosticActivity: core.DiagnosticActivity,
		DeviceUpdate: func(ctx context.Context, name string) (any, error) {
			name = strings.TrimSpace(name)
			if !ValidHostname(name) {
				return nil, errors.New("device name must be a valid Tailscale hostname")
			}
			client, err := core.node.LocalClient()
			if err != nil {
				return nil, err
			}
			if _, err := client.EditPrefs(ctx, &ipn.MaskedPrefs{Prefs: ipn.Prefs{Hostname: name}, HostnameSet: true}); err != nil {
				core.journal.Record("error", "device", fmt.Sprintf("rename to %q failed: %v", name, err))
				return nil, fmt.Errorf("update Tailscale device name: %w", err)
			}
			if err := core.store.Update(func(config *velaconfig.Config) error { config.DeviceName = name; return nil }); err != nil {
				core.journal.Record("error", "device", fmt.Sprintf("save device name failed: %v", err))
				return nil, err
			}
			core.journal.Record("info", "device", fmt.Sprintf("renamed to %q", name))
			return map[string]any{"deviceName": name}, nil
		},
		Remotes: func() (any, error) { return core.remoteSnapshot(), nil },
		RemoteRefresh: func(ctx context.Context) (any, error) {
			return core.RefreshRemotes(ctx), nil
		},
		RemoteAdd: func(ctx context.Context, name string) (any, error) {
			if _, err := core.registry.Add(ctx, name); err != nil {
				return nil, err
			}
			return core.remoteSnapshot(), nil
		},
		RemoteRemove: func(name string) error {
			if err := core.registry.Remove(name); err != nil {
				return err
			}
			for _, key := range core.session.Keys() {
				if key.Device == name {
					_ = core.session.Close(key)
				}
			}
			return nil
		},
	}
}

func (core *Core) authController() (*velanetwork.AuthController, error) {
	client, err := core.node.LocalClient()
	if err != nil {
		return nil, err
	}
	return &velanetwork.AuthController{Client: client}, nil
}

func resolveRemoteService(checker ManifestChecker, device, serviceID string) (manifest.Service, bool) {
	state, ok := checker.State(device)
	if !ok || state.Err != nil {
		return manifest.Service{}, false
	}
	for _, service := range state.Entry.Document.Services {
		if service.ID == serviceID {
			return service, true
		}
	}
	return manifest.Service{}, false
}

// ServicesFor returns the published services of one device, for tests and
// diagnostics.
func (core *Core) ServicesFor(device string) []manifest.Service {
	state, ok := core.checker.State(device)
	if !ok || state.Err != nil {
		return []manifest.Service{}
	}
	return slices.Clone(state.Entry.Document.Services)
}
