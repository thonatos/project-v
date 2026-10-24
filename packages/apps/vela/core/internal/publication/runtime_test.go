package publication

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"sync"
	"testing"

	"github.com/thonatos/vela/core/internal/authorization"
	velaconfig "github.com/thonatos/vela/core/internal/config"
	"github.com/thonatos/vela/core/internal/manifest"
	"github.com/thonatos/vela/core/internal/services"
	"tailscale.com/client/tailscale/apitype"
	"tailscale.com/tailcfg"
)

type fakeNode struct {
	mu        sync.Mutex
	addresses []string
	listeners []net.Listener
}

func (node *fakeNode) Listen(_, address string) (net.Listener, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	node.mu.Lock()
	node.addresses = append(node.addresses, address)
	node.listeners = append(node.listeners, listener)
	node.mu.Unlock()
	return listener, nil
}

type allowResolver struct{}

func (allowResolver) WhoIs(context.Context, string) (*apitype.WhoIsResponse, error) {
	return &apitype.WhoIsResponse{Node: &tailcfg.Node{}, UserProfile: &tailcfg.UserProfile{LoginName: "owner@example.com"}}, nil
}

func testAuthorizer(context.Context) (authorization.Authorizer, error) {
	return authorization.Authorizer{Resolver: allowResolver{}, Policy: authorization.Policy{OwnerLogin: "owner@example.com"}}, nil
}

