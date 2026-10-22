package main

import (
	"bufio"
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/thonatos/project-v/vela/core/internal/protocol"
)

func TestProcessStdoutIsProtocolOnly(t *testing.T) {
	t.Parallel()
	binary := filepath.Join(t.TempDir(), "vela-core")
	build := exec.Command("go", "build", "-o", binary, ".")
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, output)
	}

	command := exec.Command(binary)
	command.Stdin = strings.NewReader(`{"version":1,"id":"status-1","type":"status.get","payload":{}}` + "\n" + `{"version":1,"id":"shutdown-1","type":"shutdown","payload":{}}`)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	command.Env = os.Environ()
	if err := command.Run(); err != nil {
		t.Fatalf("run: %v, stderr: %s", err, stderr.String())
	}

	scanner := bufio.NewScanner(&stdout)
	count := 0
	for scanner.Scan() {
		count++
		if _, err := protocol.DecodeLine(scanner.Bytes()); err != nil {
			t.Fatalf("stdout line %d is not protocol: %q: %v", count, scanner.Text(), err)
		}
	}
	if count != 2 {
		t.Fatalf("stdout lines = %d, want 2; stdout=%q", count, stdout.String())
	}
	if !strings.Contains(stderr.String(), "control loop started") {
		t.Fatalf("stderr missing startup log: %q", stderr.String())
	}
}
