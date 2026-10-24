package remotes

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/thonatos/vela/core/internal/manifest"
	"github.com/thonatos/vela/core/internal/remoteclient"
)

// ManifestState is the most recent handshake result for one saved Mac.
type ManifestState struct {
	Entry   remoteclient.Entry
	Err     error
	Checked bool
}

// ManifestChecker validates peers through Vela's control manifest over tsnet.
// It retains only status metadata; credentials and service content are never stored.
type ManifestChecker struct {
	Cache *remoteclient.Cache
	Port  int

	mu     sync.RWMutex
	states map[string]ManifestState
}

// Check implements Checker and normalizes transport failures into user-facing classes.
func (checker *ManifestChecker) Check(ctx context.Context, privateName string) (CheckResult, error) {
	if checker.Cache == nil {
		return CheckResult{}, errors.New("remote manifest client is unavailable")
	}
	port := checker.Port
	if port == 0 {
		port = manifest.ControlPort
	}
	entry, err := checker.Cache.Refresh(ctx, privateName, port)
	if err != nil {
		if cached, ok := checker.Cache.Get(privateName); ok {
			entry = cached
		}
		err = classifyManifestError(err)
		checker.remember(privateName, ManifestState{Entry: entry, Err: err, Checked: true})
		return CheckResult{}, err
	}
	checker.remember(privateName, ManifestState{Entry: entry, Checked: true})
	return CheckResult{DeviceName: entry.Document.Device, ProtocolVersion: entry.Document.Version}, nil
}

// State returns a detached copy of the latest handshake state.
func (checker *ManifestChecker) State(privateName string) (ManifestState, bool) {
	checker.mu.RLock()
	defer checker.mu.RUnlock()
	state, ok := checker.states[privateName]
	state.Entry.Document.Services = append([]manifest.Service(nil), state.Entry.Document.Services...)
	return state, ok
}

func (checker *ManifestChecker) remember(privateName string, state ManifestState) {
	checker.mu.Lock()
	defer checker.mu.Unlock()
	if checker.states == nil {
		checker.states = map[string]ManifestState{}
	}
	checker.states[privateName] = state
}

func classifyManifestError(err error) error {
	switch {
	case errors.Is(err, remoteclient.ErrIncompatible):
		return ErrIncompatibleProtocol
	case errors.Is(err, remoteclient.ErrUnauthorized):
		return ErrUnauthorized
	default:
		return fmt.Errorf("%w: %v", ErrOffline, err)
	}
}
