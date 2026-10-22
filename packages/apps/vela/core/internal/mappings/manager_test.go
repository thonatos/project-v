package mappings

import (
	"context"
	"errors"
	"io"
	"net"
	"strings"
	"sync"
	"testing"
)

func TestMappingIsStableReferenceCountedAndLoopbackOnly(t *testing.T) {
	t.Parallel()
	remote := echoServer(t)
	manager := New(func(ctx context.Context, _ Key) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp", remote)
	})
	key := Key{Device: "home", Service: "opencode"}
	first, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	second, err := manager.Open(context.Background(), key)
	if err != nil || first != second || !strings.HasPrefix(first, "http://opencode-home.localhost:") {
		t.Fatalf("first=%q second=%q err=%v", first, second, err)
	}
	_, portText, _ := net.SplitHostPort(strings.TrimPrefix(first, "http://"))
	for _, address := range []string{net.JoinHostPort("127.0.0.1", portText), net.JoinHostPort("::1", portText)} {
		connection, err := net.Dial("tcp", address)
		if err != nil {
			t.Fatalf("loopback %s unavailable: %v", address, err)
		}
		_, _ = connection.Write([]byte("v"))
		_ = connection.(*net.TCPConn).CloseWrite()
		result, _ := io.ReadAll(connection)
		connection.Close()
		if string(result) != "v" {
			t.Fatalf("loopback %s result=%q", address, result)
		}
	}
	_, refs, _ := manager.Snapshot(key)
	if refs != 2 {
		t.Fatalf("refs=%d", refs)
	}
	if err := manager.Close(key); err != nil {
		t.Fatal(err)
	}
	_, refs, _ = manager.Snapshot(key)
	if refs != 1 {
		t.Fatalf("refs after close=%d", refs)
	}
	if err := manager.Close(key); err != nil {
		t.Fatal(err)
	}
	if _, _, ok := manager.Snapshot(key); ok {
		t.Fatal("mapping remained after final close")
	}
}

func TestMappingCarriesConcurrentAndHalfClosedConnections(t *testing.T) {
	t.Parallel()
	remote := echoServer(t)
	manager := New(func(ctx context.Context, _ Key) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp", remote)
	})
	key := Key{Device: "home", Service: "dsh"}
	url, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	address := strings.TrimPrefix(url, "http://")
	var group sync.WaitGroup
	for index := range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			connection, err := net.Dial("tcp", address)
			if err != nil {
				t.Error(err)
				return
			}
			defer connection.Close()
			message := []byte{byte('a' + index)}
			_, _ = connection.Write(message)
			_ = connection.(*net.TCPConn).CloseWrite()
			result, _ := io.ReadAll(connection)
			if string(result) != string(message) {
				t.Errorf("result=%q want=%q", result, message)
			}
		}()
	}
	group.Wait()
	if err := manager.Close(key); err != nil {
		t.Fatal(err)
	}
}

func echoServer(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	go func() {
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			go func() { defer connection.Close(); _, _ = io.Copy(connection, connection) }()
		}
	}()
	return listener.Addr().String()
}

func TestStablePortsAreReusedAcrossReopens(t *testing.T) {
	remembered := map[Key]int{}
	manager := New(func(ctx context.Context, _ Key) (net.Conn, error) {
		return nil, errors.New("not dialed in this test")
	}).WithStablePorts(
		func(key Key) int { return remembered[key] },
		func(key Key, port int) { remembered[key] = port },
	)
	key := Key{Device: "home.example.ts.net", Service: "opencode"}

	first, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.Close(key); err != nil {
		t.Fatal(err)
	}
	second, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("reopening a service must keep the same origin: %s then %s", first, second)
	}
	if remembered[key] == 0 {
		t.Fatalf("the manager must persist the port it bound: %#v", remembered)
	}
	_ = manager.CloseAll()
}

