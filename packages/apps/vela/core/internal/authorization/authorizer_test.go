package authorization

import (
	"context"
	"errors"
	"testing"

	"tailscale.com/client/tailscale/apitype"
	"tailscale.com/tailcfg"
)

type fakeResolver struct {
	response *apitype.WhoIsResponse
	err      error
}

func (resolver fakeResolver) WhoIs(context.Context, string) (*apitype.WhoIsResponse, error) {
	return resolver.response, resolver.err
}

func whoIs(login string, id tailcfg.StableNodeID) *apitype.WhoIsResponse {
	return &apitype.WhoIsResponse{
		Node:        &tailcfg.Node{StableID: id},
		UserProfile: &tailcfg.UserProfile{LoginName: login},
	}
}

func TestOwnerAndAllowedDeviceAreAuthorized(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		response *apitype.WhoIsResponse
		policy   Policy
	}{
		{name: "owner", response: whoIs("owner@example.com", "node-owner"), policy: Policy{OwnerLogin: "owner@example.com"}},
		{name: "explicit-device", response: whoIs("other@example.com", "node-allowed"), policy: Policy{OwnerLogin: "owner@example.com", AllowedDevices: map[string]bool{"node-allowed": true}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			called := false
			authorizer := Authorizer{Resolver: fakeResolver{response: test.response}, Policy: test.policy}
			if err := authorizer.OpenAuthorized(context.Background(), "100.64.0.2:1234", func(Identity) error { called = true; return nil }); err != nil {
				t.Fatal(err)
			}
			if !called {
				t.Fatal("target opener was not called")
			}
		})
	}
}

func TestDeniedIdentityNeverOpensTarget(t *testing.T) {
	t.Parallel()
	called := false
	authorizer := Authorizer{Resolver: fakeResolver{response: whoIs("other@example.com", "node-denied")}, Policy: Policy{OwnerLogin: "owner@example.com"}}
	err := authorizer.OpenAuthorized(context.Background(), "100.64.0.3:1234", func(Identity) error { called = true; return nil })
	if !errors.Is(err, ErrDenied) || called {
		t.Fatalf("err=%v called=%v", err, called)
	}
}

func TestWhoIsFailureNeverOpensTarget(t *testing.T) {
	t.Parallel()
	called := false
	authorizer := Authorizer{Resolver: fakeResolver{err: errors.New("peer missing")}, Policy: Policy{OwnerLogin: "owner@example.com"}}
	err := authorizer.OpenAuthorized(context.Background(), "bad", func(Identity) error { called = true; return nil })
	if !errors.Is(err, ErrDenied) || called {
		t.Fatalf("err=%v called=%v", err, called)
	}
}
