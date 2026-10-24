package mappings

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// ErrSuspended is returned when a mapping is opened while the session is in
// the background.
var ErrSuspended = errors.New("mapping session is suspended")

// Session owns the set of mappings the iOS app currently uses. iOS may keep
// no loopback listener while the app is in the background, so Suspend closes
// every listener and Resume recreates them with the ports the manager
// remembered; the WebView origin therefore stays stable across a foreground
// round trip.
type Session struct {
	mu        sync.Mutex
	manager   *Manager
	refs      map[Key]int
	order     []Key
	suspended bool
}

// NewSession wraps one mapping manager in a suspendable session.
func NewSession(manager *Manager) *Session {
	return &Session{manager: manager, refs: map[Key]int{}}
}

// Open returns the mapping URL, opening the loopback listener on first use.
func (session *Session) Open(ctx context.Context, key Key) (string, error) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.suspended {
		return "", ErrSuspended
	}
	if session.refs[key] > 0 {
		session.refs[key]++
		return session.manager.Open(ctx, key)
	}
	url, err := session.manager.Open(ctx, key)
	if err != nil {
		return "", err
	}
	session.refs[key] = 1
	session.order = append(session.order, key)
	return url, nil
}

// Close releases one reference and closes the listener at the final one.
func (session *Session) Close(key Key) error {
	session.mu.Lock()
	defer session.mu.Unlock()
	refs := session.refs[key]
	if refs == 0 {
		return nil
	}
	if refs > 1 {
		session.refs[key] = refs - 1
		return session.manager.Close(key)
	}
	delete(session.refs, key)
	session.order = removeKey(session.order, key)
	return session.manager.Close(key)
}

// Suspend closes every listener but keeps the mapping keys and their ports.
// It is idempotent and safe to call from the scene-phase notification.
func (session *Session) Suspend() error {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.suspended {
		return nil
	}
	session.suspended = true
	return session.manager.CloseAll()
}

// Resume recreates every mapping that was open before Suspend. It returns the
// URLs keyed by mapping so the host can reload the current WebView when a
// preferred port could not be reused.
func (session *Session) Resume(ctx context.Context) (map[Key]string, error) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if !session.suspended {
		return map[Key]string{}, nil
	}
	session.suspended = false
	urls := make(map[Key]string, len(session.order))
	var problems []error
	for _, key := range session.order {
		url, err := session.manager.Open(ctx, key)
		if err != nil {
			problems = append(problems, fmt.Errorf("resume %s/%s: %w", key.Device, key.Service, err))
			continue
		}
		urls[key] = url
	}
	return urls, errors.Join(problems...)
}

// Keys returns a detached list of the mappings the session should restore.
func (session *Session) Keys() []Key {
	session.mu.Lock()
	defer session.mu.Unlock()
	return append([]Key(nil), session.order...)
}

// Snapshot reports one open mapping without changing its reference count.
func (session *Session) Snapshot(key Key) (string, int, bool) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.refs[key] == 0 {
		return "", 0, false
	}
	return session.manager.Snapshot(key)
}

// Suspended reports whether listeners are currently closed.
func (session *Session) Suspended() bool {
	session.mu.Lock()
	defer session.mu.Unlock()
	return session.suspended
}

func removeKey(keys []Key, target Key) []Key {
	result := keys[:0]
	for _, key := range keys {
		if key != target {
			result = append(result, key)
		}
	}
	return result
}
