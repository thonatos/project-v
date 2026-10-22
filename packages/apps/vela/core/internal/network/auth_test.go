package network

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"tailscale.com/ipn/ipnstate"
)

type fakeAuthClient struct {
	mu       sync.Mutex
	statuses []*ipnstate.Status
	login    bool
	logout   bool
}

func (client *fakeAuthClient) Status(context.Context) (*ipnstate.Status, error) {
	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.statuses) == 0 {
		return nil, errors.New("no status")
	}
	status := client.statuses[0]
	if len(client.statuses) > 1 {
		client.statuses = client.statuses[1:]
	}
	return status, nil
}
func (client *fakeAuthClient) StartLoginInteractive(context.Context) error {
	client.login = true
	return nil
}
func (client *fakeAuthClient) Logout(context.Context) error { client.logout = true; return nil }

func TestAuthMapsPersistedAndRevokedIdentity(t *testing.T) {
	t.Parallel()
	for backend, want := range map[string]State{"Running": StateConnected, "NeedsLogin": StateNeedsAuth, "NeedsMachineAuth": StateNeedsAuth, "Starting": StateConnecting, "Stopped": StateOffline} {
		state, err := (AuthController{Client: &fakeAuthClient{statuses: []*ipnstate.Status{{BackendState: backend}}}}).Status(context.Background())
		if err != nil || state.State != want {
			t.Fatalf("backend=%s state=%#v err=%v", backend, state, err)
		}
	}
}

func TestInteractiveLoginReturnsURL(t *testing.T) {
	t.Parallel()
	client := &fakeAuthClient{statuses: []*ipnstate.Status{{BackendState: "NeedsLogin"}, {BackendState: "NeedsLogin", AuthURL: "https://login.tailscale.com/a/test"}}}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	state, err := (AuthController{Client: client, Poll: time.Millisecond}).StartInteractive(ctx)
	if err != nil || !client.login || state.AuthURL == "" || state.State != StateNeedsAuth {
		t.Fatalf("state=%#v login=%v err=%v", state, client.login, err)
	}
}

func TestLogoutReturnsNeedsAuth(t *testing.T) {
	t.Parallel()
	client := &fakeAuthClient{}
	state, err := (AuthController{Client: client}).Logout(context.Background())
	if err != nil || !client.logout || !NeedsAuth(state) {
		t.Fatalf("state=%#v logout=%v err=%v", state, client.logout, err)
	}
}
