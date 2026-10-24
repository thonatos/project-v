// Package app composes the macOS Core on top of the shared read-side Core:
// local service probing, manifest publication, sharing choices and the
// service editor. Nothing here is used by the iOS client.
package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/thonatos/vela/core/internal/adapters"
	"github.com/thonatos/vela/core/internal/authorization"
	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/control"
	"github.com/thonatos/vela/core/internal/diagnostics"
	"github.com/thonatos/vela/core/internal/dshauth"
	"github.com/thonatos/vela/core/internal/network"
	"github.com/thonatos/vela/core/internal/publication"
	"github.com/thonatos/vela/core/internal/services"
	"github.com/thonatos/vela/core/internal/vela"
)

// Node is the embedded network node. Publication needs to open tailnet
// listeners, which a read-only client never does.
type Node interface {
	vela.Node
	Listen(network, address string) (net.Listener, error)
}

// Options wires the macOS layer to the shared core and the embedded node.
type Options struct {
	Core    *vela.Core
	Store   *velaconfig.Store
	Node    Node
	Journal *diagnostics.Journal
	Logger  *log.Logger
	// Home expands user-relative paths written by the service editor.
	Home string
}

// App owns the macOS-only capabilities: probing, publishing and sharing.
type App struct {
	core         *vela.Core
	store        *velaconfig.Store
	journal      *diagnostics.Journal
	logger       *log.Logger
	home         string
	prober       *services.Prober
	publications *publication.Runtime

	dshLaunchMu    sync.Mutex
	dshLaunchState map[string]string
}

// New builds the macOS layer. The node and the store are shared with Core so
// the same identity and configuration are never opened twice.
func New(options Options) *App {
	logger := options.Logger
	if logger == nil {
		logger = log.New(discardWriter{}, "", 0)
	}
	journ := options.Journal
	if journ == nil {
		journ = diagnostics.NewJournal(300)
	}
	node := options.Node
	app := &App{
		core:           options.Core,
		store:          options.Store,
		journal:        journ,
		logger:         logger,
		home:           options.Home,
		prober:         services.NewProber(),
		dshLaunchState: map[string]string{},
	}
	app.publications = publication.New(node, func(ctx context.Context) (authorization.Authorizer, error) {
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
	app.publications.WithLaunchPath(func(service velaconfig.LocalService) string {
		path, _ := app.dshLaunch(service)
		return path
	})
	return app
}

// Server builds the control server: the shared read-side handlers plus the
// macOS service, sharing and status handlers.
func (app *App) Server() control.Server {
	server := app.core.Server()
	server.Status = app.status
	server.Services = app.services
	server.ServiceUpsert = app.serviceUpsert
	server.ServiceRemove = app.serviceRemove
	server.SharingGet = func() (any, error) { return app.store.Snapshot().Sharing, nil }
	server.SharingSet = app.setSharing
	server.DiagnosticActivity = app.diagnosticActivity
	server.Shutdown = func() error {
		return errors.Join(app.publications.Close(), app.core.Close())
	}
	return server
}

// status is the macOS snapshot: the read-side payload plus probed services and
// the sharing choice. Reconciling here is deliberate: a status request is the
// moment the UI expects publication state to be current.
func (app *App) status(ctx context.Context) (any, error) {
	items, _, err := app.reconcile(ctx)
	snapshot, snapshotErr := app.core.Status(ctx)
	if snapshot == nil {
		return nil, errors.Join(err, snapshotErr)
	}
	payload := snapshot.(map[string]any)
	payload["services"] = items
	payload["sharing"] = app.store.Snapshot().Sharing
	return payload, errors.Join(err, snapshotErr)
}

func (app *App) services(ctx context.Context) (any, error) {
	items, _, err := app.reconcile(ctx)
	if err != nil {
		app.logger.Printf("refresh service publication: %v", err)
	}
	return items, nil
}

// diagnosticActivity adds the published service set to the shared mapping
// snapshot. Only macOS publishes.
func (app *App) diagnosticActivity() (any, error) {
	payload, err := app.core.DiagnosticActivity()
	if err != nil {
		return nil, err
	}
	mapping := payload.(map[string]any)
	published := map[string]bool{}
	for id, value := range app.publications.Published() {
		published[id] = value
	}
	mapping["published"] = published
	return mapping, nil
}

// reconcile probes local services, reads the network state and applies the
// sharing selection to the tailnet manifest.
func (app *App) reconcile(ctx context.Context) ([]ServiceItem, network.AuthState, error) {
	items, health := app.probeServices(ctx)
	state, statusErr := app.core.AuthStatus(ctx)
	config := app.store.Snapshot()
	deviceName := config.DeviceName
	if state.Hostname != "" {
		deviceName = state.Hostname
	}
	reconcileErr := app.publications.Reconcile(ctx, state.State == network.StateConnected, config.Sharing.Enabled, config.Services, health, deviceName)
	if statusErr != nil {
		app.journal.Record("error", "network", fmt.Sprintf("status check failed: %v", statusErr))
	}
	if reconcileErr != nil {
		app.journal.Record("error", "sharing", fmt.Sprintf("publish services failed: %v", reconcileErr))
	}
	for id, value := range health {
		if value != services.StateAvailable {
			app.journal.Record("warn", "service", fmt.Sprintf("%s is %s", id, value))
		}
	}
	return items, state, errors.Join(statusErr, reconcileErr)
}

// ServiceItem is one local service as the desktop UI reads it. JSON keys match
// the control protocol; optional DSH fields appear only when configured.
type ServiceItem struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Protocol string         `json:"protocol"`
	Preset   string         `json:"preset"`
	URL      string         `json:"url"`
	Port     int            `json:"port"`
	Adapter  string         `json:"adapter"`
	State    services.State `json:"state"`
	Shared   bool           `json:"shared"`
	AuthLog  string         `json:"authLog,omitempty"`
	AuthLink string         `json:"authLink,omitempty"`
}

func (app *App) probeServices(ctx context.Context) ([]ServiceItem, map[string]services.State) {
	config := app.store.Snapshot()
	items := make([]ServiceItem, 0, len(config.Services))
	health := make(map[string]services.State, len(config.Services))
	for _, service := range config.Services {
		result := app.prober.Probe(ctx, services.Service{ID: service.ID, Name: service.Name, Protocol: service.Protocol, URL: service.URL, Timeout: 2 * time.Second})
		health[service.ID] = result.State
		item := ServiceItem{
			ID: service.ID, Name: service.Name, Protocol: service.Protocol, Preset: service.Preset,
			URL: service.URL, Port: service.Port, Adapter: service.Adapter, State: result.State, Shared: service.Shared,
		}
		if service.AuthLog != "" {
			_, link := app.dshLaunch(service)
			item.AuthLog, item.AuthLink = service.AuthLog, link
		}
		items = append(items, item)
	}
	return items, health
}

// dshLaunch reads DSH's current launch path from its output log at manifest
// time. Only the outcome is journaled, once per change, never the token.
func (app *App) dshLaunch(service velaconfig.LocalService) (string, string) {
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
	app.dshLaunchMu.Lock()
	changed := app.dshLaunchState[service.ID] != state
	app.dshLaunchState[service.ID] = state
	app.dshLaunchMu.Unlock()
	if changed {
		if err != nil {
			app.journal.Record("warn", "service", fmt.Sprintf("%s sign-in link unavailable: %v", service.ID, err))
		} else {
			app.journal.Record("info", "service", fmt.Sprintf("%s sign-in link is published", service.ID))
		}
	}
	return path, state
}

type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
