// Package control owns the stdin/stdout lifecycle of the Vela helper.
package control

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/thonatos/project-v/vela/core/internal/protocol"
)

// Server processes one request at a time and emits protocol records only to Out.
type Server struct {
	In           io.Reader
	Out          io.Writer
	Logger       *log.Logger
	OpenMapping  func(context.Context, string, string) (string, error)
	CloseMapping func(string, string) error
	Shutdown     func() error
	AuthStatus   func(context.Context) (any, error)
	AuthStart    func(context.Context) (any, error)
	AuthLogout   func(context.Context) (any, error)
	// AuthReconnect re-checks the current identity against control without
	// starting an interactive login. When nil, auth.reconnect falls back to
	// AuthStart.
	AuthReconnect      func(context.Context) (any, error)
	Status             func(context.Context) (any, error)
	SharingGet         func() (any, error)
	SharingSet         func(json.RawMessage) (any, error)
	Services           func(context.Context) (any, error)
	DeviceUpdate       func(context.Context, string) (any, error)
	ServiceUpsert      func(json.RawMessage) (any, error)
	ServiceRemove      func(string) (any, error)
	Remotes            func() (any, error)
	RemoteRefresh      func(context.Context) (any, error)
	RemoteAdd          func(context.Context, string) (any, error)
	RemoteRemove       func(string) error
	PreferencesSet     func(json.RawMessage) (any, error)
	DiagnosticLogs     func() (any, error)
	DiagnosticActivity func() (any, error)
}

// Run serves until stdin closes, the context is cancelled, or shutdown succeeds.
func (server Server) Run(ctx context.Context) error {
	logger := server.Logger
	if logger == nil {
		logger = log.New(io.Discard, "", 0)
	}
	logger.Print("vela-core control loop started")

	scanner := bufio.NewScanner(server.In)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	writer := bufio.NewWriter(server.Out)
	defer writer.Flush()

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		message, err := protocol.DecodeLine(scanner.Bytes())
		if err != nil {
			if writeErr := writeMessage(writer, errorMessage("", err)); writeErr != nil {
				return writeErr
			}
			continue
		}

		response, stop := server.handle(ctx, message)
		if err := writeMessage(writer, response); err != nil {
			return err
		}
		if stop {
			logger.Print("vela-core control loop stopped")
			return nil
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read control input: %w", err)
	}
	logger.Print("vela-core control input closed")
	return nil
}

