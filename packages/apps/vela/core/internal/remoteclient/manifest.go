// Package remoteclient reads and caches remote Vela manifests.
package remoteclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/thonatos/vela/core/internal/manifest"
)

var (
	ErrIncompatible = errors.New("remote Vela protocol is incompatible")
	ErrUnauthorized = errors.New("remote Vela rejected this device")
)

type Cache struct {
	client *http.Client
	mu     sync.RWMutex
	items  map[string]Entry
}

type Entry struct {
	Document  manifest.Document
	UpdatedAt time.Time
}

func New(client *http.Client) *Cache {
	return &Cache{client: client, items: map[string]Entry{}}
}

func (cache *Cache) Refresh(ctx context.Context, privateName string, port int) (Entry, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://%s:%d/vela/v1/manifest", privateName, port), nil)
	if err != nil {
		return Entry{}, err
	}
	request.Header.Set("Vela-Protocol-Version", fmt.Sprint(manifest.Version))
	response, err := cache.client.Do(request)
	if err != nil {
		return Entry{}, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUpgradeRequired {
		return Entry{}, ErrIncompatible
	}
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return Entry{}, ErrUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return Entry{}, fmt.Errorf("remote manifest returned HTTP %d", response.StatusCode)
	}
	var document manifest.Document
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		return Entry{}, fmt.Errorf("decode remote manifest: %w", err)
	}
	if document.Version != manifest.Version {
		return Entry{}, ErrIncompatible
	}
	filtered := document.Services[:0]
	for _, service := range document.Services {
		if service.Protocol == "" {
			service.Protocol = manifest.ProtocolHTTP
		}
		if service.Protocol != manifest.ProtocolHTTP && service.Protocol != manifest.ProtocolTCP {
			continue
		}
		if service.Protocol == manifest.ProtocolTCP {
			// Paths and adapters only apply to HTTP services.
			service.Path, service.Adapter = "", ""
		}
		if service.ID != "" && service.Name != "" && service.Port > manifest.ControlPort && service.Port <= 65535 && service.Available {
			filtered = append(filtered, service)
		}
	}
	document.Services = filtered
	entry := Entry{Document: document, UpdatedAt: time.Now().UTC()}
	cache.mu.Lock()
	cache.items[privateName] = entry
	cache.mu.Unlock()
	return entry, nil
}

func (cache *Cache) Get(privateName string) (Entry, bool) {
	cache.mu.RLock()
	defer cache.mu.RUnlock()
	entry, ok := cache.items[privateName]
	entry.Document.Services = append([]manifest.Service(nil), entry.Document.Services...)
	return entry, ok
}