func TestRuntimePublishesOnlyHealthySelectedServices(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	runtime := New(node, testAuthorizer)
	health := map[string]services.State{"opencode": services.StateAvailable, "dsh": services.StateUnavailable}
	definitions := []velaconfig.LocalService{{ID: "opencode", Name: "OpenCode", URL: "http://127.0.0.1:49374", Port: 47845, Shared: true}, {ID: "dsh", Name: "DSH", URL: "http://127.0.0.1:3080", Port: 47846, Shared: true}}
	if err := runtime.Reconcile(context.Background(), true, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	if published := runtime.Published(); !published["opencode"] || published["dsh"] {
		t.Fatalf("published=%#v", published)
	}
	node.mu.Lock()
	addresses := append([]string(nil), node.addresses...)
	control := node.listeners[0].Addr().String()
	node.mu.Unlock()
	if len(addresses) != 2 || addresses[0] != ":47844" || addresses[1] != ":47845" {
		t.Fatalf("addresses=%v", addresses)
	}
	response, err := http.Get("http://" + control + "/vela/v1/manifest")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var document manifest.Document
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		t.Fatal(err)
	}
	if document.Device != "Home Mac" || len(document.Services) != 1 || document.Services[0].ID != "opencode" {
		t.Fatalf("manifest=%#v", document)
	}
	if err := runtime.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestRuntimeDisablesInboundWithoutChangingSelection(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	runtime := New(node, testAuthorizer)
	health := map[string]services.State{"opencode": services.StateAvailable}
	definitions := []velaconfig.LocalService{{ID: "opencode", Name: "OpenCode", URL: "http://127.0.0.1:49374", Port: 47845, Shared: true}}
	if err := runtime.Reconcile(context.Background(), true, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Reconcile(context.Background(), false, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	if published := runtime.Published(); len(published) != 0 {
		t.Fatalf("published after disconnect=%#v", published)
	}
	if !definitions[0].Shared {
		t.Fatal("reconcile mutated the persisted selection")
	}
}

func TestRuntimeRestartsChangedPublishedService(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	runtime := New(node, testAuthorizer)
	health := map[string]services.State{"docs": services.StateAvailable}
	first := []velaconfig.LocalService{{ID: "docs", Name: "Docs", URL: "http://127.0.0.1:3000/first", Port: 47847, Shared: true}}
	if err := runtime.Reconcile(context.Background(), true, true, first, health, "Mini"); err != nil {
		t.Fatal(err)
	}
	second := []velaconfig.LocalService{{ID: "docs", Name: "Docs", URL: "http://127.0.0.1:3001/second", Port: 47847, Shared: true}}
	if err := runtime.Reconcile(context.Background(), true, true, second, health, "Mini"); err != nil {
		t.Fatal(err)
	}
	node.mu.Lock()
	addresses := append([]string(nil), node.addresses...)
	node.mu.Unlock()
	count := 0
	for _, address := range addresses {
		if address == ":47847" {
			count++
		}
	}
	if count != 2 {
		t.Fatalf("service listener opened %d times, addresses=%v", count, addresses)
	}
	_ = runtime.Close()
}

func TestRuntimePublishesTCPServiceProtocolWithoutPath(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	runtime := New(node, testAuthorizer)
	health := map[string]services.State{"ssh": services.StateAvailable, "docs": services.StateAvailable}
	definitions := []velaconfig.LocalService{
		{ID: "ssh", Name: "Remote shell", Protocol: velaconfig.ProtocolTCP, Preset: "ssh", URL: "tcp://127.0.0.1:22", Port: 47847, Shared: true},
		{ID: "docs", Name: "Docs", Protocol: velaconfig.ProtocolHTTP, URL: "http://127.0.0.1:3000/guide", Port: 47848, Shared: true},
	}
	if err := runtime.Reconcile(context.Background(), true, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = runtime.Close() }()
	node.mu.Lock()
	control := node.listeners[0].Addr().String()
	node.mu.Unlock()
	response, err := http.Get("http://" + control + "/vela/v1/manifest")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var document manifest.Document
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		t.Fatal(err)
	}
	byID := map[string]manifest.Service{}
	for _, service := range document.Services {
		byID[service.ID] = service
	}
	if ssh := byID["ssh"]; ssh.Protocol != "tcp" || ssh.Preset != "ssh" || ssh.Path != "" || ssh.Port != 47847 || !ssh.Available {
		t.Fatalf("ssh=%#v", ssh)
	}
	if docs := byID["docs"]; docs.Protocol != "http" || docs.Path != "/guide" {
		t.Fatalf("docs=%#v", docs)
	}
}

func TestRuntimePublishesCurrentLaunchPathPerManifestRequest(t *testing.T) {
	t.Parallel()
	node := &fakeNode{}
	launch := "/?token=first"
	var mu sync.Mutex
	runtime := New(node, testAuthorizer).WithLaunchPath(func(service velaconfig.LocalService) string {
		if service.ID != "dsh" {
			return ""
		}
		mu.Lock()
		defer mu.Unlock()
		return launch
	})
	health := map[string]services.State{"dsh": services.StateAvailable, "docs": services.StateAvailable}
	definitions := []velaconfig.LocalService{
		{ID: "dsh", Name: "DSH", Protocol: velaconfig.ProtocolHTTP, URL: "http://127.0.0.1:3080/", Port: 47846, Shared: true, Adapter: "dsh"},
		{ID: "docs", Name: "Docs", Protocol: velaconfig.ProtocolHTTP, URL: "http://127.0.0.1:3000/guide", Port: 47848, Shared: true},
	}
	if err := runtime.Reconcile(context.Background(), true, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = runtime.Close() }()
	node.mu.Lock()
	control := node.listeners[0].Addr().String()
	node.mu.Unlock()
	fetch := func() map[string]manifest.Service {
		response, err := http.Get("http://" + control + "/vela/v1/manifest")
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var document manifest.Document
		if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
			t.Fatal(err)
		}
		byID := map[string]manifest.Service{}
		for _, service := range document.Services {
			byID[service.ID] = service
		}
		return byID
	}
	if first := fetch(); first["dsh"].Path != "/?token=first" || first["docs"].Path != "/guide" {
		t.Fatalf("first=%#v", first)
	}
	mu.Lock()
	launch = "/?token=second"
	mu.Unlock()
	if second := fetch(); second["dsh"].Path != "/?token=second" {
		t.Fatalf("a restarted DSH must be published without reconciling again, got %#v", second["dsh"])
	}
}

func TestLocalAddressAcceptsLoopbackTCPTargets(t *testing.T) {
	t.Parallel()
	if address, err := localAddress("tcp://[::1]:22"); err != nil || address != "[::1]:22" {
		t.Fatalf("address=%q err=%v", address, err)
	}
	if _, err := localAddress("tcp://192.168.1.2:22"); err == nil {
		t.Fatal("accepted non-loopback TCP target")
	}
}

// A published TCP service carries raw bytes both ways without touching them:
// no HTTP parsing, no added headers, and a payload containing what looks like
// an HTTP request line arrives verbatim. This is what lets SSH, Redis and
// databases ride the same tunnel as web services.
func TestRuntimeForwardsTCPBytesVerbatim(t *testing.T) {
	t.Parallel()
	target, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer target.Close()
	go func() {
		for {
			connection, err := target.Accept()
			if err != nil {
				return
			}
			go func() {
				defer connection.Close()
				_, _ = connection.Write([]byte("SSH-2.0-Vela_test\r\n"))
				buffer := make([]byte, 4096)
				for {
					read, err := connection.Read(buffer)
					if err != nil {
						return
					}
					_, _ = connection.Write(buffer[:read])
				}
			}()
		}
	}()

	node := &fakeNode{}
	runtime := New(node, testAuthorizer)
	definitions := []velaconfig.LocalService{{
		ID: "ssh", Name: "SSH", Protocol: velaconfig.ProtocolTCP,
		URL: "tcp://" + target.Addr().String(), Port: 47870, Shared: true,
	}}
	health := map[string]services.State{"ssh": services.StateAvailable}
	if err := runtime.Reconcile(context.Background(), true, true, definitions, health, "Home Mac"); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = runtime.Close() }()

	node.mu.Lock()
	var published string
	for index, address := range node.addresses {
		if address == ":47870" {
			published = node.listeners[index].Addr().String()
		}
	}
	node.mu.Unlock()
	if published == "" {
		t.Fatalf("the TCP service was not published on its tailnet port: %v", node.addresses)
	}

	client, err := net.Dial("tcp", published)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	reader := bufio.NewReader(client)
	banner, err := reader.ReadString('\n')
	if err != nil || banner != "SSH-2.0-Vela_test\r\n" {
		t.Fatalf("the server banner must reach the client verbatim: %q err=%v", banner, err)
	}
	payload := "GET / HTTP/1.1\r\nHost: should-not-be-rewritten\r\n\r\n\x00\xff binary tail"
	if _, err := client.Write([]byte(payload)); err != nil {
		t.Fatal(err)
	}
	echoed := make([]byte, len(payload))
	if _, err := io.ReadFull(reader, echoed); err != nil {
		t.Fatal(err)
	}
	if string(echoed) != payload {
		t.Fatalf("TCP bytes must not be parsed or rewritten:\nsent %q\ngot  %q", payload, echoed)
	}
}
