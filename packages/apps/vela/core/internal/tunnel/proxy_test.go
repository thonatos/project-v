package tunnel

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestStreamingProxyCarriesHTTPAndUpgrades(t *testing.T) {
	t.Parallel()
	backend := startBackend(t)
	proxyListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	proxy := New(proxyListener, func(ctx context.Context) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp", backend)
	})
	done := make(chan error, 1)
	go func() { done <- proxy.Serve(context.Background()) }()
	baseURL := "http://" + proxyListener.Addr().String()

	response, err := http.Post(baseURL+"/upload", "text/plain", strings.NewReader(strings.Repeat("u", 128*1024)))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if len(body) != 128*1024 {
		t.Fatalf("upload echo bytes = %d", len(body))
	}

	response, err = http.Get(baseURL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(response.Body)
	response.Body.Close()
	if string(body) != "data: first\n\ndata: second\n\n" {
		t.Fatalf("SSE body = %q", body)
	}

	response, err = http.Get(baseURL + "/download")
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(response.Body)
	response.Body.Close()
	if string(body) != "vela-download" || response.Header.Get("Content-Disposition") == "" {
		t.Fatalf("download headers/body lost: %q %#v", body, response.Header)
	}

	connection, err := net.Dial("tcp", proxyListener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef"))
	_, _ = fmt.Fprintf(connection, "GET /ws HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: %s\r\n\r\n", proxyListener.Addr(), key)
	reader := bufio.NewReader(connection)
	status, _ := reader.ReadString('\n')
	if !strings.Contains(status, "101") {
		t.Fatalf("upgrade status = %q", status)
	}
	connection.Close()

	if err := proxy.Close(); err != nil {
		t.Fatal(err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestCloseReleasesLongIdleFlow(t *testing.T) {
	t.Parallel()
	backend, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer backend.Close()
	proxyListener, _ := net.Listen("tcp", "127.0.0.1:0")
	proxy := New(proxyListener, func(ctx context.Context) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp", backend.Addr().String())
	})
	go proxy.Serve(context.Background())
	client, err := net.Dial("tcp", proxyListener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	accepted, err := backend.Accept()
	if err != nil {
		t.Fatal(err)
	}
	defer accepted.Close()
	deadline := time.Now().Add(time.Second)
	if err := proxy.Close(); err != nil {
		t.Fatal(err)
	}
	_ = client.SetReadDeadline(deadline)
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("idle flow remained open after Close")
	}
}

func startBackend(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/upload", func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		_, _ = writer.Write(body)
	})
	mux.HandleFunc("/events", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/event-stream")
		flusher := writer.(http.Flusher)
		_, _ = io.WriteString(writer, "data: first\n\n")
		flusher.Flush()
		_, _ = io.WriteString(writer, "data: second\n\n")
	})
	mux.HandleFunc("/download", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Disposition", `attachment; filename="vela.txt"`)
		_, _ = io.WriteString(writer, "vela-download")
	})
	mux.HandleFunc("/ws", websocketUpgrade)
	server := &http.Server{Handler: mux, ReadHeaderTimeout: time.Second}
	go server.Serve(listener)
	t.Cleanup(func() { server.Close() })
	return listener.Addr().String()
}

func websocketUpgrade(writer http.ResponseWriter, request *http.Request) {
	hijacker := writer.(http.Hijacker)
	connection, buffer, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer connection.Close()
	accept := sha1.Sum([]byte(request.Header.Get("Sec-WebSocket-Key") + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	_, _ = fmt.Fprintf(buffer, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", base64.StdEncoding.EncodeToString(accept[:]))
	_ = buffer.Flush()
}
