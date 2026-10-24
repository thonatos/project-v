// Command vela-core provides Vela's private networking helper process.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/thonatos/project-v/vela/core/internal/adapters"
	"github.com/thonatos/project-v/vela/core/internal/authorization"
	"github.com/thonatos/project-v/vela/core/internal/buildinfo"
	velaconfig "github.com/thonatos/project-v/vela/core/internal/config"
	"github.com/thonatos/project-v/vela/core/internal/control"
	"github.com/thonatos/project-v/vela/core/internal/diagnostics"
	"github.com/thonatos/project-v/vela/core/internal/dshauth"
	"github.com/thonatos/project-v/vela/core/internal/manifest"
	"github.com/thonatos/project-v/vela/core/internal/mappings"
	velanetwork "github.com/thonatos/project-v/vela/core/internal/network"
	velapaths "github.com/thonatos/project-v/vela/core/internal/paths"
	"github.com/thonatos/project-v/vela/core/internal/protocol"
	"github.com/thonatos/project-v/vela/core/internal/publication"
	"github.com/thonatos/project-v/vela/core/internal/remoteclient"
	"github.com/thonatos/project-v/vela/core/internal/remotes"
	"github.com/thonatos/project-v/vela/core/internal/services"
	"tailscale.com/ipn"
)

