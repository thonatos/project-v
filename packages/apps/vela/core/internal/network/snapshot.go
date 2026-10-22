package network

import (
	"net/netip"
	"sort"
	"strings"

	"tailscale.com/ipn/ipnstate"
)

// DeviceInfo is safe Tailscale connection metadata for the UI.
type DeviceInfo struct {
	Name       string   `json:"name"`
	DNSName    string   `json:"dnsName,omitempty"`
	IPs        []string `json:"ips"`
	User       string   `json:"user,omitempty"`
	Tailnet    string   `json:"tailnet,omitempty"`
	Backend    string   `json:"backend"`
	Online     bool     `json:"online"`
	ExitNode   bool     `json:"exitNode"`
	KeyExpired bool     `json:"keyExpired"`
}

// Snapshot converts LocalAPI status without exposing keys or endpoints.
func Snapshot(status *ipnstate.Status) (DeviceInfo, []DeviceInfo) {
	if status == nil {
		return DeviceInfo{IPs: []string{}, Backend: "NoState"}, []DeviceInfo{}
	}
	self := peerInfo(status, status.Self)
	self.Backend = status.BackendState
	self.Online = status.BackendState == "Running"
	if status.CurrentTailnet != nil {
		self.Tailnet = status.CurrentTailnet.Name
	}
	peers := make([]DeviceInfo, 0, len(status.Peer))
	for _, peer := range status.Peer {
		peers = append(peers, peerInfo(status, peer))
	}
	sort.Slice(peers, func(i, j int) bool { return peers[i].Name < peers[j].Name })
	return self, peers
}

func peerInfo(status *ipnstate.Status, peer *ipnstate.PeerStatus) DeviceInfo {
	info := DeviceInfo{IPs: []string{}}
	if peer == nil {
		return info
	}
	info.Name = peer.HostName
	info.DNSName = strings.TrimSuffix(peer.DNSName, ".")
	info.IPs = addresses(peer.TailscaleIPs)
	info.Online = peer.Online
	info.ExitNode = peer.ExitNode
	info.KeyExpired = peer.Expired
	if user, ok := status.User[peer.UserID]; ok {
		info.User = user.LoginName
	}
	return info
}

func addresses(values []netip.Addr) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, value.String())
	}
	return result
}