func TestOccupiedStablePortFallsBackAndIsUpdated(t *testing.T) {
	blocker, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer blocker.Close()
	taken := blocker.Addr().(*net.TCPAddr).Port

	remembered := map[Key]int{{Device: "home.example.ts.net", Service: "dsh"}: taken}
	manager := New(func(ctx context.Context, _ Key) (net.Conn, error) {
		return nil, errors.New("not dialed in this test")
	}).WithStablePorts(
		func(key Key) int { return remembered[key] },
		func(key Key, port int) { remembered[key] = port },
	)
	key := Key{Device: "home.example.ts.net", Service: "dsh"}

	url, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatalf("an occupied port must fall back instead of failing: %v", err)
	}
	if remembered[key] == taken {
		t.Fatalf("the fallback port must replace the occupied one: %#v", remembered)
	}
	if url == "" {
		t.Fatal("the mapping must expose a loopback URL")
	}
	_ = manager.CloseAll()
}

func TestHostnameIsolatesCookiesPerDeviceAndService(t *testing.T) {
	opencodeHome := Hostname(Key{Device: "home-mac.example.ts.net", Service: "opencode"})
	opencodeWork := Hostname(Key{Device: "work-mac.example.ts.net", Service: "opencode"})
	dshHome := Hostname(Key{Device: "home-mac.example.ts.net", Service: "dsh"})

	if opencodeHome == opencodeWork {
		t.Fatalf("the same service on two devices must not share a cookie host: %s", opencodeHome)
	}
	if opencodeHome == dshHome {
		t.Fatalf("two services on one device must not share a cookie host: %s", opencodeHome)
	}
	for _, host := range []string{opencodeHome, opencodeWork, dshHome} {
		if !strings.HasSuffix(host, ".localhost") {
			t.Fatalf("mapping hosts must stay inside the reserved loopback tree: %s", host)
		}
		if _, err := net.LookupHost(host); err != nil {
			t.Fatalf("a .localhost mapping host must resolve without /etc/hosts: %s: %v", host, err)
		}
	}
	if opencodeHome != "opencode-home-mac.localhost" {
		t.Fatalf("mapping host must derive from the service and the device label: %s", opencodeHome)
	}
}

func TestHostnameFoldsUnsupportedCharactersAndStaysStable(t *testing.T) {
	key := Key{Device: "Home_Mac.Example.ts.net", Service: "My Service"}
	first := Hostname(key)
	if first != Hostname(key) {
		t.Fatal("the mapping host must be deterministic")
	}
	if first != "my-service-home-mac.localhost" {
		t.Fatalf("unsupported characters must fold to hyphens: %s", first)
	}
	if Hostname(Key{}) != "vela.localhost" {
		t.Fatalf("an empty key must still produce a usable host: %s", Hostname(Key{}))
	}
}

func TestMappingURLUsesTheStableHostname(t *testing.T) {
	manager := New(func(context.Context, Key) (net.Conn, error) {
		return nil, errors.New("not dialed in this test")
	})
	key := Key{Device: "home-mac.example.ts.net", Service: "opencode"}
	url, err := manager.Open(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = manager.CloseAll() }()
	if !strings.HasPrefix(url, "http://opencode-home-mac.localhost:") {
		t.Fatalf("the mapping URL must use the per-service loopback host: %s", url)
	}
}

func TestMappingURLFollowsRemoteServiceProtocol(t *testing.T) {
	manager := New(func(context.Context, Key) (net.Conn, error) {
		return nil, errors.New("not dialed in this test")
	}).WithProtocols(func(key Key) string {
		if key.Service == "ssh" {
			return "tcp"
		}
		return ""
	})
	defer func() { _ = manager.CloseAll() }()
	tcp, err := manager.Open(context.Background(), Key{Device: "home-mac.example.ts.net", Service: "ssh"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(tcp, "tcp://ssh-home-mac.localhost:") {
		t.Fatalf("tcp mapping URL=%s", tcp)
	}
	web, err := manager.Open(context.Background(), Key{Device: "home-mac.example.ts.net", Service: "docs"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(web, "http://docs-home-mac.localhost:") {
		t.Fatalf("http mapping URL=%s", web)
	}
}