func main() {
	logger := log.New(os.Stderr, buildinfo.Name+": ", log.LstdFlags)
	home, err := os.UserHomeDir()
	if err != nil {
		logger.Printf("resolve home directory: %v", err)
		os.Exit(1)
	}
	paths := velapaths.FromHome(home)
	store, err := velaconfig.Open(paths.Config)
	if err != nil {
		logger.Printf("open configuration: %v", err)
		os.Exit(1)
	}
	node := velanetwork.NewEmbedded(paths.NetworkState, store.Snapshot().DeviceName)
	authController := func() (*velanetwork.AuthController, error) {
		client, err := node.LocalClient()
		if err != nil {
			return nil, err
		}
		return &velanetwork.AuthController{Client: client}, nil
	}
	manifestTransport := &http.Transport{DialContext: node.Dial, ForceAttemptHTTP2: false}
	defer manifestTransport.CloseIdleConnections()
	journal := diagnostics.NewJournal(300)
	journal.Record("info", "core", fmt.Sprintf("%s started with control protocol v%d", buildinfo.Name, protocol.Version))
	remoteChecker := &remotes.ManifestChecker{Cache: remoteclient.New(&http.Client{Transport: manifestTransport, Timeout: 4 * time.Second})}
	remoteRegistry := remotes.Registry{Store: store, Checker: remoteChecker}
	resolveRemoteService := func(device, serviceID string) (manifest.Service, bool) {
		entry, ok := remoteChecker.State(device)
		if !ok || entry.Err != nil {
			return manifest.Service{}, false
		}
		for _, service := range entry.Entry.Document.Services {
			if service.ID == serviceID {
				return service, true
			}
		}
		return manifest.Service{}, false
	}
	resolveRemotePort := func(device, serviceID string) (int, bool) {
		service, ok := resolveRemoteService(device, serviceID)
		return service.Port, ok
	}
	resolveRemoteProtocol := func(key mappings.Key) string {
		service, _ := resolveRemoteService(key.Device, key.Service)
		return service.Protocol
	}
	manager := mappings.New(mappings.RemoteDial(node, resolveRemotePort)).WithProtocols(resolveRemoteProtocol).WithStablePorts(
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
	// dshLaunch reads DSH's current launch path from its output log at manifest
	// time. Only the outcome is journaled, once per change, never the token.
	var dshLaunchMu sync.Mutex
	dshLaunchState := map[string]string{}
	dshLaunch := func(service velaconfig.LocalService) (string, string) {
		if service.Adapter != string(adapters.DSH) || service.AuthLog == "" {
			return "", ""
		}
		path, err := dshauth.LaunchPath(service.AuthLog, service.URL)
		state := "ready"
		switch {
		case errors.Is(err, dshauth.ErrNotFound):
			state = "missing"
		case err != nil:
			state = "unreadable"
		}
		dshLaunchMu.Lock()
		changed := dshLaunchState[service.ID] != state
		dshLaunchState[service.ID] = state
		dshLaunchMu.Unlock()
		if changed {
			if err != nil {
				journal.Record("warn", "service", fmt.Sprintf("%s sign-in link unavailable: %v", service.ID, err))
			} else {
				journal.Record("info", "service", fmt.Sprintf("%s sign-in link is published", service.ID))
			}
		}
		return path, state
	}
	prober := services.NewProber()
	probeServices := func(ctx context.Context) ([]map[string]any, map[string]services.State) {
		config := store.Snapshot()
		items := make([]map[string]any, 0, len(config.Services))
		health := make(map[string]services.State, len(config.Services))
		for _, service := range config.Services {
			result := prober.Probe(ctx, services.Service{ID: service.ID, Name: service.Name, Protocol: service.Protocol, URL: service.URL, Timeout: 2 * time.Second})
			health[service.ID] = result.State
			item := map[string]any{"id": service.ID, "name": service.Name, "protocol": service.Protocol, "preset": service.Preset, "url": service.URL, "port": service.Port, "adapter": service.Adapter, "state": result.State, "shared": service.Shared}
			if service.AuthLog != "" {
				_, link := dshLaunch(service)
				item["authLog"], item["authLink"] = service.AuthLog, link
			}
			items = append(items, item)
		}
		return items, health
	}
	publications := publication.New(node, func(ctx context.Context) (authorization.Authorizer, error) {
		client, err := node.LocalClient()
		if err != nil {
			return authorization.Authorizer{}, err
		}
		status, err := client.Status(ctx)
		if err != nil {
			return authorization.Authorizer{}, err
		}
		if status.Self == nil {
			return authorization.Authorizer{}, errors.New("private network identity is unavailable")
		}
		owner, ok := status.User[status.Self.UserID]
		if !ok || owner.LoginName == "" {
			return authorization.Authorizer{}, errors.New("private network owner is unavailable")
		}
		return authorization.Authorizer{Resolver: client, Policy: authorization.Policy{OwnerLogin: owner.LoginName, AllowedDevices: map[string]bool{}}}, nil
	})
	publications.WithLaunchPath(func(service velaconfig.LocalService) string {
		path, _ := dshLaunch(service)
		return path
	})
	networkAndDevice := func(ctx context.Context) (velanetwork.AuthState, error) {
		auth, err := authController()
		if err != nil {
			return velanetwork.AuthState{State: velanetwork.StateOffline}, err
		}
		return auth.Status(ctx)
	}
	reconcilePublications := func(ctx context.Context) ([]map[string]any, velanetwork.AuthState, error) {
		items, health := probeServices(ctx)
		state, statusErr := networkAndDevice(ctx)
		config := store.Snapshot()
		deviceName := config.DeviceName
		if state.Hostname != "" {
			deviceName = state.Hostname
		}
		reconcileErr := publications.Reconcile(ctx, state.State == velanetwork.StateConnected, config.Sharing.Enabled, config.Services, health, deviceName)
		if statusErr != nil {
			journal.Record("error", "network", fmt.Sprintf("status check failed: %v", statusErr))
		}
		if reconcileErr != nil {
			journal.Record("error", "sharing", fmt.Sprintf("publish services failed: %v", reconcileErr))
		}
		for id, value := range health {
			if value != services.StateAvailable {
				journal.Record("warn", "service", fmt.Sprintf("%s is %s", id, value))
			}
		}
		return items, state, errors.Join(statusErr, reconcileErr)
	}
	remoteAddresses := func(ctx context.Context) map[string][]string {
		addresses := map[string][]string{}
		client, err := node.LocalClient()
		if err != nil {
			return addresses
		}
		status, err := client.Status(ctx)
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
	remoteSnapshot := func(ctx context.Context) []map[string]any {
		configured := store.Snapshot().Remotes
		addresses := remoteAddresses(ctx)
		items := make([]map[string]any, 0, len(configured))
		for _, remote := range configured {
			item := map[string]any{
				"name": remote.Name, "privateName": remote.PrivateName, "lastConnectedUtc": remote.LastConnectedUTC,
				"connection": "offline", "compatible": true, "issue": "offline", "services": []manifest.Service{},
				"ips": addresses[remote.PrivateName],
			}
			if item["ips"] == nil {
				item["ips"] = []string{}
			}
			if state, ok := remoteChecker.State(remote.PrivateName); ok && state.Checked {
				switch {
				case state.Err == nil:
					item["connection"] = "connected"
					item["issue"] = ""
					item["services"] = state.Entry.Document.Services
				case errors.Is(state.Err, remotes.ErrIncompatibleProtocol):
					item["compatible"] = false
					item["issue"] = "incompatible"
				case errors.Is(state.Err, remotes.ErrUnauthorized):
					item["issue"] = "unauthorized"
				}
			}
			items = append(items, item)
		}
		return items
	}
	refreshRemotes := func(ctx context.Context) []map[string]any {
		configured := store.Snapshot().Remotes
		var group sync.WaitGroup
		for _, remote := range configured {
			privateName := remote.PrivateName
			group.Add(1)
			go func() {
				defer group.Done()
				if _, err := remoteRegistry.Refresh(ctx, privateName); err != nil {
					journal.Record("error", "remote", fmt.Sprintf("%s refresh failed: %v", privateName, err))
					return
				}
				journal.Record("info", "remote", fmt.Sprintf("%s refreshed", privateName))
			}()
		}
		group.Wait()
		return remoteSnapshot(ctx)
	}
	if target := os.Getenv("VELA_MAPPING_TEST_TARGET"); target != "" {
		manager = mappings.New(func(ctx context.Context, _ mappings.Key) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "tcp", target)
		}).WithProtocols(resolveRemoteProtocol)
	}
	server := control.Server{
		In: os.Stdin, Out: os.Stdout, Logger: logger,
		OpenMapping: func(ctx context.Context, device, service string) (string, error) {
			published, ok := resolveRemoteService(device, service)
			if !ok {
				journal.Record("error", "mapping", fmt.Sprintf("%s/%s is not currently published", device, service))
				return "", errors.New("remote service is not currently published")
			}
			if published.Adapter == string(adapters.DSH) {
				// DSH issues a new launch token whenever it restarts, so fetch the
				// current one; a failed refresh keeps the cached manifest.
				if _, err := remoteChecker.Check(ctx, device); err == nil {
					if fresh, ok := resolveRemoteService(device, service); ok {
						published = fresh
					}
				}
			}
			base, err := manager.Open(ctx, mappings.Key{Device: device, Service: service})
			if err != nil {
				journal.Record("error", "mapping", fmt.Sprintf("open %s/%s failed: %v", device, service, err))
				return "", err
			}
			journal.Record("info", "mapping", fmt.Sprintf("opened %s/%s", device, service))
			if published.Protocol != manifest.ProtocolTCP && published.Path != "" && published.Path != "/" {
				return strings.TrimSuffix(base, "/") + published.Path, nil
			}
			return base, nil
		},
		CloseMapping: func(device, service string) error {
			journal.Record("info", "mapping", fmt.Sprintf("closed %s/%s", device, service))
			return manager.Close(mappings.Key{Device: device, Service: service})
		},
		Shutdown: func() error {
			return errors.Join(publications.Close(), manager.CloseAll(), node.Close())
		},
		AuthStart: func(ctx context.Context) (any, error) {
			auth, err := authController()
			if err != nil {
				return nil, err
			}
			authContext, cancel := context.WithTimeout(ctx, 4*time.Second)
			defer cancel()
			state, err := auth.StartInteractive(authContext)
			if err != nil {
				journal.Record("error", "auth", fmt.Sprintf("interactive login failed: %v", err))
			} else {
				journal.Record("info", "auth", fmt.Sprintf("login state=%s", state.State))
			}
			if err == nil && state.State == velanetwork.StateConnected {
				_, _, err = reconcilePublications(ctx)
			}
			return state, err
		},
		AuthReconnect: func(ctx context.Context) (any, error) {
			// "Re-check" makes the node log in to control again instead of
			// trusting its cached "Running": a device removed in the admin
			// console is only found out by a fresh login.
			auth, err := authController()
			if err != nil {
				return nil, err
			}
			client, err := node.LocalClient()
			if err != nil {
				return nil, err
			}
			recheckContext, cancel := context.WithTimeout(ctx, 12*time.Second)
			defer cancel()
			state, err := auth.Recheck(recheckContext, func(ctx context.Context) error { return client.Start(ctx, ipn.Options{}) })
			if err != nil {
				journal.Record("error", "auth", fmt.Sprintf("re-check failed: %v", err))
				return state, err
			}
			if state.State == velanetwork.StateNeedsAuth {
				journal.Record("warn", "auth", "this device is no longer on the tailnet; sign in again")
			} else {
				journal.Record("info", "auth", fmt.Sprintf("re-check state=%s", state.State))
			}
			_, _, _ = reconcilePublications(ctx)
			return state, nil
		},
		AuthLogout: func(ctx context.Context) (any, error) {
			auth, err := authController()
			if err != nil {
				return nil, err
			}
			if err := publications.Close(); err != nil {
				return nil, err
			}
			journal.Record("info", "auth", "signed out and stopped sharing")
			return auth.Logout(ctx)
		},
		Status: func(ctx context.Context) (any, error) {
			config := store.Snapshot()
			serviceItems, state, _ := reconcilePublications(ctx)
			deviceName := config.DeviceName
			var self any = map[string]any{"name": deviceName, "ips": []string{}, "backend": string(state.State)}
			var peers any = []velanetwork.DeviceInfo{}
			if client, err := node.LocalClient(); err == nil {
				if status, err := client.Status(ctx); err == nil {
					local, visible := velanetwork.Snapshot(status)
					self, peers = local, visible
					if local.Name != "" {
						deviceName = local.Name
					}
				}
			}
			return map[string]any{"network": state.State, "deviceName": deviceName, "preferences": config.Preferences, "tailscale": self, "tailnetDevices": peers, "sharing": config.Sharing, "services": serviceItems, "remotes": remoteSnapshot(ctx)}, nil
		},
		PreferencesSet: func(raw json.RawMessage) (any, error) {
			var selection velaconfig.Preferences
			if err := json.Unmarshal(raw, &selection); err != nil {
				return nil, err
			}
			if !velaconfig.ValidAppearance(selection.Appearance) {
				return nil, errors.New("appearance must be system, light or dark")
			}
			if err := store.Update(func(config *velaconfig.Config) error { config.Preferences = selection; return nil }); err != nil {
				return nil, err
			}
			journal.Record("info", "preferences", fmt.Sprintf("appearance=%s hud=%t verbose=%t", selection.Appearance, selection.PerformanceHUD, selection.VerboseLogs))
			return store.Snapshot().Preferences, nil
		},
		DiagnosticLogs: func() (any, error) {
			return map[string]any{"entries": journal.Entries()}, nil
		},
		DiagnosticActivity: func() (any, error) {
			config := store.Snapshot()
			items := []map[string]any{}
			for _, remote := range config.Remotes {
				state, known := remoteChecker.State(remote.PrivateName)
				if !known {
					continue
				}
				for _, published := range state.Entry.Document.Services {
					url, refs, open := manager.Snapshot(mappings.Key{Device: remote.PrivateName, Service: published.ID})
					if !open {
						continue
					}
					items = append(items, map[string]any{
						"device": remote.Name, "privateName": remote.PrivateName, "service": published.ID,
						"url": url, "connections": refs,
					})
				}
			}
			published := map[string]bool{}
			for id, value := range publications.Published() {
				published[id] = value
			}
			return map[string]any{"mappings": items, "published": published}, nil
		},
		SharingGet: func() (any, error) { return store.Snapshot().Sharing, nil },
		SharingSet: func(raw json.RawMessage) (any, error) {
			var selection velaconfig.Sharing
			if err := json.Unmarshal(raw, &selection); err != nil {
				return nil, err
			}
			if err := store.Update(func(config *velaconfig.Config) error { config.Sharing = selection; return nil }); err != nil {
				return nil, err
			}
			if _, _, err := reconcilePublications(context.Background()); err != nil {
				logger.Printf("apply saved sharing selection: %v", err)
			}
			return selection, nil
		},
		Services: func(ctx context.Context) (any, error) {
			items, _, err := reconcilePublications(ctx)
			if err != nil {
				logger.Printf("refresh service publication: %v", err)
			}
			return items, nil
		},
		DeviceUpdate: func(ctx context.Context, name string) (any, error) {
			name = strings.TrimSpace(name)
			if len(name) > 80 {
				return nil, errors.New("device name is too long")
			}
			client, err := node.LocalClient()
			if err != nil {
				return nil, err
			}
			if _, err := client.EditPrefs(ctx, &ipn.MaskedPrefs{Prefs: ipn.Prefs{Hostname: name}, HostnameSet: true}); err != nil {
				return nil, fmt.Errorf("update Tailscale device name: %w", err)
			}
			if err := store.Update(func(config *velaconfig.Config) error { config.DeviceName = name; return nil }); err != nil {
				return nil, err
			}
			return map[string]any{"deviceName": name}, nil
		},
		ServiceUpsert: func(raw json.RawMessage) (any, error) {
			var payload struct {
				ID, Name, URL, Adapter, Protocol, Preset string
				Shared                                   bool
				// AuthLog is optional so callers that only toggle sharing keep it.
				AuthLog *string
			}
			if err := json.Unmarshal(raw, &payload); err != nil {
				return nil, err
			}
			payload.Name, payload.URL, payload.Adapter = strings.TrimSpace(payload.Name), strings.TrimSpace(payload.URL), strings.TrimSpace(payload.Adapter)
			payload.Preset = strings.ToLower(strings.TrimSpace(payload.Preset))
			payload.Protocol = strings.ToLower(strings.TrimSpace(payload.Protocol))
			if payload.Protocol == "" {
				payload.Protocol = velaconfig.ProtocolHTTP
			}
			if payload.Name == "" {
				return nil, errors.New("service name is required")
			}
			if err := services.ValidateTarget(payload.Protocol, payload.URL); err != nil {
				return nil, err
			}
			target, err := services.TargetKey(payload.Protocol, payload.URL)
			if err != nil {
				return nil, err
			}
			if payload.Adapter != "" && payload.Adapter != string(adapters.OpenCode) && payload.Adapter != string(adapters.DSH) {
				return nil, errors.New("unsupported service adapter")
			}
			if payload.Protocol == velaconfig.ProtocolTCP && payload.Adapter != "" {
				return nil, errors.New("TCP services cannot use an adapter")
			}
			validPresets := map[string]bool{"": true, "opencode": true, "dsh": true, "comfyui": true, "ssh": true, "redis": true, "mysql": true, "postgres": true}
			if !validPresets[payload.Preset] {
				return nil, errors.New("unsupported service preset")
			}
			webPreset := payload.Preset == "opencode" || payload.Preset == "dsh" || payload.Preset == "comfyui"
			tcpPreset := payload.Preset == "ssh" || payload.Preset == "redis" || payload.Preset == "mysql" || payload.Preset == "postgres"
			if (webPreset && payload.Protocol != velaconfig.ProtocolHTTP) || (tcpPreset && payload.Protocol != velaconfig.ProtocolTCP) {
				return nil, errors.New("service preset does not match protocol")
			}
			authLog := ""
			if payload.AuthLog != nil && strings.TrimSpace(*payload.AuthLog) != "" {
				if payload.Adapter != string(adapters.DSH) {
					return nil, errors.New("only DSH services can read a sign-in log")
				}
				expanded, err := dshauth.ExpandPath(*payload.AuthLog, home)
				if err != nil {
					return nil, err
				}
				authLog = expanded
			}
			if err := store.Update(func(config *velaconfig.Config) error {
				index := slices.IndexFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == payload.ID })
				if index >= 0 {
					config.Services[index].Name, config.Services[index].URL, config.Services[index].Shared = payload.Name, payload.URL, payload.Shared
					config.Services[index].Adapter, config.Services[index].Protocol, config.Services[index].Preset = payload.Adapter, payload.Protocol, payload.Preset
					if payload.AuthLog != nil {
						config.Services[index].AuthLog = authLog
					}
					if config.Services[index].Adapter != string(adapters.DSH) {
						config.Services[index].AuthLog = ""
					}
					return nil
				}
				id, port := velaconfig.NextServiceID(*config, payload.Name), velaconfig.NextServicePort(*config)
				if payload.Adapter == string(adapters.OpenCode) {
					id, port = "opencode", velaconfig.OpenCodePort
				} else if payload.Adapter == string(adapters.DSH) {
					id, port = "dsh", velaconfig.DSHPort
				}
				if conflict := slices.IndexFunc(config.Services, func(service velaconfig.LocalService) bool {
					key, err := services.TargetKey(service.Protocol, service.URL)
					return err == nil && key == target
				}); conflict >= 0 {
					return fmt.Errorf("已经有服务指向 %s（%s），请直接编辑它", target, config.Services[conflict].Name)
				}
				if port == 0 {
					return errors.New("no Vela service ports available")
				}
				if slices.ContainsFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == id || service.Port == port }) {
					return errors.New("service preset already exists")
				}
				config.Services = append(config.Services, velaconfig.LocalService{ID: id, Name: payload.Name, Protocol: payload.Protocol, Preset: payload.Preset, URL: payload.URL, Port: port, Shared: payload.Shared, Adapter: payload.Adapter, AuthLog: authLog})
				return nil
			}); err != nil {
				return nil, err
			}
			items, _, _ := reconcilePublications(context.Background())
			return items, nil
		},
		ServiceRemove: func(id string) (any, error) {
			if err := store.Update(func(config *velaconfig.Config) error {
				config.Services = slices.DeleteFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == id })
				return nil
			}); err != nil {
				return nil, err
			}
			items, _, _ := reconcilePublications(context.Background())
			return items, nil
		},
		Remotes:       func() (any, error) { return remoteSnapshot(context.Background()), nil },
		RemoteRefresh: func(ctx context.Context) (any, error) { return refreshRemotes(ctx), nil },
		RemoteAdd: func(ctx context.Context, name string) (any, error) {
			if _, err := remoteRegistry.Add(ctx, name); err != nil {
				return nil, err
			}
			return remoteSnapshot(ctx), nil
		},
		RemoteRemove: func(name string) error {
			return remoteRegistry.Remove(name)
		},
	}
	if err := server.Run(context.Background()); err != nil {
		logger.Printf("control loop failed: %v", err)
		os.Exit(1)
	}
}
