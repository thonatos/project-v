package remotes

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/thonatos/vela/core/internal/remoteclient"
)

func manifestTestAddress(server *httptest.Server) (string, int) {
	host, portText, _ := net.SplitHostPort(server.Listener.Addr().String())
	port, _ := strconv.Atoi(portText)
	return host, port
}

func TestManifestCheckerRecordsCompatiblePeer(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"version":2,"device":"Home Mac","services":[{"id":"opencode","name":"OpenCode","port":47845,"available":true}]}`))
	}))
	defer server.Close()
	host, port := manifestTestAddress(server)
	checker := &ManifestChecker{Cache: remoteclient.New(server.Client()), Port: port}
	result, err := checker.Check(context.Background(), host)
	state, ok := checker.State(host)
	if err != nil || result.DeviceName != "Home Mac" || !ok || state.Err != nil || len(state.Entry.Document.Services) != 1 {
		t.Fatalf("result=%#v state=%#v ok=%v err=%v", result, state, ok, err)
	}
}

func TestManifestCheckerClassifiesAndRecordsFailures(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, "upgrade", http.StatusUpgradeRequired)
	}))
	defer server.Close()
	host, port := manifestTestAddress(server)
	checker := &ManifestChecker{Cache: remoteclient.New(server.Client()), Port: port}
	_, err := checker.Check(context.Background(), host)
	state, ok := checker.State(host)
	if !errors.Is(err, ErrIncompatibleProtocol) || !ok || !errors.Is(state.Err, ErrIncompatibleProtocol) {
		t.Fatalf("state=%#v ok=%v err=%v", state, ok, err)
	}
}
