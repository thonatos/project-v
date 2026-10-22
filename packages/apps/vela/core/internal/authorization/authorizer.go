// Package authorization gates local-service connections using Tailscale identity.
package authorization

import (
	"context"
	"errors"

	"tailscale.com/client/tailscale/apitype"
)

// Resolver is implemented by tsnet's local client.
type Resolver interface {
	WhoIs(context.Context, string) (*apitype.WhoIsResponse, error)
}

// Policy allows the current user by default and optional explicit device IDs.
type Policy struct {
	OwnerLogin     string
	AllowedDevices map[string]bool
}

// Identity is the authorized caller metadata exposed to the connection handler.
type Identity struct {
	LoginName string
	DeviceID  string
}

// ErrDenied means no local target may be opened.
var ErrDenied = errors.New("remote Vela device is not authorized")

// Authorizer resolves and checks identity before invoking the target opener.
type Authorizer struct {
	Resolver Resolver
	Policy   Policy
}

// Authorize returns caller identity only when the user or device policy allows it.
func (authorizer Authorizer) Authorize(ctx context.Context, remoteAddr string) (Identity, error) {
	response, err := authorizer.Resolver.WhoIs(ctx, remoteAddr)
	if err != nil || response == nil || response.Node == nil || response.UserProfile == nil {
		return Identity{}, ErrDenied
	}
	identity := Identity{LoginName: response.UserProfile.LoginName, DeviceID: string(response.Node.StableID)}
	if identity.LoginName == authorizer.Policy.OwnerLogin || authorizer.Policy.AllowedDevices[identity.DeviceID] {
		return identity, nil
	}
	return Identity{}, ErrDenied
}

// OpenAuthorized invokes open only after Authorize succeeds.
func (authorizer Authorizer) OpenAuthorized(ctx context.Context, remoteAddr string, open func(Identity) error) error {
	identity, err := authorizer.Authorize(ctx, remoteAddr)
	if err != nil {
		return err
	}
	return open(identity)
}
