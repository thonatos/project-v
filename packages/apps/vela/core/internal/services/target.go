package services

import (
	"net"
	"net/url"
	"strconv"
)

// TargetKey returns the loopback host and port a service dials, so Core can
// treat two entries pointing at the same local target as one service. The
// `localhost` name folds into `127.0.0.1`; IPv6 loopback stays distinct
// because a service may bind only IPv4.
func TargetKey(protocol, raw string) (string, error) {
	if protocol == ProtocolTCP {
		host, port, err := parseTCPTarget(raw)
		if err != nil {
			return "", err
		}
		return net.JoinHostPort(foldTargetHost(host), strconv.Itoa(port)), nil
	}
	if err := ValidateURL(raw); err != nil {
		return "", err
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	port := parsed.Port()
	if port == "" {
		port = "80"
	}
	return net.JoinHostPort(foldTargetHost(parsed.Hostname()), port), nil
}

func foldTargetHost(host string) string {
	if host == "localhost" {
		return "127.0.0.1"
	}
	return host
}
