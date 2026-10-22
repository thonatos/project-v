package inbound

import (
	"context"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/thonatos/project-v/vela/core/internal/adapters"
	"github.com/thonatos/project-v/vela/core/internal/authorization"
	"tailscale.com/client/tailscale/apitype"
	"tailscale.com/tailcfg"
)

type resolver struct {
	allowAfter int32
	calls      atomic.Int32
}

func (resolver *resolver) WhoIs(context.Context, string) (*apitype.WhoIsResponse, error) {
	login := "denied@example.com"
	if resolver.calls.Add(1) > resolver.allowAfter {
		login = "owner@example.com"
	}
	return &apitype.WhoIsResponse{Node: &tailcfg.Node{}, UserProfile: &tailcfg.UserProfile{LoginName: login}}, nil
}

func TestAuthorizedListenerDropsDeniedConnection(t *testing.T) {
	t.Parallel()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	identity := &resolver{allowAfter: 1}
	authorized := AuthorizedListener{Listener: listener, Authorizer: authorization.Authorizer{Resolver: identity, Policy: authorization.Policy{OwnerLogin: "owner@example.com"}}}
	denied, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer denied.Close()
	accepted := make(chan net.Conn, 1)
	go func() {
		connection, _ := authorized.Accept()
		accepted <- connection
	}()
	allowed, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer allowed.Close()
	if connection := <-accepted; connection == nil {
		t.Fatal("allowed connection was not accepted")
	} else {
		_ = connection.Close()
	}
}

func TestAdaptListenerNormalizesDSHFirstRequest(t *testing.T) {
	t.Parallel()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	adapted := AdaptListener{Listener: listener, Adapter: string(adapters.DSH)}
	result := make(chan string, 1)
	go func() {
		connection, acceptErr := adapted.Accept()
		if acceptErr != nil {
			result <- acceptErr.Error()
			return
		}
		defer connection.Close()
		content, _ := io.ReadAll(connection)
		result <- string(content)
	}()
	client, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	_, _ = io.WriteString(client, "GET /rpc HTTP/1.1\r\nHost: 127.0.0.1:49152\r\nOrigin: http://127.0.0.1:49152\r\nAuthorization: Bearer secret\r\nConnection: close\r\n\r\n")
	_ = client.Close()
	content := <-result
	if !strings.Contains(content, "Host: 127.0.0.1:3080") || !strings.Contains(content, "Origin: http://127.0.0.1:3080") || !strings.Contains(content, "Authorization: Bearer secret") {
		t.Fatalf("adapted request=%q", content)
	}
}
