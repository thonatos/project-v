package remotes

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	velaconfig "github.com/thonatos/vela/core/internal/config"
)

type fakeChecker struct {
	result CheckResult
	err    error
}

func (checker fakeChecker) Check(context.Context, string) (CheckResult, error) {
	return checker.result, checker.err
}

func newRegistry(t *testing.T, checker Checker) Registry {
	t.Helper()
	store, err := velaconfig.Open(filepath.Join(t.TempDir(), "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	return Registry{Store: store, Checker: checker, Now: func() time.Time { return time.Unix(100, 0) }}
}

func TestAddOnlineCompatibleRemote(t *testing.T) {
	t.Parallel()
	registry := newRegistry(t, fakeChecker{result: CheckResult{DeviceName: "Home Mac", ProtocolVersion: 2}})
	remote, err := registry.Add(context.Background(), "HOME-MAC.EXAMPLE.TS.NET")
	if err != nil {
		t.Fatal(err)
	}
	if remote.PrivateName != "home-mac.example.ts.net" || len(registry.Store.Snapshot().Remotes) != 1 {
		t.Fatalf("remote=%#v config=%#v", remote, registry.Store.Snapshot())
	}
	if err := registry.Remove(remote.PrivateName); err != nil || len(registry.Store.Snapshot().Remotes) != 0 {
		t.Fatalf("remove err=%v config=%#v", err, registry.Store.Snapshot())
	}
}

func TestInvalidOfflineUnauthorizedAndIncompatibleAreNotSaved(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		private string
		checker Checker
		want    error
	}{
		{name: "invalid", private: "127.0.0.1", checker: fakeChecker{}, want: ErrInvalidName},
		{name: "offline", private: "home.example.ts.net", checker: fakeChecker{err: ErrOffline}, want: ErrOffline},
		{name: "unauthorized", private: "home.example.ts.net", checker: fakeChecker{err: ErrUnauthorized}, want: ErrUnauthorized},
		{name: "incompatible", private: "home.example.ts.net", checker: fakeChecker{result: CheckResult{DeviceName: "Home", ProtocolVersion: 1}}, want: ErrIncompatibleProtocol},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			registry := newRegistry(t, test.checker)
			_, err := registry.Add(context.Background(), test.private)
			if !errors.Is(err, test.want) {
				t.Fatalf("error=%v want=%v", err, test.want)
			}
			if len(registry.Store.Snapshot().Remotes) != 0 {
				t.Fatal("failed remote was persisted")
			}
		})
	}
}
