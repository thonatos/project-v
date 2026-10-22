// Package inbound prepares authorized tailnet connections before they reach a local service.
package inbound

import (
	"bufio"
	"bytes"
	"context"
	"net"
	"sync"

	"github.com/thonatos/project-v/vela/core/internal/adapters"
	"github.com/thonatos/project-v/vela/core/internal/authorization"
)

// AuthorizedListener drops denied peers before a proxy can dial its local target.
type AuthorizedListener struct {
	net.Listener
	Authorizer authorization.Authorizer
}

// Accept returns only connections allowed by the current identity policy.
func (listener AuthorizedListener) Accept() (net.Conn, error) {
	for {
		connection, err := listener.Listener.Accept()
		if err != nil {
			return nil, err
		}
		if _, err := listener.Authorizer.Authorize(context.Background(), connection.RemoteAddr().String()); err != nil {
			_ = connection.Close()
			continue
		}
		return connection, nil
	}
}

// AdaptListener applies the selected service's narrowly scoped HTTP compatibility policy.
type AdaptListener struct {
	net.Listener
	Adapter string
}

// Accept wraps DSH connections so only their first request header is normalized.
func (listener AdaptListener) Accept() (net.Conn, error) {
	connection, err := listener.Listener.Accept()
	if err != nil {
		return nil, err
	}
	if listener.Adapter != string(adapters.DSH) {
		return connection, nil
	}
	return &adaptedConnection{Conn: connection, service: adapters.DSH}, nil
}

type adaptedConnection struct {
	net.Conn
	service adapters.ServiceID
	once    sync.Once
	reader  *bufio.Reader
	err     error
}

func (connection *adaptedConnection) Read(buffer []byte) (int, error) {
	connection.once.Do(func() {
		input := bufio.NewReader(connection.Conn)
		header, err := adapters.RewriteHeaderBlock(connection.service, input)
		if err != nil {
			connection.err = err
			return
		}
		connection.reader = bufio.NewReader(&joinedReader{first: bytes.NewReader(header), rest: input})
	})
	if connection.err != nil {
		return 0, connection.err
	}
	return connection.reader.Read(buffer)
}

type joinedReader struct {
	first *bytes.Reader
	rest  *bufio.Reader
}

func (reader *joinedReader) Read(buffer []byte) (int, error) {
	if reader.first.Len() > 0 {
		return reader.first.Read(buffer)
	}
	return reader.rest.Read(buffer)
}
