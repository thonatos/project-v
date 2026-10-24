// Command vela-core is the macOS helper: it wires the shared read-side Core to
// the macOS publishing layer and serves the JSON Lines control protocol on
// stdin/stdout.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/thonatos/vela/core/internal/app"
	"github.com/thonatos/vela/core/internal/buildinfo"
	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/diagnostics"
	velanetwork "github.com/thonatos/vela/core/internal/network"
	velapaths "github.com/thonatos/vela/core/internal/paths"
	"github.com/thonatos/vela/core/internal/protocol"
	"github.com/thonatos/vela/core/internal/vela"
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
	journal := diagnostics.NewJournal(300)
	journal.Record("info", "core", fmt.Sprintf("%s started with control protocol v%d", buildinfo.Name, protocol.Version))
	node := velanetwork.NewEmbedded(paths.NetworkState, store.Snapshot().DeviceName)

	// macOS answers mapping.open from its cached manifest: a service that was
	// never published is reported immediately instead of being refreshed.
	noRefresh := 0
	core, err := vela.New(vela.Options{
		Paths:         paths,
		Node:          node,
		Store:         store,
		Journal:       journal,
		Logger:        logger,
		RetryAttempts: &noRefresh,
	})
	if err != nil {
		logger.Printf("start core: %v", err)
		os.Exit(1)
	}
	application := app.New(app.Options{
		Core:    core,
		Store:   store,
		Node:    node,
		Journal: journal,
		Logger:  logger,
		Home:    home,
	})

	server := application.Server()
	server.In, server.Out, server.Logger = os.Stdin, os.Stdout, logger
	if err := server.Run(context.Background()); err != nil {
		logger.Printf("control loop failed: %v", err)
		os.Exit(1)
	}
}
