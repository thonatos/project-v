package services

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"net"
	"net/url"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

// Service target protocols.
const (
	ProtocolHTTP = "http"
	ProtocolTCP  = "tcp"
)

// ValidateTarget checks a service target for its declared protocol. Both
// protocols accept only loopback hosts owned by this Mac.
func ValidateTarget(protocol, raw string) error {
	switch protocol {
	case ProtocolHTTP:
		return ValidateURL(raw)
	case ProtocolTCP:
		_, _, err := parseTCPTarget(raw)
		return err
	default:
		return errors.New("service protocol must be http or tcp")
	}
}

// parseTCPTarget accepts exactly tcp://<loopback-host>:<port>.
func parseTCPTarget(raw string) (string, int, error) {
	invalid := errors.New("TCP service URL must be tcp://localhost, 127.0.0.1 or [::1] with a port from 1 to 65535 and no path")
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != ProtocolTCP || parsed.Opaque != "" || parsed.User != nil ||
		parsed.Path != "" || parsed.RawPath != "" || parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" {
		return "", 0, invalid
	}
	host, portText, err := net.SplitHostPort(parsed.Host)
	if err != nil || !isLoopbackHost(host) {
		return "", 0, invalid
	}
	port, err := strconv.Atoi(portText)
	if err != nil || port < 1 || port > 65535 || strconv.Itoa(port) != portText {
		return "", 0, invalid
	}
	return host, port, nil
}

// NetstatFunc returns the output of `netstat -an`.
type NetstatFunc func(context.Context) ([]byte, error)

// systemNetstat reads the socket table. It deliberately omits `-p tcp`: on
// macOS that filter makes netstat print nothing when its output is a pipe
// rather than a terminal, which is always the case for Core. Rows are filtered
// to TCP in netstatListening instead.
func systemNetstat(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "/usr/sbin/netstat", "-an").Output()
}

// listenerState reports whether something listens on a port by trying to bind
// an address without SO_REUSEADDR. It never connects to or sends bytes to the
// target, so handshake-sensitive services (SSH, MySQL) never see a probe.
// EADDRINUSE means a listener owns the port.
//
// `wildcard` binds `0.0.0.0` / `::` instead of the loopback address. For a
// privileged port that is the only bind that answers without root: macOS
// reports a port already in use before it checks privilege for the wildcard
// address, while a loopback bind returns EACCES and says nothing.
func listenerState(ipv6, wildcard bool, port int) (bool, error) {
	family := syscall.AF_INET
	var address syscall.Sockaddr = &syscall.SockaddrInet4{Port: port, Addr: [4]byte{127, 0, 0, 1}}
	if wildcard {
		address = &syscall.SockaddrInet4{Port: port}
	}
	if ipv6 {
		family = syscall.AF_INET6
		loopback := &syscall.SockaddrInet6{Port: port}
		if !wildcard {
			loopback.Addr[15] = 1
		}
		address = loopback
	}
	fd, err := syscall.Socket(family, syscall.SOCK_STREAM, syscall.IPPROTO_TCP)
	if err != nil {
		return false, err
	}
	defer syscall.Close(fd)
	if ipv6 {
		// Keep the IPv6 bind from also claiming the IPv4 port, so the two
		// families are judged independently.
		_ = syscall.SetsockoptInt(fd, syscall.IPPROTO_IPV6, syscall.IPV6_V6ONLY, 1)
	}
	switch err := syscall.Bind(fd, address); {
	case err == nil:
		return false, nil
	case errors.Is(err, syscall.EADDRINUSE):
		return true, nil
	default:
		return false, err
	}
}

// netstatListening reports whether the netstat table contains a TCP listener
// reachable from the requested loopback family.
func netstatListening(output []byte, port int, ipv4, ipv6 bool) bool {
	suffix := "." + strconv.Itoa(port)
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 6 || fields[len(fields)-1] != "LISTEN" || !strings.HasPrefix(fields[0], "tcp") {
			continue
		}
		local := fields[3]
		if !strings.HasSuffix(local, suffix) {
			continue
		}
		host := strings.TrimSuffix(local, suffix)
		family := fields[0]
		v4Socket := family == "tcp4" || family == "tcp46"
		v6Socket := family == "tcp6" || family == "tcp46"
		switch {
		case host == "*" && ((ipv4 && v4Socket) || (ipv6 && v6Socket)):
			return true
		case host == "127.0.0.1" && ipv4 && v4Socket:
			return true
		case host == "::1" && ipv6 && v6Socket:
			return true
		}
	}
	return false
}

// probeTCP decides availability without ever opening a connection.
func (prober *Prober) probeTCP(ctx context.Context, service Service) Result {
	checkedAt := prober.Now().UTC()
	host, port, err := parseTCPTarget(service.URL)
	if err != nil {
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "invalid_target", CheckedAt: checkedAt}
	}
	ipv4, ipv6 := host != "::1", host != "127.0.0.1"
	listening, err := false, error(nil)
	if port >= 1024 {
		listening, err = bindListening(ipv4, ipv6, false, port)
	} else {
		// A wildcard listener (sshd's default) answers a wildcard bind with
		// EADDRINUSE even without root. Only a loopback-only listener on a
		// privileged port still needs the socket table.
		listening, err = bindListening(ipv4, ipv6, true, port)
		if !listening {
			err = syscall.EACCES
		}
	}
	if !listening && errors.Is(err, syscall.EACCES) {
		netstat := prober.Netstat
		if netstat == nil {
			netstat = systemNetstat
		}
		var output []byte
		if output, err = netstat(ctx); err == nil {
			listening = netstatListening(output, port, ipv4, ipv6)
		}
	}
	switch {
	case err != nil:
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "probe_error", CheckedAt: checkedAt}
	case listening:
		return Result{ServiceID: service.ID, State: StateAvailable, Reason: "listening", CheckedAt: checkedAt}
	default:
		return Result{ServiceID: service.ID, State: StateUnavailable, Reason: "not_listening", CheckedAt: checkedAt}
	}
}

func bindListening(ipv4, ipv6, wildcard bool, port int) (bool, error) {
	var problems []error
	if ipv4 {
		listening, err := listenerState(false, wildcard, port)
		if listening {
			return true, nil
		}
		problems = append(problems, err)
	}
	if ipv6 {
		listening, err := listenerState(true, wildcard, port)
		if listening {
			return true, nil
		}
		// A Mac without IPv6 loopback cannot have an ::1 listener.
		if !errors.Is(err, syscall.EAFNOSUPPORT) && !errors.Is(err, syscall.EADDRNOTAVAIL) {
			problems = append(problems, err)
		}
	}
	return false, errors.Join(problems...)
}
