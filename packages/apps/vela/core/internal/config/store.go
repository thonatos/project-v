// Package config persists Vela sharing and remote-device choices atomically.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const currentVersion = 2

const (
	OpenCodePort = 47845
	DSHPort      = 47846
)

// Sharing contains the independent local sharing choices.
type Sharing struct {
	Enabled  bool `json:"enabled"`
	OpenCode bool `json:"opencode"`
	DSH      bool `json:"dsh"`
}

// Service protocols. HTTP services keep an http:// target and HTTP health
// checks; TCP services use a tcp://host:port target and are never connected to
// by the health probe.
const (
	ProtocolHTTP = "http"
	ProtocolTCP  = "tcp"
)

// LocalService is one user-owned loopback HTTP or TCP service.
type LocalService struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Protocol string `json:"protocol"`
	Preset   string `json:"preset,omitempty"`
	URL      string `json:"url"`
	Port     int    `json:"port"`
	Shared   bool   `json:"shared"`
	Adapter  string `json:"adapter,omitempty"`
}

// RemoteMac is one user-saved Vela peer.
type RemoteMac struct {
	Name             string `json:"name"`
	PrivateName      string `json:"privateName"`
	LastConnectedUTC string `json:"lastConnectedUtc,omitempty"`
}

// Preferences holds appearance and diagnostic choices owned by the user.
type Preferences struct {
	Appearance     string `json:"appearance"`
	PerformanceHUD bool   `json:"performanceHud"`
	VerboseLogs    bool   `json:"verboseLogs"`
}

// MappingPort remembers the loopback port used for one remote service so the
// WebView origin — and therefore its cookies and localStorage — stays stable.
type MappingPort struct {
	PrivateName string `json:"privateName"`
	Service     string `json:"service"`
	Port        int    `json:"port"`
}

// Config is the complete user-editable Vela configuration.
type Config struct {
	Version      int            `json:"version"`
	DeviceName   string         `json:"deviceName"`
	Preferences  Preferences    `json:"preferences"`
	Sharing      Sharing        `json:"sharing"`
	Services     []LocalService `json:"services"`
	Remotes      []RemoteMac    `json:"remotes"`
	MappingPorts []MappingPort  `json:"mappingPorts"`
}

// ValidAppearance reports whether the UI may apply the stored appearance.
func ValidAppearance(value string) bool {
	return value == "system" || value == "light" || value == "dark"
}

// Default returns a safe configuration with local sharing disabled.
func Default() Config {
	name, _ := os.Hostname()
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Mac"
	}
	return Config{Version: currentVersion, DeviceName: name, Preferences: Preferences{Appearance: "system"}, Services: []LocalService{}, Remotes: []RemoteMac{}, MappingPorts: []MappingPort{}}
}

func defaultServices(openCode, dsh bool) []LocalService {
	return []LocalService{
		{ID: "opencode", Name: "OpenCode", Protocol: ProtocolHTTP, Preset: "opencode", URL: "http://127.0.0.1:49374/api/info", Port: OpenCodePort, Shared: openCode, Adapter: "opencode"},
		{ID: "dsh", Name: "DSH", Protocol: ProtocolHTTP, Preset: "dsh", URL: "http://127.0.0.1:3080/", Port: DSHPort, Shared: dsh, Adapter: "dsh"},
	}
}

// Store serializes every mutation and owns the only writer for config.json.
type Store struct {
	path       string
	mu         sync.RWMutex
	value      Config
	beforeSwap func() error
}

// Open loads a store. A corrupt document is preserved beside the original and
// replaced in memory by the safe default.
func Open(path string) (*Store, error) {
	store := &Store{path: path, value: Default()}
	contents, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		if writeErr := store.writeAtomic(store.value); writeErr != nil {
			return nil, writeErr
		}
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read Vela config: %w", err)
	}
	var header struct {
		Version int `json:"version"`
	}
	if err := json.Unmarshal(contents, &header); err != nil || (header.Version != 1 && header.Version != currentVersion) {
		backup := path + ".corrupt-" + time.Now().UTC().Format("20060102T150405.000000000Z")
		if writeErr := os.WriteFile(backup, contents, 0o600); writeErr != nil {
			return nil, fmt.Errorf("preserve corrupt Vela config: %w", writeErr)
		}
		return store, nil
	}
	var value Config
	if err := json.Unmarshal(contents, &value); err != nil {
		return nil, fmt.Errorf("decode Vela config: %w", err)
	}
	if header.Version == 1 {
		value.Version = currentVersion
		value.DeviceName = store.value.DeviceName
		value.Services = defaultServices(value.Sharing.OpenCode, value.Sharing.DSH)
	}
	if value.DeviceName == "" {
		value.DeviceName = store.value.DeviceName
	}
	if value.Services == nil {
		value.Services = []LocalService{}
	}
	migrated := normalizeServices(value.Services)
	if value.Remotes == nil {
		value.Remotes = []RemoteMac{}
	}
	if !ValidAppearance(value.Preferences.Appearance) {
		value.Preferences.Appearance = "system"
	}
	if value.MappingPorts == nil {
		value.MappingPorts = []MappingPort{}
	}
	store.value = value
	if header.Version != currentVersion || migrated {
		if err := store.writeAtomic(value); err != nil {
			return nil, err
		}
	}
	return store, nil
}

