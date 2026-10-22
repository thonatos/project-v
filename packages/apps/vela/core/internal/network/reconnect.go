package network

import (
	"context"
	"errors"
	"sync"
	"time"
)

// State is the user-visible private-network state.
type State string

const (
	StateConnecting State = "connecting"
	StateConnected  State = "connected"
	StateOffline    State = "offline"
	StateNeedsAuth  State = "needs-auth"
)

// ErrNeedsAuth signals that reconnect cannot proceed without user action.
var ErrNeedsAuth = errors.New("private network authentication required")

// Connector attempts to bring the embedded node online.
type Connector interface {
	Connect(context.Context) error
}

// Reconnector applies bounded exponential retry and emits every state change.
type Reconnector struct {
	connector Connector
	max       int
	baseDelay time.Duration
	sleep     func(context.Context, time.Duration) error
	mu        sync.Mutex
	state     State
	events    chan State
}

// NewReconnector constructs a reconnect state machine.
func NewReconnector(connector Connector, maxAttempts int, baseDelay time.Duration) *Reconnector {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	return &Reconnector{
		connector: connector,
		max:       maxAttempts,
		baseDelay: baseDelay,
		sleep: func(ctx context.Context, delay time.Duration) error {
			timer := time.NewTimer(delay)
			defer timer.Stop()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-timer.C:
				return nil
			}
		},
		state:  StateOffline,
		events: make(chan State, maxAttempts+4),
	}
}

// Reconnect attempts immediately and then with bounded backoff.
func (reconnector *Reconnector) Reconnect(ctx context.Context) error {
	reconnector.setState(StateConnecting)
	var last error
	for attempt := range reconnector.max {
		last = reconnector.connector.Connect(ctx)
		if last == nil {
			reconnector.setState(StateConnected)
			return nil
		}
		if errors.Is(last, ErrNeedsAuth) {
			reconnector.setState(StateNeedsAuth)
			return last
		}
		if attempt+1 < reconnector.max {
			delay := reconnector.baseDelay * time.Duration(1<<min(attempt, 8))
			if err := reconnector.sleep(ctx, delay); err != nil {
				reconnector.setState(StateOffline)
				return err
			}
		}
	}
	reconnector.setState(StateOffline)
	return last
}

// NetworkChanged triggers the same bounded recovery after an interface change.
func (reconnector *Reconnector) NetworkChanged(ctx context.Context) error {
	reconnector.setState(StateOffline)
	return reconnector.Reconnect(ctx)
}

// Events returns the ordered state transition stream.
func (reconnector *Reconnector) Events() <-chan State { return reconnector.events }

// State returns the current state.
func (reconnector *Reconnector) State() State {
	reconnector.mu.Lock()
	defer reconnector.mu.Unlock()
	return reconnector.state
}

func (reconnector *Reconnector) setState(state State) {
	reconnector.mu.Lock()
	changed := reconnector.state != state
	reconnector.state = state
	reconnector.mu.Unlock()
	if changed {
		reconnector.events <- state
	}
}
