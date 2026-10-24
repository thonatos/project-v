package sharing

import (
	"reflect"
	"testing"

	"implements.io/vela/internal/services"
)

func TestEvaluateStateMatrix(t *testing.T) {
	t.Parallel()
	available := map[string]services.State{"opencode": services.StateAvailable, "dsh": services.StateAvailable}
	tests := []struct {
		name      string
		connected bool
		selection Selection
		health    map[string]services.State
		want      Published
	}{
		{name: "network-offline", connected: false, selection: Selection{Enabled: true, Services: map[string]bool{"opencode": true, "dsh": true}}, health: available, want: Published{}},
		{name: "global-disabled", connected: true, selection: Selection{Services: map[string]bool{"opencode": true, "dsh": true}}, health: available, want: Published{}},
		{name: "only-opencode-selected", connected: true, selection: Selection{Enabled: true, Services: map[string]bool{"opencode": true}}, health: available, want: Published{"opencode": true}},
		{name: "unhealthy-selection-not-published", connected: true, selection: Selection{Enabled: true, Services: map[string]bool{"opencode": true, "dsh": true}}, health: map[string]services.State{"opencode": services.StateUnavailable, "dsh": services.StateAvailable}, want: Published{"dsh": true}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := Evaluate(test.connected, test.selection, test.health); !reflect.DeepEqual(got, test.want) {
				t.Fatalf("Evaluate() = %#v, want %#v", got, test.want)
			}
		})
	}
}

func TestDisablingDoesNotMutateSelectionOrHealth(t *testing.T) {
	t.Parallel()
	selection := Selection{Enabled: false, Services: map[string]bool{"opencode": true}}
	health := map[string]services.State{"opencode": services.StateAvailable, "dsh": services.StateUnavailable}
	_ = Evaluate(true, selection, health)
	if !selection.Services["opencode"] || health["opencode"] != services.StateAvailable {
		t.Fatalf("Evaluate mutated local state: selection=%#v health=%#v", selection, health)
	}
}
