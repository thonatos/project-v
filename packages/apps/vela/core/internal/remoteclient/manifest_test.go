package remoteclient

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"

	"implements.io/vela/internal/manifest"
)

func testClient(server *httptest.Server) (*http.Client, string, int) {
	host, portText, _ := net.SplitHostPort(server.Listener.Addr().String())
	port, _ := strconv.Atoi(portText)
	return server.Client(), host, port
}

func TestRefreshFiltersUnknownAndUnavailableServices(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"version":2,"device":"Home","services":[{"id":"opencode","name":"OpenCode","port":47845,"available":true},{"id":"dsh","name":"DSH","port":47846,"available":false},{"id":"other","name":"Other","port":9,"available":true}]}`))
	}))
	defer server.Close()
	client, host, port := testClient(server)
	cache := New(client)
	entry, err := cache.Refresh(context.Background(), host, port)
	if err != nil {
		t.Fatal(err)
	}
	if len(entry.Document.Services) != 1 || entry.Document.Services[0].ID != "opencode" {
		t.Fatalf("services=%#v", entry.Document.Services)
	}
	cached, ok := cache.Get(host)
	if !ok || cached.Document.Device != "Home" {
		t.Fatalf("cached=%#v ok=%v", cached, ok)
	}
}

func TestRefreshRejectsIncompatibleWithoutReplacingCache(t *testing.T) {
	t.Parallel()
	version := manifest.Version
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"version":` + fmt.Sprint(version) + `,"device":"Home","services":[]}`))
	}))
	defer server.Close()
	client, host, port := testClient(server)
	cache := New(client)
	if _, err := cache.Refresh(context.Background(), host, port); err != nil {
		t.Fatal(err)
	}
	version = 1
	if _, err := cache.Refresh(context.Background(), host, port); !errors.Is(err, ErrIncompatible) {
		t.Fatalf("error=%v", err)
	}
	cached, _ := cache.Get(host)
	if cached.Document.Version != manifest.Version {
		t.Fatalf("cache replaced with incompatible document: %#v", cached)
	}
}

func TestRefreshDiscoversServiceSharedAfterDeviceWasAdded(t *testing.T) {
	t.Parallel()
	var shared atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		services := `[]`
		if shared.Load() {
			services = `[{"id":"docs","name":"Docs","port":47847,"path":"/guide","available":true}]`
		}
		_, _ = writer.Write([]byte(`{"version":2,"device":"Home","services":` + services + `}`))
	}))
	defer server.Close()
	client, host, port := testClient(server)
	cache := New(client)
	first, err := cache.Refresh(context.Background(), host, port)
	if err != nil || len(first.Document.Services) != 0 {
		t.Fatalf("first=%#v err=%v", first, err)
	}
	shared.Store(true)
	second, err := cache.Refresh(context.Background(), host, port)
	if err != nil || len(second.Document.Services) != 1 || second.Document.Services[0].ID != "docs" || second.Document.Services[0].Path != "/guide" {
		t.Fatalf("second=%#v err=%v", second, err)
	}
}

func TestRefreshKeepsTCPServicesAndDefaultsMissingProtocolToHTTP(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"version":2,"device":"Home","services":[` +
			`{"id":"ssh","name":"SSH","protocol":"tcp","port":47847,"path":"/ignored","adapter":"dsh","available":true},` +
			`{"id":"docs","name":"Docs","port":47848,"path":"/guide","available":true},` +
			`{"id":"udp","name":"UDP","protocol":"udp","port":47849,"available":true}]}`))
	}))
	defer server.Close()
	client, host, port := testClient(server)
	entry, err := New(client).Refresh(context.Background(), host, port)
	if err != nil {
		t.Fatal(err)
	}
	services := entry.Document.Services
	if len(services) != 2 {
		t.Fatalf("services=%#v", services)
	}
	if services[0].ID != "ssh" || services[0].Protocol != manifest.ProtocolTCP || services[0].Path != "" || services[0].Adapter != "" {
		t.Fatalf("tcp service=%#v", services[0])
	}
	if services[1].ID != "docs" || services[1].Protocol != manifest.ProtocolHTTP || services[1].Path != "/guide" {
		t.Fatalf("http service=%#v", services[1])
	}
}

func TestRefreshClassifiesUnauthorized(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, "denied", http.StatusForbidden)
	}))
	defer server.Close()
	client, host, port := testClient(server)
	if _, err := New(client).Refresh(context.Background(), host, port); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("error=%v", err)
	}
}