func (server Server) handle(ctx context.Context, message protocol.Message) (protocol.Message, bool) {
	switch message.Kind {
	case "status.get":
		if server.Status != nil {
			state, err := server.Status(ctx)
			if err != nil {
				return errorMessage(message.ID, &protocol.Error{Code: "status_failed", Message: err.Error()}), false
			}
			return response(message, "status", state), false
		}
		return response(message, "status", map[string]any{
			"network":  "offline",
			"sharing":  false,
			"services": map[string]string{"opencode": "checking", "dsh": "checking"},
		}), false
	case "events.subscribe":
		return response(message, "events.subscribed", map[string]any{}), false
	case "preferences.update":
		if server.PreferencesSet == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "preferences are unavailable"}), false
		}
		state, err := server.PreferencesSet(message.Payload)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "preferences_failed", Message: err.Error()}), false
		}
		return response(message, "preferences", state), false
	case "diagnostics.logs":
		if server.DiagnosticLogs == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "diagnostic logs are unavailable"}), false
		}
		state, err := server.DiagnosticLogs()
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "diagnostics_failed", Message: err.Error()}), false
		}
		return response(message, "diagnostics.logs", state), false
	case "diagnostics.activity":
		if server.DiagnosticActivity == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "diagnostic activity is unavailable"}), false
		}
		state, err := server.DiagnosticActivity()
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "diagnostics_failed", Message: err.Error()}), false
		}
		return response(message, "diagnostics.activity", state), false
	case "auth.reconnect":
		if server.AuthReconnect != nil {
			state, err := server.AuthReconnect(ctx)
			if err != nil {
				return errorMessage(message.ID, &protocol.Error{Code: "auth_failed", Message: err.Error()}), false
			}
			return response(message, "status", state), false
		}
		fallthrough
	case "auth.start":
		if server.AuthStart == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "authentication is unavailable"}), false
		}
		state, err := server.AuthStart(ctx)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "auth_failed", Message: err.Error()}), false
		}
		return response(message, "auth.url", state), false
	case "auth.logout":
		if server.AuthLogout == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "authentication is unavailable"}), false
		}
		state, err := server.AuthLogout(ctx)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "auth_failed", Message: err.Error()}), false
		}
		return response(message, "status", state), false
	case "sharing.get":
		if server.SharingGet == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "sharing is unavailable"}), false
		}
		state, err := server.SharingGet()
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "sharing_failed", Message: err.Error()}), false
		}
		return response(message, "sharing", state), false
	case "sharing.update":
		if server.SharingSet == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "sharing is unavailable"}), false
		}
		state, err := server.SharingSet(message.Payload)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "sharing_failed", Message: err.Error()}), false
		}
		return response(message, "sharing", state), false
	case "services.refresh":
		if server.Services == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "service detection is unavailable"}), false
		}
		state, err := server.Services(ctx)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "services_failed", Message: err.Error()}), false
		}
		return response(message, "services", state), false
	case "device.update":
		if server.DeviceUpdate == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "device settings are unavailable"}), false
		}
		var payload struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_device", Message: "device.update requires name"}), false
		}
		state, err := server.DeviceUpdate(ctx, payload.Name)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "device_failed", Message: err.Error()}), false
		}
		return response(message, "status", state), false
	case "service.upsert":
		if server.ServiceUpsert == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "service settings are unavailable"}), false
		}
		state, err := server.ServiceUpsert(message.Payload)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "service_failed", Message: err.Error()}), false
		}
		return response(message, "services", state), false
	case "service.remove":
		if server.ServiceRemove == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "service settings are unavailable"}), false
		}
		var payload struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.ID == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_service", Message: "service.remove requires id"}), false
		}
		state, err := server.ServiceRemove(payload.ID)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "service_failed", Message: err.Error()}), false
		}
		return response(message, "services", state), false
	case "remote.add":
		if server.RemoteAdd == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "remote devices are unavailable"}), false
		}
		var payload struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Name == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_remote", Message: "remote.add requires name"}), false
		}
		state, err := server.RemoteAdd(ctx, payload.Name)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "remote_failed", Message: err.Error()}), false
		}
		return response(message, "remotes", state), false
	case "remote.remove":
		if server.RemoteRemove == nil || server.Remotes == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "remote devices are unavailable"}), false
		}
		var payload struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Name == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_remote", Message: "remote.remove requires name"}), false
		}
		if err := server.RemoteRemove(payload.Name); err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "remote_failed", Message: err.Error()}), false
		}
		state, err := server.Remotes()
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "remote_failed", Message: err.Error()}), false
		}
		return response(message, "remotes", state), false
	case "remote.refresh":
		if server.RemoteRefresh == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "remote devices are unavailable"}), false
		}
		state, err := server.RemoteRefresh(ctx)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "remote_failed", Message: err.Error()}), false
		}
		return response(message, "remotes", state), false
	case "mapping.open":
		if server.OpenMapping == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "mapping service is unavailable"}), false
		}
		var payload struct {
			Device  string `json:"device"`
			Service string `json:"service"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Device == "" || payload.Service == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_mapping", Message: "mapping.open requires device and service"}), false
		}
		url, err := server.OpenMapping(ctx, payload.Device, payload.Service)
		if err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "mapping_failed", Message: err.Error()}), false
		}
		return response(message, "mapping", map[string]any{"device": payload.Device, "service": payload.Service, "state": "ready", "url": url}), false
	case "mapping.close":
		if server.CloseMapping == nil {
			return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "mapping service is unavailable"}), false
		}
		var payload struct {
			Device  string `json:"device"`
			Service string `json:"service"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Device == "" || payload.Service == "" {
			return errorMessage(message.ID, &protocol.Error{Code: "invalid_mapping", Message: "mapping.close requires device and service"}), false
		}
		if err := server.CloseMapping(payload.Device, payload.Service); err != nil {
			return errorMessage(message.ID, &protocol.Error{Code: "mapping_failed", Message: err.Error()}), false
		}
		return response(message, "mapping", map[string]any{"device": payload.Device, "service": payload.Service, "state": "closed"}), false
	case "shutdown":
		if server.Shutdown != nil {
			if err := server.Shutdown(); err != nil {
				return errorMessage(message.ID, &protocol.Error{Code: "shutdown_failed", Message: err.Error()}), false
			}
		}
		return protocol.Message{Version: protocol.Version, Kind: "stopped", Payload: json.RawMessage(`{}`)}, true
	default:
		return errorMessage(message.ID, &protocol.Error{Code: "not_implemented", Message: "message is recognized but not implemented"}), false
	}
}

func response(request protocol.Message, kind string, payload any) protocol.Message {
	encoded, _ := json.Marshal(payload)
	return protocol.Message{Version: protocol.Version, ID: request.ID, Kind: kind, Payload: encoded}
}

func errorMessage(id string, err error) protocol.Message {
	code := "invalid_request"
	if protocolError, ok := err.(*protocol.Error); ok {
		code = protocolError.Code
	}
	payload, _ := json.Marshal(protocol.ErrorPayload{Code: code, Message: err.Error(), Retryable: false})
	return protocol.Message{Version: protocol.Version, ID: id, Kind: "error", Payload: payload}
}

func writeMessage(writer *bufio.Writer, message protocol.Message) error {
	encoded, err := protocol.EncodeLine(message)
	if err != nil {
		return fmt.Errorf("encode control output: %w", err)
	}
	if _, err := writer.Write(append(encoded, '\n')); err != nil {
		return fmt.Errorf("write control output: %w", err)
	}
	if err := writer.Flush(); err != nil {
		return fmt.Errorf("flush control output: %w", err)
	}
	return nil
}
