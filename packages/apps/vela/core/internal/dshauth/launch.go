// Package dshauth finds the launch path of a running DSH Web server.
//
// DSH generates a fresh launch token every time its process starts and prints
// it once, as `dsh web: http://127.0.0.1:<port>/?token=<token>`. A browser that
// opens that URL receives DSH's own signed cookie, so the sharing Mac reads the
// most recent line from DSH's output log and publishes only `/?token=<token>`
// to authorized devices. Nothing else from the log ever leaves this package,
// and the token is never written to Vela's configuration.
package dshauth

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// tailBytes bounds how much of the log is read; the launch line is printed at
// every start, so the newest one is always near the end.
const tailBytes = 64 * 1024

var launchLine = regexp.MustCompile(`dsh web: (http://[^\s()]+)`)

var tokenPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{16,256}$`)

// ErrNotFound means the log holds no launch URL for this DSH target.
var ErrNotFound = errors.New("DSH launch URL not found in log")

// ExpandPath resolves a leading `~/` against home and requires an absolute path.
func ExpandPath(raw, home string) (string, error) {
	path := strings.TrimSpace(raw)
	if path == "~" || strings.HasPrefix(path, "~/") {
		path = filepath.Join(home, strings.TrimPrefix(path, "~"))
	}
	if !filepath.IsAbs(path) {
		return "", errors.New("DSH log path must be absolute or start with ~/")
	}
	return filepath.Clean(path), nil
}

// LaunchPath returns `/?token=<token>` from the newest launch line in logPath
// whose loopback port matches target, the DSH service's own loopback URL.
func LaunchPath(logPath, target string) (string, error) {
	wanted, err := url.Parse(target)
	if err != nil || wanted.Port() == "" {
		return "", errors.New("DSH target must include a loopback port")
	}
	file, err := os.Open(logPath)
	if err != nil {
		return "", fmt.Errorf("open DSH log: %w", err)
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", fmt.Errorf("read DSH log: %w", err)
	}
	if !info.Mode().IsRegular() {
		return "", errors.New("DSH log is not a regular file")
	}
	offset := max(info.Size()-tailBytes, 0)
	tail, err := io.ReadAll(io.NewSectionReader(file, offset, info.Size()-offset))
	if err != nil {
		return "", fmt.Errorf("read DSH log: %w", err)
	}
	matches := launchLine.FindAllSubmatch(tail, -1)
	for index := len(matches) - 1; index >= 0; index-- {
		if path, ok := launchPathFrom(string(matches[index][1]), wanted.Port()); ok {
			return path, nil
		}
	}
	return "", ErrNotFound
}

// launchPathFrom accepts exactly DSH's launch shape: a loopback root URL on the
// expected port carrying one token and nothing else.
func launchPathFrom(raw, port string) (string, bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "http" || parsed.User != nil || parsed.Fragment != "" || parsed.Path != "/" {
		return "", false
	}
	if host := parsed.Hostname(); host != "127.0.0.1" && host != "localhost" && host != "::1" {
		return "", false
	}
	if parsed.Port() != port {
		return "", false
	}
	query := parsed.Query()
	tokens := query["token"]
	if len(query) != 1 || len(tokens) != 1 || !tokenPattern.MatchString(tokens[0]) {
		return "", false
	}
	return "/?" + url.Values{"token": tokens}.Encode(), true
}
