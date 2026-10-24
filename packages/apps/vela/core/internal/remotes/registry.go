// Package remotes manages user-saved Vela Macs.
package remotes

import (
	"context"
	"errors"
	"fmt"
	"net"
	"regexp"
	"slices"
	"strings"
	"time"

	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/manifest"
)

var privateNamePattern = regexp.MustCompile(`^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$`)

var (
	ErrInvalidName          = errors.New("invalid private Mac name")
	ErrOffline              = errors.New("remote Mac is offline")
	ErrUnauthorized         = errors.New("remote Mac rejected this device")
	ErrIncompatibleProtocol = errors.New("remote Mac uses an incompatible protocol")
)

// CheckResult is the minimum remote handshake needed before saving a Mac.
type CheckResult struct {
	DeviceName      string
	ProtocolVersion int
}

// Checker validates reachability, authorization and protocol compatibility.
type Checker interface {
	Check(context.Context, string) (CheckResult, error)
}

// Registry persists validated remote Macs in the Core-owned config store.
type Registry struct {
	Store   *velaconfig.Store
	Checker Checker
	Now     func() time.Time
}

// Add validates a private name and saves only a compatible, authorized peer.
func (registry Registry) Add(ctx context.Context, privateName string) (velaconfig.RemoteMac, error) {
	privateName = strings.TrimSpace(strings.ToLower(privateName))
	if !privateNamePattern.MatchString(privateName) || net.ParseIP(privateName) != nil || !strings.Contains(privateName, ".") {
		return velaconfig.RemoteMac{}, ErrInvalidName
	}
	result, err := registry.Checker.Check(ctx, privateName)
	if err != nil {
		return velaconfig.RemoteMac{}, err
	}
	if result.ProtocolVersion != manifest.Version {
		return velaconfig.RemoteMac{}, ErrIncompatibleProtocol
	}
	now := registry.Now
	if now == nil {
		now = time.Now
	}
	remote := velaconfig.RemoteMac{Name: result.DeviceName, PrivateName: privateName, LastConnectedUTC: now().UTC().Format(time.RFC3339)}
	err = registry.Store.Update(func(config *velaconfig.Config) error {
		for _, existing := range config.Remotes {
			if existing.PrivateName == privateName {
				return fmt.Errorf("remote Mac already exists: %s", privateName)
			}
		}
		config.Remotes = append(config.Remotes, remote)
		return nil
	})
	return remote, err
}

// Remove forgets one remote without changing its Vela installation.
func (registry Registry) Remove(privateName string) error {
	return registry.Store.Update(func(config *velaconfig.Config) error {
		config.Remotes = slices.DeleteFunc(config.Remotes, func(remote velaconfig.RemoteMac) bool { return remote.PrivateName == privateName })
		return nil
	})
}

// Refresh checks a saved remote and updates last-connected only on success.
func (registry Registry) Refresh(ctx context.Context, privateName string) (CheckResult, error) {
	result, err := registry.Checker.Check(ctx, privateName)
	if err != nil {
		return CheckResult{}, err
	}
	if result.ProtocolVersion != manifest.Version {
		return CheckResult{}, ErrIncompatibleProtocol
	}
	now := registry.Now
	if now == nil {
		now = time.Now
	}
	err = registry.Store.Update(func(config *velaconfig.Config) error {
		for index := range config.Remotes {
			if config.Remotes[index].PrivateName == privateName {
				config.Remotes[index].Name = result.DeviceName
				config.Remotes[index].LastConnectedUTC = now().UTC().Format(time.RFC3339)
				return nil
			}
		}
		return errors.New("remote Mac not found")
	})
	return result, err
}
