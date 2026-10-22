// Package tunnel streams TCP connections between Vela listeners and fixed targets.
package tunnel

import (
	"context"
	"errors"
	"io"
	"net"
	"sync"
)

// Dial opens the fixed destination for one accepted connection.
type Dial func(context.Context) (net.Conn, error)

// Proxy owns a listener and all active bidirectional copies.
type Proxy struct {
	listener net.Listener
	dial     Dial
	ctx      context.Context
	cancel   context.CancelFunc
	mu       sync.Mutex
	active   map[net.Conn]struct{}
	closed   bool
	serveWG  sync.WaitGroup
	wg       sync.WaitGroup
}

// New creates a streaming proxy without starting its accept loop.
func New(listener net.Listener, dial Dial) *Proxy {
	ctx, cancel := context.WithCancel(context.Background())
	proxy := &Proxy{listener: listener, dial: dial, ctx: ctx, cancel: cancel, active: map[net.Conn]struct{}{}}
	proxy.serveWG.Add(1)
	return proxy
}

// Serve accepts until Close is called or the listener fails.
func (proxy *Proxy) Serve(ctx context.Context) error {
	defer proxy.serveWG.Done()
	go func() {
		select {
		case <-ctx.Done():
			proxy.cancel()
			_ = proxy.listener.Close()
		case <-proxy.ctx.Done():
		}
	}()
	for {
		connection, err := proxy.listener.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) || proxy.ctx.Err() != nil || ctx.Err() != nil {
				return nil
			}
			return err
		}
		if !proxy.track(connection, true) {
			continue
		}
		proxy.wg.Add(1)
		go proxy.handle(proxy.ctx, connection)
	}
}

func (proxy *Proxy) handle(ctx context.Context, source net.Conn) {
	defer proxy.wg.Done()
	defer proxy.track(source, false)
	defer source.Close()
	target, err := proxy.dial(ctx)
	if err != nil {
		return
	}
	if !proxy.track(target, true) {
		return
	}
	defer proxy.track(target, false)
	defer target.Close()

	var copies sync.WaitGroup
	copies.Add(2)
	go copyHalf(&copies, target, source)
	go copyHalf(&copies, source, target)
	copies.Wait()
}

func copyHalf(group *sync.WaitGroup, destination, source net.Conn) {
	defer group.Done()
	_, _ = io.Copy(destination, source)
	if closeWriter, ok := destination.(interface{ CloseWrite() error }); ok {
		_ = closeWriter.CloseWrite()
	}
}

func (proxy *Proxy) track(connection net.Conn, add bool) bool {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()
	if add {
		if proxy.closed {
			_ = connection.Close()
			return false
		}
		proxy.active[connection] = struct{}{}
	} else {
		delete(proxy.active, connection)
	}
	return true
}

// Close stops accepting, closes active flows and waits for copy goroutines.
func (proxy *Proxy) Close() error {
	proxy.cancel()
	proxy.mu.Lock()
	proxy.closed = true
	proxy.mu.Unlock()
	err := proxy.listener.Close()
	proxy.serveWG.Wait()
	proxy.mu.Lock()
	for connection := range proxy.active {
		_ = connection.Close()
	}
	proxy.mu.Unlock()
	proxy.wg.Wait()
	if errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}
