// Package diagnostics produces privacy-preserving Vela support snapshots.
package diagnostics

import (
	"encoding/json"
	"regexp"
	"strings"
)

var sensitivePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(authorization|proxy-authorization)\s*:\s*[^\r\n]+`),
	regexp.MustCompile(`(?i)\bcookie\s*:\s*[^\r\n]+`),
	regexp.MustCompile(`(?i)\bset-cookie\s*:\s*[^\r\n]+`),
	regexp.MustCompile(`\btskey-[A-Za-z0-9_-]+`),
	regexp.MustCompile(`https://(?:login\.)?tailscale\.com/[^\s"']+`),
	regexp.MustCompile(`(?i)(?:token|code|key|secret|password)=([^&\s"']+)`),
}

// Snapshot contains only operational metadata safe to copy for support.
// It intentionally has no fields for request bodies, prompts or file content.
type Snapshot struct {
	Version        string            `json:"version"`
	NetworkState   string            `json:"networkState"`
	ConnectionType string            `json:"connectionType,omitempty"`
	Services       map[string]string `json:"services"`
	LastError      string            `json:"lastError,omitempty"`
}

// Redact removes credentials and authentication URLs from diagnostic text.
func Redact(value string) string {
	redacted := value
	for _, pattern := range sensitivePatterns {
		redacted = pattern.ReplaceAllStringFunc(redacted, func(match string) string {
			if strings.HasPrefix(match, "https://") {
				return "[REDACTED]"
			}
			if index := strings.Index(match, "="); index >= 0 {
				return match[:index+1] + "[REDACTED]"
			}
			if index := strings.Index(match, ":"); index >= 0 && !strings.HasPrefix(match, "https://") {
				return match[:index+1] + " [REDACTED]"
			}
			return "[REDACTED]"
		})
	}
	return redacted
}

// Marshal serializes a support snapshot after redacting its only free-text field.
func Marshal(snapshot Snapshot) ([]byte, error) {
	snapshot.LastError = Redact(snapshot.LastError)
	return json.MarshalIndent(snapshot, "", "  ")
}
