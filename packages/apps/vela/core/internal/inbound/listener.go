// Package inbound prepares authorized tailnet connections before they reach a local service.
package inbound

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"strings"
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

// Accept wraps DSH connections so every request header on them is normalized.
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

// adaptedConnection rewrites each HTTP/1.1 request a browser sends on one
// kept-alive connection. Rewriting only the first request is not enough:
// DSH binds its session cookie to the request authority, so a reused
// connection would carry the mapping's own Host and be rejected. After a
// protocol upgrade (WebSocket) the remaining bytes are passed through.
type adaptedConnection struct {
	net.Conn
	service adapters.ServiceID
	once    sync.Once
	reader  *io.PipeReader
}

func (connection *adaptedConnection) Read(buffer []byte) (int, error) {
	connection.once.Do(func() {
		reader, writer := io.Pipe()
		connection.reader = reader
		go connection.rewrite(writer)
	})
	return connection.reader.Read(buffer)
}

// Close also stops the rewriting goroutine, which may be blocked writing.
func (connection *adaptedConnection) Close() error {
	if connection.reader != nil {
		_ = connection.reader.Close()
	}
	return connection.Conn.Close()
}

func (connection *adaptedConnection) rewrite(output *io.PipeWriter) {
	input := bufio.NewReader(connection.Conn)
	for {
		request, err := adapters.ReadRequest(connection.service, input)
		if err != nil {
			_ = output.CloseWithError(err)
			return
		}
		err = request.Write(output)
		_ = request.Body.Close()
		if err != nil {
			_ = output.CloseWithError(err)
			return
		}
		if upgrades(request) {
			_, err := input.WriteTo(output)
			_ = output.CloseWithError(err)
			return
		}
	}
}

// upgrades reports whether the connection leaves HTTP/1.1 after this request.
func upgrades(request *http.Request) bool {
	if request.Method == http.MethodConnect {
		return true
	}
	for _, value := range request.Header.Values("Connection") {
		for _, token := range strings.Split(value, ",") {
			if strings.EqualFold(strings.TrimSpace(token), "upgrade") {
				return true
			}
		}
	}
	return false
}
