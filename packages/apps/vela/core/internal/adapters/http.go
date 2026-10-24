// Package adapters contains service-specific HTTP compatibility policy.
package adapters

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// ServiceID is restricted to Vela's two predefined local targets.
type ServiceID string

const (
	OpenCode ServiceID = "opencode"
	DSH      ServiceID = "dsh"
)

// ParseService rejects arbitrary proxy targets.
func ParseService(value string) (ServiceID, error) {
	switch ServiceID(value) {
	case OpenCode:
		return OpenCode, nil
	case DSH:
		return DSH, nil
	default:
		return "", errors.New("unknown Vela service")
	}
}

// RewriteRequest preserves HTTP semantics. For DSH only, loopback authorities
// are normalized to its fixed loopback target so Host and Origin stay same-origin.
func RewriteRequest(service ServiceID, request *http.Request) error {
	if _, err := ParseService(string(service)); err != nil {
		return err
	}
	if service != DSH {
		return nil
	}
	if !isLoopbackAuthority(request.Host) {
		return errors.New("DSH request authority is not loopback")
	}
	request.Host = "127.0.0.1:3080"
	origin := request.Header.Get("Origin")
	if origin == "" {
		return nil
	}
	parsed, err := url.Parse(origin)
	if err != nil || !isLoopbackAuthority(parsed.Host) {
		return errors.New("DSH request origin is not loopback")
	}
	parsed.Host = "127.0.0.1:3080"
	request.Header.Set("Origin", parsed.String())
	return nil
}

// ReadRequest reads one request from input and applies the service's policy.
// The body is left unread so the caller can stream it.
func ReadRequest(service ServiceID, input *bufio.Reader) (*http.Request, error) {
	request, err := http.ReadRequest(input)
	if err != nil {
		return nil, fmt.Errorf("read service request: %w", err)
	}
	if err := RewriteRequest(service, request); err != nil {
		_ = request.Body.Close()
		return nil, err
	}
	return request, nil
}

// RewriteHeaderBlock applies policy to the first HTTP request while preserving
// Cookie and Upgrade headers byte-for-byte through net/http serialization.
func RewriteHeaderBlock(service ServiceID, input *bufio.Reader) ([]byte, error) {
	request, err := ReadRequest(service, input)
	if err != nil {
		return nil, err
	}
	var output strings.Builder
	if err := request.Write(&output); err != nil {
		return nil, fmt.Errorf("write service request: %w", err)
	}
	return []byte(output.String()), nil
}

func isLoopbackAuthority(authority string) bool {
	host := authority
	if parsed, err := url.Parse("http://" + authority); err == nil {
		host = parsed.Hostname()
	}
	// Vela maps each remote service to a `<service>-<device>.localhost` name so
	// the system browser scopes cookies per service. RFC 6761 reserves the
	// whole `.localhost` tree for loopback, so its subdomains are as local as
	// `127.0.0.1` itself.
	return host == "localhost" || host == "127.0.0.1" || host == "::1" || strings.HasSuffix(host, ".localhost")
}
