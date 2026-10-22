package sharing

import (
	"sync"
	"testing"
)

type fakeListener struct {
	mu     sync.Mutex
	closed bool
}

func (listener *fakeListener) Close() error {
	listener.mu.Lock()
	defer listener.mu.Unlock()
	listener.closed = true
	return nil
}

func TestReconcilerStopsOnlyItsListeners(t *testing.T) {
	t.Parallel()
	opened := map[string]*fakeListener{}
	reconciler := NewReconciler(func(serviceID string) (Listener, error) {
		listener := &fakeListener{}
		opened[serviceID] = listener
		return listener, nil
	})
	if err := reconciler.Reconcile(Published{"opencode": true, "dsh": true}); err != nil {
		t.Fatal(err)
	}
	if active := reconciler.Active(); !active["opencode"] || !active["dsh"] {
		t.Fatalf("active = %#v", active)
	}
	if err := reconciler.Reconcile(Published{}); err != nil {
		t.Fatal(err)
	}
	if active := reconciler.Active(); len(active) != 0 {
		t.Fatalf("listeners still active: %#v", active)
	}
	for serviceID, listener := range opened {
		listener.mu.Lock()
		closed := listener.closed
		listener.mu.Unlock()
		if !closed {
			t.Fatalf("%s listener was not closed", serviceID)
		}
	}
}

func TestReconcilerKeepsUnchangedListener(t *testing.T) {
	t.Parallel()
	openCount := 0
	reconciler := NewReconciler(func(string) (Listener, error) {
		openCount++
		return &fakeListener{}, nil
	})
	for range 2 {
		if err := reconciler.Reconcile(Published{"opencode": true}); err != nil {
			t.Fatal(err)
		}
	}
	if openCount != 1 {
		t.Fatalf("listener opened %d times, want 1", openCount)
	}
}
