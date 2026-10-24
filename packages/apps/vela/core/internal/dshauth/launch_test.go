package dshauth

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const tokenA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const tokenB = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

func writeLog(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "web.stdout.log")
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLaunchPathUsesNewestMatchingLine(t *testing.T) {
	t.Parallel()
	log := writeLog(t, strings.Join([]string{
		"dsh web: http://127.0.0.1:3080/?token=" + tokenA + " (LAN: http://192.168.1.50:3080/?token=" + tokenA,
		"dsh web: opening the default browser; pass --no-open to disable",
		"dsh web: http://127.0.0.1:3080/?token=" + tokenB + " (LAN: http://192.168.1.50:3080/?token=" + tokenB,
		"",
	}, "\n"))
	path, err := LaunchPath(log, "http://127.0.0.1:3080/")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/?token="+tokenB {
		t.Fatalf("path=%q", path)
	}
}

func TestLaunchPathIgnoresOtherPortsAndShapes(t *testing.T) {
	t.Parallel()
	log := writeLog(t, strings.Join([]string{
		"dsh web: http://127.0.0.1:3080/?token=" + tokenA,
		"dsh web: http://127.0.0.1:4000/?token=" + tokenB,
		"dsh web: http://example.com:3080/?token=" + tokenB,
		"dsh web: http://127.0.0.1:3080/other?token=" + tokenB,
		"dsh web: http://127.0.0.1:3080/?token=" + tokenB + "&next=x",
		"dsh web: http://127.0.0.1:3080/?token=short",
	}, "\n"))
	path, err := LaunchPath(log, "http://127.0.0.1:3080/")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/?token="+tokenA {
		t.Fatalf("only the exact loopback launch shape on the service port may be used, got %q", path)
	}
}

func TestLaunchPathReportsMissingLaunchLine(t *testing.T) {
	t.Parallel()
	log := writeLog(t, "web-app: starting\n")
	if _, err := LaunchPath(log, "http://127.0.0.1:3080/"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err=%v", err)
	}
	if _, err := LaunchPath(filepath.Join(t.TempDir(), "missing.log"), "http://127.0.0.1:3080/"); err == nil {
		t.Fatal("a missing log must be an error")
	}
	if _, err := LaunchPath(t.TempDir(), "http://127.0.0.1:3080/"); err == nil {
		t.Fatal("a directory must not be read as a log")
	}
}

func TestLaunchPathReadsOnlyTheTail(t *testing.T) {
	t.Parallel()
	old := "dsh web: http://127.0.0.1:3080/?token=" + tokenA + "\n"
	log := writeLog(t, old+strings.Repeat("x", tailBytes)+"\n")
	if _, err := LaunchPath(log, "http://127.0.0.1:3080/"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a launch line older than the tail must not be used, err=%v", err)
	}
}

func TestExpandPath(t *testing.T) {
	t.Parallel()
	got, err := ExpandPath(" ~/.dsh/logs/web.log ", "/Users/me")
	if err != nil || got != "/Users/me/.dsh/logs/web.log" {
		t.Fatalf("got=%q err=%v", got, err)
	}
	if _, err := ExpandPath("logs/web.log", "/Users/me"); err == nil {
		t.Fatal("relative paths must be rejected")
	}
}
