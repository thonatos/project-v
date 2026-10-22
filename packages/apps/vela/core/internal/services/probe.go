// Package services detects the fixed local development services supported by Vela.
package services

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// State is the externally visible health classification.
type State string

const (
	StateChecking    State = "checking"
	StateAvailable   State = "available"
	StateUnavailable State = "unavailable"
)

// Service is one loopback target. An empty Protocol means HTTP.
type Service struct {
	ID       string
	Name     string
	Protocol string
	URL      string
	Timeout  time.Duration
}

// Result reports reachability without leaking response bodies.
type Result struct {
	ServiceID  string
	State      State
	Reason     string
	StatusCode int
	CheckedAt  time.Time
}

// Defaults returns the only services Vela v1 may probe or share.
func Defaults() []Service {
	return []Service{
		{ID: "opencode", Name: "OpenCode", URL: "http://127.0.0.1:49374/api/info", Timeout: 2 * time.Second},
		{ID: "dsh", Name: "DSH", URL: "http://127.0.0.1:3080/", Timeout: 2 * time.Second},
	}
}

// Prober performs direct loopback-only HTTP checks and ignores environment
// proxies. TCP targets are checked without connecting; Netstat overrides the
// listening-table reader used for privileged ports.
type Prober struct {
	Client  *http.Client
	Now     func() time.Time
	Netstat NetstatFunc
}

// NewProber creates a client that can never proxy a loopback health request.
func NewProber() *Prober {
	dialer := &net.Dialer{}
	return &Prober{
		Client: &http.Client{Transport: &http.Transport{
			Proxy: nil,
			DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
				host, _, err := net.SplitHostPort(address)
				if err != nil || (host != "127.0.0.1" && host != "::1" && host != "localhost") {
					return nil, errors.New("service probe target is not loopback")
				}
				return dialer.DialContext(ctx, network, address)
			},
		}, CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		}},
		Now: time.Now,
	}
}

// Probe checks one service. HTTP targets receive a GET whose body is never
// read; TCP targets are never connected to.
func (prober *Prober) Probe(ctx context.Context, service Service) Result {
	if service.Protocol == ProtocolTCP {
		return prober.probeTCP(ctx, service)
	}
	checkedAt := prober.Now().UTC()
	parsed, err := url.Parse(service.URL)
	if err != nil || parsed.Scheme != "http" || !isLoopbackHost(parsed.Hostname()) {
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "invalid_target", CheckedAt: checkedAt}
	}
	timeout := service.Timeout
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, service.URL, nil)
	if err != nil {
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "invalid_request", CheckedAt: checkedAt}
	}
	response, err := prober.Client.Do(request)
	if err != nil {
		reason := "connection_error"
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(requestContext.Err(), context.DeadlineExceeded) {
			reason = "timeout"
		} else if strings.Contains(strings.ToLower(err.Error()), "connection refused") {
			reason = "connection_refused"
		}
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: reason, CheckedAt: checkedAt}
	}
	response.Body.Close()
	if response.StatusCode >= 500 {
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "server_error", StatusCode: response.StatusCode, CheckedAt: checkedAt}
	}
	return Result{ServiceID: service.ID, State: StateAvailable, Reason: "responding", StatusCode: response.StatusCode, CheckedAt: checkedAt}
}

// Watch performs an immediate check and repeats until ctx is cancelled.
func (prober *Prober) Watch(ctx context.Context, service Service, interval time.Duration, results chan<- Result) {
	if interval <= 0 {
		interval = 10 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		results <- prober.Probe(ctx, service)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func isLoopbackHost(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// ValidateURL accepts only plain HTTP loopback targets owned by this Mac.
func ValidateURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "http" || parsed.Host == "" || !isLoopbackHost(parsed.Hostname()) {
		return errors.New("service URL must use http on localhost, 127.0.0.1 or ::1")
	}
	return nil
}
