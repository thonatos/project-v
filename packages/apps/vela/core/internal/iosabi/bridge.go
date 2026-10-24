package iosabi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"implements.io/vela/internal/core"
	"implements.io/vela/internal/protocol"
)

// RequestTimeout bounds one control round trip so a wedged handler cannot
// hang the iOS C ABI call forever.
const RequestTimeout = 30 * time.Second

// Bridge runs one control.Server over in-memory pipes instead of the macOS
// helper's stdin/stdout. Rust calls Request through the C ABI and receives the
// same versioned JSON Lines the desktop host sees.
type Bridge struct {
	core      *core.Core
	requests  *io.PipeWriter
	responses *bufio.Reader
	cancel    context.CancelFunc
	done      chan struct{}
	closeOnce sync.Once

	mu     sync.Mutex
	seq    atomic.Uint64
	events []string
	event  sync.Mutex
}

// NewBridge starts the control loop. Close stops it.
func NewBridge(core *core.Core, logger *log.Logger) *Bridge {
	if logger == nil {
		logger = log.New(io.Discard, "", 0)
	}
	requestsIn, requestsOut := io.Pipe()
	responsesIn, responsesOut := io.Pipe()
	ctx, cancel := context.WithCancel(context.Background())
	bridge := &Bridge{
		core:      core,
		requests:  requestsOut,
		responses: bufio.NewReader(responsesIn),
		cancel:    cancel,
		done:      make(chan struct{}),
	}
	server := core.Server()
	server.In = requestsIn
	server.Out = responsesOut
	server.Logger = logger
	go func() {
		defer close(bridge.done)
		defer responsesOut.Close()
		if err := server.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
			logger.Printf("iOS control loop stopped: %v", err)
		}
	}()
	return bridge
}

// Request performs one control round trip.
func (bridge *Bridge) Request(kind string, payload json.RawMessage) (protocol.Message, error) {
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	id := fmt.Sprintf("ios-%d", bridge.seq.Add(1))
	message := protocol.Message{Version: protocol.Version, ID: id, Kind: kind, Payload: payload}
	line, err := protocol.EncodeLine(message)
	if err != nil {
		return protocol.Message{}, err
	}
	bridge.mu.Lock()
	defer bridge.mu.Unlock()
	if _, err := bridge.requests.Write(append(line, '\n')); err != nil {
		return protocol.Message{}, fmt.Errorf("write control input: %w", err)
	}
	response, err := bridge.readLine()
	if err != nil {
		return protocol.Message{}, err
	}
	return protocol.DecodeLine(bytes.TrimSuffix(response, []byte("\n")))
}

func (bridge *Bridge) readLine() ([]byte, error) {
	type result struct {
		line []byte
		err  error
	}
	ready := make(chan result, 1)
	go func() {
		line, err := bridge.responses.ReadBytes('\n')
		ready <- result{line: line, err: err}
	}()
	select {
	case value := <-ready:
		if value.err != nil {
			return nil, fmt.Errorf("read control output: %w", value.err)
		}
		return value.line, nil
	case <-time.After(RequestTimeout):
		return nil, errors.New("control request timed out")
	}
}

// RequestJSON is the shape the C ABI exports: JSON payload text in, one
// encoded response line out.
func (bridge *Bridge) RequestJSON(kind, payload string) (string, error) {
	body := json.RawMessage(payload)
	if len(body) == 0 {
		body = json.RawMessage(`{}`)
	}
	response, err := bridge.Request(kind, body)
	if err != nil {
		code := "control_failed"
		var protocolError *protocol.Error
		if errors.As(err, &protocolError) {
			code = protocolError.Code
		}
		return errorEnvelope(code, err.Error()), nil
	}
	encoded, err := protocol.EncodeLine(response)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

// QueueEvent appends one host-facing event drained by the Rust host. Go has
// no other way to call UIKit, so lifecycle and external-open intents travel
// back as events.
func (bridge *Bridge) QueueEvent(kind string, payload any) {
	body, err := json.Marshal(map[string]any{"type": kind, "payload": payload})
	if err != nil {
		return
	}
	bridge.event.Lock()
	defer bridge.event.Unlock()
	bridge.events = append(bridge.events, string(body))
}

// DrainEvents returns and clears queued events as a JSON array.
func (bridge *Bridge) DrainEvents() string {
	bridge.event.Lock()
	defer bridge.event.Unlock()
	if len(bridge.events) == 0 {
		return "[]"
	}
	entries := bridge.events
	bridge.events = nil
	body, err := json.Marshal(entries)
	if err != nil {
		return "[]"
	}
	return string(body)
}

// Close stops the control loop.
func (bridge *Bridge) Close() {
	bridge.closeOnce.Do(func() {
		bridge.cancel()
		_ = bridge.requests.Close()
		<-bridge.done
	})
}

func errorEnvelope(code, message string) string {
	payload, _ := json.Marshal(protocol.ErrorPayload{Code: code, Message: message, Retryable: false})
	message_, _ := json.Marshal(protocol.Message{
		Version: protocol.Version,
		Kind:    "error",
		Payload: payload,
	})
	return string(message_)
}
