package network

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type scriptedConnector struct {
	mu      sync.Mutex
	results []error
	calls   int
}

func (connector *scriptedConnector) Connect(context.Context) error {
	connector.mu.Lock()
	defer connector.mu.Unlock()
	result := connector.results[min(connector.calls, len(connector.results)-1)]
	connector.calls++
	return result
}

func TestReconnectStateSequences(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		results []error
		want    []State
	}{
		{name: "connects", results: []error{nil}, want: []State{StateConnecting, StateConnected}},
		{name: "recovers", results: []error{errors.New("offline"), nil}, want: []State{StateConnecting, StateConnected}},
		{name: "needs-auth", results: []error{ErrNeedsAuth}, want: []State{StateConnecting, StateNeedsAuth}},
		{name: "exhausted", results: []error{errors.New("offline")}, want: []State{StateConnecting, StateOffline}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			reconnector := NewReconnector(&scriptedConnector{results: test.results}, 3, time.Millisecond)
			reconnector.sleep = func(context.Context, time.Duration) error { return nil }
			_ = reconnector.Reconnect(context.Background())
			got := make([]State, 0, len(test.want))
			for range len(test.want) {
				got = append(got, <-reconnector.Events())
			}
			if !equalStates(got, test.want) {
				t.Fatalf("states = %v, want %v", got, test.want)
			}
		})
	}
}

func TestNetworkChangeEmitsOfflineBeforeReconnect(t *testing.T) {
	t.Parallel()
	reconnector := NewReconnector(&scriptedConnector{results: []error{nil, nil}}, 1, 0)
	if err := reconnector.Reconnect(context.Background()); err != nil {
		t.Fatal(err)
	}
	<-reconnector.Events()
	<-reconnector.Events()
	if err := reconnector.NetworkChanged(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []State{StateOffline, StateConnecting, StateConnected}
	got := []State{<-reconnector.Events(), <-reconnector.Events(), <-reconnector.Events()}
	if !equalStates(got, want) {
		t.Fatalf("states = %v, want %v", got, want)
	}
}

func equalStates(left, right []State) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
