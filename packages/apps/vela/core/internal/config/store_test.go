package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestDefaultStartsWithoutPresetServices(t *testing.T) {
	t.Parallel()
	config := Default()
	if len(config.Services) != 0 {
		t.Fatalf("new configurations should not create services automatically: %#v", config.Services)
	}
	if config.Preferences.Appearance != "system" {
		t.Fatalf("new configurations must follow the system appearance: %#v", config.Preferences)
	}
}

func TestAppearanceFallsBackToSystem(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(func(config *Config) error {
		config.Preferences.Appearance = "sepia"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if appearance := store.Snapshot().Preferences.Appearance; appearance != "system" {
		t.Fatalf("invalid appearances must fall back to system: %q", appearance)
	}
	if err := store.Update(func(config *Config) error {
		config.Preferences.Appearance = "dark"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if appearance := reopened.Snapshot().Preferences.Appearance; appearance != "dark" {
		t.Fatalf("a valid appearance must persist across restarts: %q", appearance)
	}
}

func TestInterruptedWritePreservesPreviousDocument(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(func(config *Config) error {
		config.Sharing.OpenCode = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	store.beforeSwap = func() error { return errors.New("injected interruption") }
	if err := store.Update(func(config *Config) error {
		config.Sharing.DSH = true
		return nil
	}); err == nil {
		t.Fatal("expected interrupted update to fail")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(before) {
		t.Fatalf("document changed after interruption:\nbefore=%s\nafter=%s", before, after)
	}
}

func TestCorruptDocumentFallsBackAndIsPreserved(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	path := filepath.Join(directory, "config.json")
	if err := os.WriteFile(path, []byte("{broken"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot := store.Snapshot(); snapshot.Sharing.Enabled || len(snapshot.Remotes) != 0 {
		t.Fatalf("unsafe fallback: %#v", snapshot)
	}
	backups, err := filepath.Glob(path + ".corrupt-*")
	if err != nil || len(backups) != 1 {
		t.Fatalf("corrupt backups = %v, %v", backups, err)
	}
}

func TestConcurrentUpdatesAreCompleteDocuments(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	const count = 40
	var group sync.WaitGroup
	for index := range count {
		group.Add(1)
		go func() {
			defer group.Done()
			if err := store.Update(func(config *Config) error {
				config.Remotes = append(config.Remotes, RemoteMac{Name: fmt.Sprintf("Mac %d", index), PrivateName: fmt.Sprintf("mac-%d.example.ts.net", index)})
				return nil
			}); err != nil {
				t.Errorf("Update() error = %v", err)
			}
		}()
	}
	group.Wait()
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var persisted Config
	if err := json.Unmarshal(contents, &persisted); err != nil {
		t.Fatalf("persisted document is partial: %v\n%s", err, contents)
	}
	if len(persisted.Remotes) != count {
		t.Fatalf("persisted remotes = %d, want %d", len(persisted.Remotes), count)
	}
}

func TestVersionOneMigratesDeviceNameAndServices(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	legacy := `{"version":1,"sharing":{"enabled":true,"opencode":true,"dsh":false},"remotes":[]}`
	if err := os.WriteFile(path, []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := store.Snapshot()
	if snapshot.Version != 2 || snapshot.DeviceName == "" || len(snapshot.Services) != 2 || !snapshot.Services[0].Shared || snapshot.Services[1].Shared {
		t.Fatalf("migrated=%#v", snapshot)
	}
	contents, err := os.ReadFile(path)
	if err != nil || !strings.Contains(string(contents), `"version": 2`) || !strings.Contains(string(contents), `"deviceName"`) {
		t.Fatalf("persisted migration=%s err=%v", contents, err)
	}
}

func TestFirstOpenPersistsHostnameDefaults(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(path)
	if err != nil || store.Snapshot().DeviceName == "" || !strings.Contains(string(contents), `"services"`) {
		t.Fatalf("snapshot=%#v contents=%s err=%v", store.Snapshot(), contents, err)
	}
}

func TestDynamicServiceIdentifiersAndPortsAreStable(t *testing.T) {
	t.Parallel()
	config := Default()
	config.Services = append(config.Services, LocalService{ID: "docs", Port: 47847})
	if id := NextServiceID(config, "Docs"); id != "docs-2" {
		t.Fatalf("id=%q", id)
	}
	if port := NextServicePort(config); port != 47848 {
		t.Fatalf("port=%d", port)
	}
}

func TestServicesWithoutProtocolMigrateToHTTP(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "config.json")
	saved := `{"version":2,"deviceName":"Mini","services":[{"id":"docs","name":"Docs","url":"http://127.0.0.1:3000","port":47847,"shared":true},{"id":"ssh","name":"SSH","protocol":"tcp","url":"tcp://127.0.0.1:22","port":47848}],"remotes":[]}`
	if err := os.WriteFile(path, []byte(saved), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	services := store.Snapshot().Services
	if len(services) != 2 || services[0].Protocol != ProtocolHTTP || services[1].Protocol != ProtocolTCP {
		t.Fatalf("services=%#v", services)
	}
	contents, err := os.ReadFile(path)
	if err != nil || strings.Count(string(contents), `"protocol": "http"`) != 1 {
		t.Fatalf("persisted migration=%s err=%v", contents, err)
	}
	if err := store.Update(func(config *Config) error {
		config.Services = append(config.Services, LocalService{ID: "new", Name: "New", URL: "http://127.0.0.1:4000", Port: 47849})
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if added := store.Snapshot().Services[2]; added.Protocol != ProtocolHTTP {
		t.Fatalf("update did not normalize protocol: %#v", added)
	}
}

func TestServicesWithoutPresetInferStableBuiltInKinds(t *testing.T) {
	t.Parallel()
	services := []LocalService{
		{Name: "My shell", Protocol: ProtocolTCP, URL: "tcp://127.0.0.1:22"},
		{Name: "Renamed database", Protocol: ProtocolTCP, URL: "tcp://127.0.0.1:3306"},
		{Name: "Images", Protocol: ProtocolHTTP, URL: "http://127.0.0.1:8188/"},
		{Name: "Anything", Protocol: ProtocolTCP, URL: "tcp://127.0.0.1:9000"},
	}
	if !normalizeServices(services) {
		t.Fatal("legacy built-in services must be migrated")
	}
	if services[0].Preset != "ssh" || services[1].Preset != "mysql" || services[2].Preset != "comfyui" {
		t.Fatalf("inferred presets = %#v", services)
	}
	if services[3].Preset != "" {
		t.Fatalf("a custom target must remain custom: %#v", services[3])
	}
}

func TestVersionOneDefaultsUseHTTP(t *testing.T) {
	t.Parallel()
	for _, service := range defaultServices(true, true) {
		if service.Protocol != ProtocolHTTP {
			t.Fatalf("default=%#v", service)
		}
	}
}
