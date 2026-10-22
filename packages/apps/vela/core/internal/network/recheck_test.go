package network

import (
	"context"
	"errors"
	"testing"
	"time"

	"tailscale.com/ipn/ipnstate"
)

// Measured on a node deleted in the admin console: it keeps reporting
// "Running" from its cached network map, and within seconds control hands it a
// fresh auth URL. The pending URL is the signal that the identity was dropped.
func TestRunningWithPendingAuthURLNeedsAuth(t *testing.T) {
	t.Parallel()
	if state := mapAuthStatus(&ipnstate.Status{BackendState: "Running"}).State; state != StateConnected {
		t.Fatalf("a running node without an auth URL is connected, got %s", state)
	}
	removed := mapAuthStatus(&ipnstate.Status{BackendState: "Running", AuthURL: "https://login.tailscale.com/a/example"})
	if removed.State != StateNeedsAuth {
		t.Fatalf("a running node that control asks to log in again must need auth, got %s", removed.State)
	}
	if removed.AuthURL == "" {
		t.Fatal("the pending auth URL must be passed on so the user can sign in again")
	}
}

type recheckClient struct {
	states []*ipnstate.Status
	calls  int
}

func (client *recheckClient) Status(context.Context) (*ipnstate.Status, error) {
	index := min(client.calls, len(client.states)-1)
	client.calls++
	return client.states[index], nil
}
func (*recheckClient) StartLoginInteractive(context.Context) error { return nil }
func (*recheckClient) Logout(context.Context) error                { return nil }

func running(online bool, authURL string) *ipnstate.Status {
	return &ipnstate.Status{BackendState: "Running", AuthURL: authURL, Self: &ipnstate.PeerStatus{HostName: "vela-macstudio", Online: online}}
}

// A healthy node logs back in after the restart and settles online.
func TestRecheckSettlesOnlineForAHealthyNode(t *testing.T) {
	t.Parallel()
	client := &recheckClient{states: []*ipnstate.Status{running(false, ""), running(false, ""), running(true, "")}}
	restarted := false
	state, err := AuthController{Client: client, Poll: time.Millisecond}.Recheck(context.Background(), func(context.Context) error { restarted = true; return nil })
	if err != nil || !restarted || state.State != StateConnected {
		t.Fatalf("state=%#v err=%v restarted=%v", state, err, restarted)
	}
}

// A removed node keeps "Running" from its cache until control hands it a new
// auth URL; that must end the re-check as needs-auth.
func TestRecheckReportsNeedsAuthForARemovedNode(t *testing.T) {
	t.Parallel()
	client := &recheckClient{states: []*ipnstate.Status{running(false, ""), running(false, ""), running(false, "https://login.tailscale.com/a/x")}}
	state, err := AuthController{Client: client, Poll: time.Millisecond}.Recheck(context.Background(), func(context.Context) error { return nil })
	if err != nil || state.State != StateNeedsAuth || state.AuthURL == "" {
		t.Fatalf("state=%#v err=%v", state, err)
	}
}

// Running out of time without a verdict must not be reported as a removal.
func TestRecheckTimeoutDoesNotSignOut(t *testing.T) {
	t.Parallel()
	client := &recheckClient{states: []*ipnstate.Status{running(false, "")}}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	state, _ := AuthController{Client: client, Poll: time.Millisecond}.Recheck(ctx, func(context.Context) error { return nil })
	if state.State == StateNeedsAuth {
		t.Fatalf("a slow control server must not sign the user out: %#v", state)
	}
}

// If the control client cannot be restarted, report the current state.
func TestRecheckFallsBackWhenRestartFails(t *testing.T) {
	t.Parallel()
	client := &recheckClient{states: []*ipnstate.Status{running(true, "")}}
	state, err := AuthController{Client: client}.Recheck(context.Background(), func(context.Context) error { return errors.New("busy") })
	if err != nil || state.State != StateConnected {
		t.Fatalf("state=%#v err=%v", state, err)
	}
}
