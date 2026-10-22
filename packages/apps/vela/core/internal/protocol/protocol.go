// Package protocol implements the versioned JSON Lines control envelope.
package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
)

// Version is the only control protocol version accepted by this build.
const Version uint16 = 1

// Message is one JSON Lines record. Payload validation belongs to the handler
// for Kind after the envelope has passed DecodeLine.
type Message struct {
	Version uint16          `json:"version"`
	ID      string          `json:"id,omitempty"`
	Kind    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ErrorPayload is the stable error object returned over the control channel.
type ErrorPayload struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

// Error classifies envelope failures without exposing parser internals to the UI.
type Error struct {
	Code    string
	Message string
}

func (err *Error) Error() string { return err.Message }

// DecodeLine decodes and validates exactly one JSON Lines record.
func DecodeLine(line []byte) (Message, error) {
	decoder := json.NewDecoder(bytes.NewReader(line))
	decoder.DisallowUnknownFields()
	var message Message
	if err := decoder.Decode(&message); err != nil {
		return Message{}, &Error{Code: "invalid_json", Message: fmt.Sprintf("invalid JSON: %v", err)}
	}
	if decoder.More() {
		return Message{}, &Error{Code: "invalid_json", Message: "invalid JSON: trailing value"}
	}
	if err := Validate(message); err != nil {
		return Message{}, err
	}
	return message, nil
}

// EncodeLine validates and serializes one message without a trailing newline.
func EncodeLine(message Message) ([]byte, error) {
	if err := Validate(message); err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(message)
	if err != nil {
		return nil, &Error{Code: "invalid_json", Message: fmt.Sprintf("invalid JSON: %v", err)}
	}
	return encoded, nil
}

// Validate checks protocol version, vocabulary and correlation requirements.
func Validate(message Message) error {
	if message.Version != Version {
		return &Error{Code: "unsupported_version", Message: fmt.Sprintf("unsupported protocol version: %d", message.Version)}
	}
	if _, ok := knownTypes[message.Kind]; !ok {
		return &Error{Code: "unsupported_message", Message: fmt.Sprintf("unsupported message type: %s", message.Kind)}
	}
	if requiresID(message.Kind) && message.ID == "" {
		return &Error{Code: "missing_id", Message: fmt.Sprintf("message %s requires an id", message.Kind)}
	}
	return nil
}

// IsCode reports whether err is a protocol error with the given stable code.
func IsCode(err error, code string) bool {
	var protocolError *Error
	return errors.As(err, &protocolError) && protocolError.Code == code
}

func requiresID(kind string) bool {
	return kind != "error" && kind != "stopped" && (len(kind) < len("event.") || kind[:len("event.")] != "event.")
}

var knownTypes = map[string]struct{}{
	"status.get": {}, "status": {},
	"events.subscribe": {}, "events.subscribed": {},
	"event.network": {}, "event.service": {}, "event.remote": {}, "event.mapping": {},
	"auth.start": {}, "auth.reconnect": {}, "auth.logout": {}, "auth.url": {},
	"sharing.get": {}, "sharing.update": {}, "sharing": {},
	"services.refresh": {}, "services": {},
	"device.update": {}, "service.upsert": {}, "service.remove": {},
	"remote.add": {}, "remote.remove": {}, "remote.refresh": {}, "remotes": {},
	"mapping.open": {}, "mapping.close": {}, "mapping": {},
	"preferences.update": {}, "preferences": {},
	"diagnostics.logs": {}, "diagnostics.activity": {},
	"shutdown": {}, "stopped": {}, "error": {},
}
