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
	if IOSBundleID != "io.implements.vela.ios" {
		t.Fatalf("IOSBundleID = %q", IOSBundleID)
	}
}

func TestIOSLayoutUsesApplicationSupportVela(t *testing.T) {
	t.Parallel()
	container := "/var/mobile/Containers/Data/Application/ABCDEF/Library/Application Support"
	paths := FromApplicationSupport(container)
	want := filepath.Join(container, "vela")
	if paths.ApplicationSupport != want {
		t.Fatalf("ApplicationSupport = %q, want %q", paths.ApplicationSupport, want)
	}
	if paths.Config != filepath.Join(want, "config.json") {
		t.Fatalf("Config = %q", paths.Config)
	}
	if paths.NetworkState != filepath.Join(want, "network") {
		t.Fatalf("NetworkState = %q", paths.NetworkState)
	}
	if !paths.OutsideBundle("/private/var/containers/Bundle/Application/ABCDEF/Vela.app") {
		t.Fatal("iOS writable path escaped into the signed bundle")
	}
}

func TestRejectsWritablePathInsideBundle(t *testing.T) {
	t.Parallel()
	paths := FromHome("/Applications/Vela.app/Contents")
	if paths.OutsideBundle("/Applications/Vela.app") {
		t.Fatal("expected writable paths inside Vela.app to be rejected")
	}
}
