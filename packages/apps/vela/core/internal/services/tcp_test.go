package services

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

func TestValidateTargetTCPContract(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"tcp://127.0.0.1:22", "tcp://localhost:3306", "tcp://[::1]:5432", "tcp://127.0.0.1:65535", "tcp://127.0.0.1:1"} {
		if err := ValidateTarget(ProtocolTCP, value); err != nil {
			t.Errorf("rejected %q: %v", value, err)
		}
	}
	for _, value := range []string{
		"tcp://192.168.1.2:22", "tcp://10.0.0.1:22", "tcp://8.8.8.8:53", "tcp://example.com:22", "tcp://0.0.0.0:22",
		"tcp://127.0.0.1", "tcp://127.0.0.1:0", "tcp://127.0.0.1:65536", "tcp://127.0.0.1:-1", "tcp://127.0.0.1:ssh", "tcp://127.0.0.1:022",
		"tcp://127.0.0.1:22/", "tcp://127.0.0.1:22/db", "tcp://127.0.0.1:22?x=1", "tcp://user@127.0.0.1:22", "tcp://127.0.0.1:22#frag",
		"tcp://::1:22", "http://127.0.0.1:22", "tcp:127.0.0.1:22", "",
	} {
		if ValidateTarget(ProtocolTCP, value) == nil {
			t.Errorf("accepted %q", value)
		}
	}
	if ValidateTarget(ProtocolHTTP, "http://192.168.1.2:3000") == nil || ValidateTarget(ProtocolHTTP, "tcp://127.0.0.1:22") == nil {
		t.Error("http protocol accepted an invalid target")
	}
	if err := ValidateTarget(ProtocolHTTP, "http://127.0.0.1:3000/path"); err != nil {
		t.Error(err)
	}
	if ValidateTarget("udp", "tcp://127.0.0.1:22") == nil {
		t.Error("accepted unknown protocol")
	}
}

// countingListener records whether Accept ever returned a connection.
func countingListener(t *testing.T, network, address string) (net.Listener, *atomic.Int32) {
	t.Helper()
	listener, err := net.Listen(network, address)
	if err != nil {
		t.Skipf("listen %s %s: %v", network, address, err)
	}
	var accepted atomic.Int32
	go func() {
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			accepted.Add(1)
			connection.Close()
		}
	}()
	t.Cleanup(func() { listener.Close() })
	return listener, &accepted
}

func noNetstat(context.Context) ([]byte, error) { return nil, errors.New("netstat must not be used") }

func TestTCPProbeDetectsListenersWithoutConnecting(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name, network, listen, host string
	}{
		{"ipv4-loopback", "tcp4", "127.0.0.1:0", "127.0.0.1"},
		{"ipv4-any", "tcp4", "0.0.0.0:0", "127.0.0.1"},
		{"ipv6-any-dual-stack", "tcp", "[::]:0", "127.0.0.1"},
		{"ipv6-any-localhost", "tcp", "[::]:0", "localhost"},
		{"ipv6-loopback", "tcp6", "[::1]:0", "[::1]"},
		{"ipv6-loopback-localhost", "tcp6", "[::1]:0", "localhost"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			listener, accepted := countingListener(t, test.network, test.listen)
			port := listener.Addr().(*net.TCPAddr).Port
			prober := &Prober{Now: time.Now, Netstat: noNetstat}
			target := fmt.Sprintf("tcp://%s:%d", test.host, port)
			for range 3 {
				result := prober.Probe(context.Background(), Service{ID: "tcp", Protocol: ProtocolTCP, URL: target})
				if result.State != StateAvailable || result.Reason != "listening" {
					t.Fatalf("result=%#v", result)
				}
			}
			time.Sleep(50 * time.Millisecond)
			if count := accepted.Load(); count != 0 {
				t.Fatalf("probe opened %d connections", count)
			}
		})
	}
}

func TestTCPProbeReportsFreePortUnavailable(t *testing.T) {
	t.Parallel()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	prober := &Prober{Now: time.Now, Netstat: noNetstat}
	result := prober.Probe(context.Background(), Service{ID: "tcp", Protocol: ProtocolTCP, URL: fmt.Sprintf("tcp://127.0.0.1:%d", port)})
	if result.State != StateUnavailable || result.Reason != "not_listening" {
		t.Fatalf("result=%#v", result)
	}
	// The probe's own bind must be released so the service can start.
	again, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("probe leaked its socket: %v", err)
	}
	again.Close()
}

func TestTCPProbeRejectsInvalidTarget(t *testing.T) {
	t.Parallel()
	prober := &Prober{Now: time.Now, Netstat: noNetstat}
	result := prober.Probe(context.Background(), Service{ID: "tcp", Protocol: ProtocolTCP, URL: "tcp://192.168.1.2:22"})
	if result.State != StateUnavailable || result.Reason != "invalid_target" {
		t.Fatalf("result=%#v", result)
	}
}

