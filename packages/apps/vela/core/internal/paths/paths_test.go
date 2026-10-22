package paths

import (
	"path/filepath"
	"testing"
)

func TestWritablePathsStayOutsideBundle(t *testing.T) {
	t.Parallel()
	paths := FromHome("/Users/tester")
	if !paths.OutsideBundle("/Applications/Vela.app") {
		t.Fatal("writable path escaped into Vela.app")
	}
	want := filepath.Join("/Users/tester", "Library", "Application Support", "Vela", "network")
	if paths.NetworkState != want {
		t.Fatalf("NetworkState = %q, want %q", paths.NetworkState, want)
	}
}

func TestBundleIdentifier(t *testing.T) {
	t.Parallel()
	if BundleID != "io.implements.vela.macos" {
		t.Fatalf("BundleID = %q", BundleID)
	}
}

func TestRejectsWritablePathInsideBundle(t *testing.T) {
	t.Parallel()
	paths := FromHome("/Applications/Vela.app/Contents")
	if paths.OutsideBundle("/Applications/Vela.app") {
		t.Fatal("expected writable paths inside Vela.app to be rejected")
	}
}