// Snapshot returns a detached copy safe for concurrent readers.
func (store *Store) Snapshot() Config {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return clone(store.value)
}

// Update applies and atomically persists one serialized mutation.
func (store *Store) Update(update func(*Config) error) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	next := clone(store.value)
	if err := update(&next); err != nil {
		return err
	}
	next.Version = currentVersion
	if next.DeviceName == "" {
		next.DeviceName = store.value.DeviceName
	}
	if next.Services == nil {
		next.Services = []LocalService{}
	}
	normalizeServices(next.Services)
	if next.Remotes == nil {
		next.Remotes = []RemoteMac{}
	}
	if !ValidAppearance(next.Preferences.Appearance) {
		next.Preferences.Appearance = "system"
	}
	if next.MappingPorts == nil {
		next.MappingPorts = []MappingPort{}
	}
	if err := store.writeAtomic(next); err != nil {
		return err
	}
	store.value = next
	return nil
}

func (store *Store) writeAtomic(value Config) error {
	directory := filepath.Dir(store.path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return fmt.Errorf("create Vela config directory: %w", err)
	}
	contents, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode Vela config: %w", err)
	}
	contents = append(contents, '\n')
	temporary, err := os.CreateTemp(directory, ".config-*.tmp")
	if err != nil {
		return fmt.Errorf("create Vela config temporary file: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return fmt.Errorf("protect Vela config temporary file: %w", err)
	}
	if _, err := temporary.Write(contents); err != nil {
		temporary.Close()
		return fmt.Errorf("write Vela config temporary file: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return fmt.Errorf("sync Vela config temporary file: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close Vela config temporary file: %w", err)
	}
	if store.beforeSwap != nil {
		if err := store.beforeSwap(); err != nil {
			return err
		}
	}
	if err := os.Rename(temporaryPath, store.path); err != nil {
		return fmt.Errorf("replace Vela config: %w", err)
	}
	dir, err := os.Open(directory)
	if err != nil {
		return fmt.Errorf("open Vela config directory: %w", err)
	}
	defer dir.Close()
	if err := dir.Sync(); err != nil {
		return fmt.Errorf("sync Vela config directory: %w", err)
	}
	return nil
}

// normalizeServices migrates services saved before protocols existed to HTTP
// and reports whether any entry changed.
func normalizeServices(services []LocalService) bool {
	changed := false
	for index := range services {
		if services[index].Protocol == "" {
			services[index].Protocol = ProtocolHTTP
			changed = true
		}
		if services[index].Preset == "" {
			if preset := inferPreset(services[index]); preset != "" {
				services[index].Preset = preset
				changed = true
			}
		}
	}
	return changed
}

// inferPreset migrates services created before the preset field existed. It
// uses the adapter first, then an exact default target; display names are
// intentionally ignored so renaming a service never changes its behaviour.
func inferPreset(service LocalService) string {
	if service.Adapter == "opencode" {
		return "opencode"
	}
	if service.Adapter == "dsh" {
		return "dsh"
	}
	targets := map[string]string{
		"http://127.0.0.1:8188/": "comfyui",
		"tcp://127.0.0.1:22":     "ssh",
		"tcp://127.0.0.1:6379":   "redis",
		"tcp://127.0.0.1:3306":   "mysql",
		"tcp://127.0.0.1:5432":   "postgres",
	}
	return targets[service.URL]
}

func clone(value Config) Config {
	value.Services = append([]LocalService(nil), value.Services...)
	value.Remotes = append([]RemoteMac(nil), value.Remotes...)
	value.MappingPorts = append([]MappingPort(nil), value.MappingPorts...)
	return value
}

var serviceIDPattern = regexp.MustCompile(`[^a-z0-9]+`)

// NextServiceID returns a stable unused identifier derived from a display name.
func NextServiceID(config Config, name string) string {
	base := strings.Trim(serviceIDPattern.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if base == "" {
		base = "service"
	}
	used := map[string]bool{}
	for _, service := range config.Services {
		used[service.ID] = true
	}
	if !used[base] {
		return base
	}
	for suffix := 2; ; suffix++ {
		candidate := fmt.Sprintf("%s-%d", base, suffix)
		if !used[candidate] {
			return candidate
		}
	}
}

// NextServicePort returns the first unused tailnet port in Vela's range.
func NextServicePort(config Config) int {
	used := map[int]bool{OpenCodePort: true, DSHPort: true}
	for _, service := range config.Services {
		used[service.Port] = true
	}
	for port := DSHPort + 1; port <= 48844; port++ {
		if !used[port] {
			return port
		}
	}
	return 0
}