// The ports here are ones a Mac normally leaves free. A real listener on a
// fixture port (sshd on 22, a web server on 80) would be found by the wildcard
// bind before the injected table is read, so the fixture must not use them.
const sampleNetstat = `Active Internet connections (including servers)
Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)
tcp4       0      0  127.0.0.1.911          127.0.0.1.50000        ESTABLISHED
tcp4       0      0  127.0.0.1.3306         *.*                    LISTEN
tcp6       0      0  ::1.5432               *.*                    LISTEN
tcp46      0      0  *.981                  *.*                    LISTEN
tcp4       0      0  *.983                  *.*                    LISTEN
tcp6       0      0  *.985                  *.*                    LISTEN
tcp4       0      0  192.168.1.2.987        *.*                    LISTEN
tcp4       0      0  127.0.0.1.122          *.*                    LISTEN
`

func TestTCPProbeUsesNetstatForPrivilegedPorts(t *testing.T) {
	t.Parallel()
	tests := []struct {
		target string
		state  State
	}{
		{"tcp://127.0.0.1:911", StateUnavailable}, // only an established connection, no listener
		{"tcp://localhost:981", StateAvailable},
		{"tcp://127.0.0.1:981", StateAvailable},
		{"tcp://[::1]:981", StateAvailable},
		{"tcp://127.0.0.1:983", StateAvailable},
		{"tcp://[::1]:983", StateUnavailable}, // IPv4-only wildcard
		{"tcp://[::1]:985", StateAvailable},
		{"tcp://127.0.0.1:987", StateUnavailable}, // LAN-only listener is unreachable via loopback
		{"tcp://127.0.0.1:12", StateUnavailable},  // no listener on 12; 122 must not match
		{"tcp://127.0.0.1:122", StateAvailable},
	}
	for _, test := range tests {
		var calls atomic.Int32
		prober := &Prober{Now: time.Now, Netstat: func(context.Context) ([]byte, error) {
			calls.Add(1)
			return []byte(sampleNetstat), nil
		}}
		result := prober.Probe(context.Background(), Service{ID: "tcp", Protocol: ProtocolTCP, URL: test.target})
		if result.State != test.state || calls.Load() != 1 {
			t.Errorf("%s: result=%#v calls=%d", test.target, result, calls.Load())
		}
	}
	failing := &Prober{Now: time.Now, Netstat: func(context.Context) ([]byte, error) { return nil, errors.New("boom") }}
	if result := failing.Probe(context.Background(), Service{ID: "tcp", Protocol: ProtocolTCP, URL: "tcp://127.0.0.1:911"}); result.State != StateUnavailable || result.Reason != "probe_error" {
		t.Errorf("netstat failure result=%#v", result)
	}
}

func TestTCPProbeIPv6AndPrivilegedParsingOfRealSuffixes(t *testing.T) {
	t.Parallel()
	output := []byte("tcp4 0 0 127.0.0.1.3306 *.* LISTEN\n")
	if netstatListening(output, 306, true, true) {
		t.Fatal("port 306 matched 3306")
	}
	if !netstatListening(output, 3306, true, false) || netstatListening(output, 3306, false, true) {
		t.Fatal("family matching is wrong")
	}
}

// The socket table is read without `-p tcp`: macOS netstat prints nothing for
// that filter when its output is a pipe, which made every privileged service
// (sshd on *.22) look down even though it was listening.
func TestSystemNetstatReadsTheFullTableThroughAPipe(t *testing.T) {
	output, err := systemNetstat(context.Background())
	if err != nil {
		t.Fatalf("netstat failed: %v", err)
	}
	if len(output) == 0 {
		t.Fatal("netstat produced no output through a pipe; a protocol filter flag is suppressing it")
	}
	if !strings.Contains(string(output), "tcp") {
		t.Fatalf("netstat output has no TCP rows:\n%s", output)
	}
}

// A wildcard listener on a privileged port is found by binding the wildcard
// address, which macOS answers with EADDRINUSE before checking privilege. The
// socket table must not be needed, and nothing may connect to the service.
func TestTCPProbeFindsWildcardListenerOnPrivilegedPortWithoutNetstat(t *testing.T) {
	listening, err := listenerState(false, true, 22)
	if err != nil && !errors.Is(err, syscall.EACCES) {
		t.Skipf("cannot evaluate port 22 here: %v", err)
	}
	if !listening {
		t.Skip("no wildcard listener on port 22 on this machine (Remote Login is off)")
	}
	prober := &Prober{Now: time.Now, Netstat: noNetstat}
	result := prober.Probe(context.Background(), Service{ID: "ssh", Protocol: ProtocolTCP, URL: "tcp://127.0.0.1:22"})
	if result.State != StateAvailable || result.Reason != "listening" {
		t.Fatalf("a wildcard sshd must be found by the wildcard bind alone: %#v", result)
	}
}
