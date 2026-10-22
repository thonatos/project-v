package sharing

import (
	"errors"
	"fmt"
	"sync"
)

// Listener is the lifecycle seam for one tailnet service listener.
type Listener interface {
	Close() error
}

// OpenListener creates one listener for a fixed service ID.
type OpenListener func(serviceID string) (Listener, error)

// Reconciler makes active listeners match Evaluate's desired state.
type Reconciler struct {
	mu        sync.Mutex
	open      OpenListener
	listeners map[string]Listener
}

// NewReconciler creates a listener reconciler.
func NewReconciler(open OpenListener) *Reconciler {
	return &Reconciler{open: open, listeners: map[string]Listener{}}
}

// Reconcile starts and stops only Vela listeners. It never touches local services.
func (reconciler *Reconciler) Reconcile(desired Published) error {
	reconciler.mu.Lock()
	defer reconciler.mu.Unlock()
	wanted := desired
	var problems []error
	for serviceID, listener := range reconciler.listeners {
		if wanted[serviceID] {
			continue
		}
		if err := listener.Close(); err != nil {
			problems = append(problems, fmt.Errorf("close %s listener: %w", serviceID, err))
		}
		delete(reconciler.listeners, serviceID)
	}
	for serviceID, shouldListen := range wanted {
		if !shouldListen || reconciler.listeners[serviceID] != nil {
			continue
		}
		listener, err := reconciler.open(serviceID)
		if err != nil {
			problems = append(problems, fmt.Errorf("open %s listener: %w", serviceID, err))
			continue
		}
		reconciler.listeners[serviceID] = listener
	}
	return errors.Join(problems...)
}

// Active returns a detached set of active service IDs.
func (reconciler *Reconciler) Active() map[string]bool {
	reconciler.mu.Lock()
	defer reconciler.mu.Unlock()
	active := make(map[string]bool, len(reconciler.listeners))
	for serviceID := range reconciler.listeners {
		active[serviceID] = true
	}
	return active
}
