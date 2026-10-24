// Package sharing decides which configured services are published to the tailnet.
package sharing

import "github.com/thonatos/vela/core/internal/services"

// Selection is the user's persisted sharing choice.
type Selection struct {
	Enabled  bool
	Services map[string]bool
}

// Published reports service IDs that currently have tailnet listeners.
type Published map[string]bool

// Evaluate applies network, global, per-service and health gates. It never
// starts or stops the local OpenCode/DSH processes.
func Evaluate(networkConnected bool, selection Selection, health map[string]services.State) Published {
	if !networkConnected || !selection.Enabled {
		return Published{}
	}
	published := Published{}
	for id, selected := range selection.Services {
		if selected && health[id] == services.StateAvailable {
			published[id] = true
		}
	}
	return published
}
