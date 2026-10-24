// Command mobile is Vela's iOS Core, built as a Go c-archive and linked into
// the Rust staticlib. It exposes the same JSON Lines control protocol as the
// macOS helper, but runs it over io.Pipe instead of stdin/stdout.
package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"
	"time"
	"unsafe"

	"implements.io/vela/internal/buildinfo"
	velaconfig "implements.io/vela/internal/config"
	"implements.io/vela/internal/core"
	"implements.io/vela/internal/iosabi"
	velanetwork "implements.io/vela/internal/network"
	velapaths "implements.io/vela/internal/paths"
	"tailscale.com/ipn"
)

var global struct {
	mu     sync.Mutex
	core   *core.Core
	bridge *iosabi.Bridge
	node   *velanetwork.Embedded
}

func main() {}

//export vela_core_start
func vela_core_start(supportDir, deviceName *C.char) *C.char {
	global.mu.Lock()
	defer global.mu.Unlock()
	if global.bridge != nil {
		return C.CString("Vela core is already running")
	}
	applicationSupport := C.GoString(supportDir)
	if strings.TrimSpace(applicationSupport) == "" {
		return C.CString("Vela core needs the app's Application Support directory")
	}
	paths := velapaths.FromApplicationSupport(applicationSupport)
	store, err := velaconfig.Open(paths.Config)
	if err != nil {
		return C.CString("open Vela configuration: " + err.Error())
	}
	// iOS reports "localhost" from os.Hostname(); the Rust host passes
	// UIDevice.name instead. Keep a name the user chose in the app.
	if name := strings.TrimSpace(C.GoString(deviceName)); name != "" {
		current := strings.TrimSpace(store.Snapshot().DeviceName)
		if current == "" || strings.EqualFold(current, "localhost") || strings.EqualFold(current, "iphone") {
			if err := store.Update(func(config *velaconfig.Config) error { config.DeviceName = name; return nil }); err != nil {
				return C.CString("save Vela device name: " + err.Error())
			}
		}
	}
	logger := log.New(os.Stderr, buildinfo.Name+": ", log.LstdFlags)
	node := velanetwork.NewEmbedded(paths.NetworkState, store.Snapshot().DeviceName)
	retries := 3
	readCore, err := core.New(core.Options{
		Paths:         paths,
		Node:          node,
		Store:         store,
		Logger:        logger,
		Address:       "127.0.0.1",
		Avatar:        true,
		RetryAttempts: &retries,
	})
	if err != nil {
		return C.CString("start Vela core: " + err.Error())
	}
	// Bring the userspace node up in the background: the first launch needs
	// interactive login, which must not block the C ABI call that starts the
	// UI. The stored device name becomes the tailnet hostname even when an
	// earlier install persisted "localhost" from os.Hostname().
	hostname := store.Snapshot().DeviceName
	go func() {
		if err := node.Start(); err != nil {
			logger.Printf("private network start: %v", err)
			return
		}
		if strings.TrimSpace(hostname) == "" {
			return
		}
		client, err := node.LocalClient()
		if err != nil {
			logger.Printf("private network client: %v", err)
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := client.EditPrefs(ctx, &ipn.MaskedPrefs{Prefs: ipn.Prefs{Hostname: hostname}, HostnameSet: true}); err != nil {
			logger.Printf("apply device name: %v", err)
		}
	}()
	global.core = readCore
	global.node = node
	global.bridge = iosabi.NewBridge(readCore, logger)
	return nil
}

//export vela_core_stop
func vela_core_stop() {
	global.mu.Lock()
	bridge, core := global.bridge, global.core
	global.bridge, global.core, global.node = nil, nil, nil
	global.mu.Unlock()
	if bridge != nil {
		bridge.Close()
	}
	if core != nil {
		_ = core.Close()
	}
}

//export vela_core_request
func vela_core_request(kind, payload *C.char) *C.char {
	global.mu.Lock()
	bridge := global.bridge
	global.mu.Unlock()
	if bridge == nil {
		return C.CString(`{"version":1,"type":"error","payload":{"code":"not_started","message":"Vela core is not running","retryable":false}}`)
	}
	response, err := bridge.RequestJSON(C.GoString(kind), C.GoString(payload))
	if err != nil {
		return C.CString(`{"version":1,"type":"error","payload":{"code":"control_failed","message":` + quote(err.Error()) + `,"retryable":false}}`)
	}
	return C.CString(response)
}

//export vela_core_drain_events
func vela_core_drain_events() *C.char {
	global.mu.Lock()
	bridge := global.bridge
	global.mu.Unlock()
	if bridge == nil {
		return C.CString("[]")
	}
	return C.CString(bridge.DrainEvents())
}

//export vela_core_open_external
func vela_core_open_external(url *C.char) C.int {
	value := strings.TrimSpace(C.GoString(url))
	if !strings.HasPrefix(value, "https://") && !strings.HasPrefix(value, "http://") {
		return 0
	}
	global.mu.Lock()
	bridge := global.bridge
	global.mu.Unlock()
	if bridge == nil {
		return 0
	}
	// UIKit is not reachable from Go. Queue the intent for the Rust host,
	// which drains events and opens it with UIApplication.
	bridge.QueueEvent("open_external", map[string]string{"url": value})
	return 1
}

//export vela_core_set_signing_expiry
func vela_core_set_signing_expiry(value *C.char) {
	global.mu.Lock()
	core := global.core
	global.mu.Unlock()
	if core != nil {
		core.SetSigningExpiry(C.GoString(value))
	}
}

//export vela_core_free
func vela_core_free(value *C.char) {
	C.free(unsafe.Pointer(value))
}

// vela_core_suspend closes every loopback listener for the background scene.

//export vela_core_suspend
func vela_core_suspend() {
	global.mu.Lock()
	core := global.core
	global.mu.Unlock()
	if core != nil {
		_ = core.Suspend()
	}
}

// vela_core_resume rebuilds the listeners at their remembered ports.

//export vela_core_resume
func vela_core_resume() C.int {
	global.mu.Lock()
	core := global.core
	global.mu.Unlock()
	if core == nil {
		return 0
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := core.Resume(ctx); err != nil {
		return 0
	}
	return 1
}

func quote(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return `"` + strings.ReplaceAll(err.Error(), `"`, `\"`) + `"`
	}
	return string(encoded)
}
