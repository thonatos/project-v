package network

import (
	"context"
	"time"

	"tailscale.com/ipn/ipnstate"
)

// AuthClient is the LocalAPI surface used by interactive authentication.
type AuthClient interface {
	Status(context.Context) (*ipnstate.Status, error)
	StartLoginInteractive(context.Context) error
	Logout(context.Context) error
}

// AuthState is safe to expose to the UI.
type AuthState struct {
	State    State  `json:"state"`
	AuthURL  string `json:"authUrl,omitempty"`
	Hostname string `json:"hostname,omitempty"`
	// online is whether control currently reports this node online; it
	// separates a fresh login from a cached "Running".
	online bool
}

// AuthController maps Tailscale backend state to Vela state.
type AuthController struct {
	Client AuthClient
	Poll   time.Duration
}

// Status returns the current persisted identity state.
func (controller AuthController) Status(ctx context.Context) (AuthState, error) {
	status, err := controller.Client.Status(ctx)
	if err != nil {
		return AuthState{State: StateOffline}, err
	}
	return mapAuthStatus(status), nil
}

// StartInteractive requests a browser login and waits briefly for its URL.
func (controller AuthController) StartInteractive(ctx context.Context) (AuthState, error) {
	if err := controller.Client.StartLoginInteractive(ctx); err != nil {
		return AuthState{State: StateOffline}, err
	}
	poll := controller.Poll
	if poll <= 0 {
		poll = 50 * time.Millisecond
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		state, err := controller.Status(ctx)
		if err == nil && (state.AuthURL != "" || state.State == StateConnected) {
			return state, nil
		}
		select {
		case <-ctx.Done():
			return AuthState{State: StateNeedsAuth}, ctx.Err()
		case <-ticker.C:
		}
	}
}

// Recheck asks control to re-authenticate the current identity and reports the
// result. A node deleted in the admin console is never told; it keeps its
// cached network map and reports Running. Restarting its control client makes
// it log in again, which control answers with a fresh auth URL when the node
// no longer exists. A healthy node simply logs back in and stays connected.
func (controller AuthController) Recheck(ctx context.Context, restart func(context.Context) error) (AuthState, error) {
	if restart != nil {
		if err := restart(ctx); err != nil {
			return controller.Status(ctx)
		}
	}
	poll := controller.Poll
	if poll <= 0 {
		poll = 250 * time.Millisecond
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	last := AuthState{State: StateConnecting}
	for {
		state, err := controller.Status(ctx)
		if err == nil {
			last = state
			// Settled: either control accepted the identity and the node is
			// back online, or it asked for a new login.
			if state.State == StateNeedsAuth || (state.State == StateConnected && state.online) {
				return state, nil
			}
		}
		select {
		case <-ctx.Done():
			// Out of time without a verdict: report what was last seen
			// rather than guessing a removal.
			return last, nil
		case <-ticker.C:
		}
	}
}

// Logout revokes the local profile and returns needs-auth.
func (controller AuthController) Logout(ctx context.Context) (AuthState, error) {
	if err := controller.Client.Logout(ctx); err != nil {
		return AuthState{State: StateOffline}, err
	}
	return AuthState{State: StateNeedsAuth}, nil
}

func mapAuthStatus(status *ipnstate.Status) AuthState {
	if status == nil {
		return AuthState{State: StateOffline}
	}
	state := StateOffline
	switch status.BackendState {
	case "Running":
		state = StateConnected
		// A node deleted in the admin console keeps "Running" from its
		// cached network map, but control answers its next login with a
		// fresh auth URL. A pending auth URL means the identity is no
		// longer accepted, whatever the cached state says.
		if status.AuthURL != "" {
			state = StateNeedsAuth
		}
	case "Starting", "NoState":
		state = StateConnecting
	case "NeedsLogin", "NeedsMachineAuth":
		state = StateNeedsAuth
	}
	hostname, online := "", false
	if status.Self != nil {
		hostname, online = status.Self.HostName, status.Self.Online
	}
	return AuthState{State: state, AuthURL: status.AuthURL, Hostname: hostname, online: online}
}

// NeedsAuth reports whether a state requires explicit user action.
func NeedsAuth(state AuthState) bool {
	return state.State == StateNeedsAuth
}
