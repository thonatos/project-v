package mappings

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"
)

type fakeDialer struct {
	address string
	err     error
}

func (dialer *fakeDialer) Dial(_ context.Context, network, address string) (net.Conn, error) {
	dialer.address = network + ":" + address
	return nil, dialer.err
}

func TestRemoteDialUsesPublishedServicePorts(t *testing.T) {
	t.Parallel()
	tests := []struct {
		service string
		port    int
	}{{"opencode", 47845}, {"docs", 47847}}
	for _, test := range tests {
		t.Run(test.service, func(t *testing.T) {
			dialer := &fakeDialer{err: errors.New("injected disconnect")}
			resolve := func(_, service string) (int, bool) { return test.port, service == test.service }
			_, err := RemoteDial(dialer, resolve)(context.Background(), Key{Device: "home.example.ts.net", Service: test.service})
			if err == nil || dialer.address != "tcp:home.example.ts.net:"+fmt.Sprint(test.port) {
				t.Fatalf("address=%q err=%v", dialer.address, err)
			}
		})
	}
}

func TestRemoteDialRejectsUnknownServiceBeforeNetwork(t *testing.T) {
	t.Parallel()
	dialer := &fakeDialer{}
	if _, err := RemoteDial(dialer, func(string, string) (int, bool) { return 0, false })(context.Background(), Key{Device: "home", Service: "arbitrary"}); err == nil {
		t.Fatal("expected unknown service rejection")
	}
	if dialer.address != "" {
		t.Fatalf("network dialed %q", dialer.address)
	}
}
