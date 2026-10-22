package network

import (
	"net/netip"
	"testing"

	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tailcfg"
	"tailscale.com/types/key"
)

func TestSnapshotReturnsSafeIdentityAndPeers(t *testing.T) {
	t.Parallel()
	status := &ipnstate.Status{
		BackendState:   "Running",
		Self:           &ipnstate.PeerStatus{HostName: "mini", DNSName: "mini.example.ts.net.", UserID: 1, TailscaleIPs: []netip.Addr{netip.MustParseAddr("100.64.0.1")}},
		User:           map[tailcfg.UserID]tailcfg.UserProfile{1: {LoginName: "owner@example.com"}},
		CurrentTailnet: &ipnstate.TailnetStatus{Name: "example"},
		Peer:           map[key.NodePublic]*ipnstate.PeerStatus{},
	}
	self, peers := Snapshot(status)
	if self.Name != "mini" || self.DNSName != "mini.example.ts.net" || self.User != "owner@example.com" || self.Tailnet != "example" || !self.Online || len(peers) != 0 {
		t.Fatalf("self=%#v peers=%#v", self, peers)
	}
}
