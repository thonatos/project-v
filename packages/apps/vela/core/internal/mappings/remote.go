package mappings

import (
	"context"
	"fmt"
	"net"
)

type TailnetDialer interface {
	Dial(context.Context, string, string) (net.Conn, error)
}

// RemoteDial converts a fixed service key into a tailnet destination.
type ResolvePort func(device, service string) (int, bool)

func RemoteDial(node TailnetDialer, resolve ResolvePort) DialRemote {
	return func(ctx context.Context, key Key) (net.Conn, error) {
		if key.Device == "" {
			return nil, fmt.Errorf("remote Vela device is required")
		}
		port, ok := resolve(key.Device, key.Service)
		if !ok || port <= 0 {
			return nil, fmt.Errorf("remote service is not published: %s", key.Service)
		}
		return node.Dial(ctx, "tcp", fmt.Sprintf("%s:%d", key.Device, port))
	}
}
