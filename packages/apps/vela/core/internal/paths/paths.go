// Package paths defines Vela's user-writable filesystem boundary.
package paths

import (
	"path/filepath"
	"strings"
)

// BundleIDs are shared with the hosts and NSH metadata. The macOS app and the
// iOS app are separate bundles so a development-signed iOS build cannot
// replace the desktop app; both keep their data in the same `vela` directory
// under their own container.
const (
	BundleID    = "io.implements.vela.macos"
	IOSBundleID = "io.implements.vela.ios"
)

// Writable contains every location the Core may mutate.
type Writable struct {
	ApplicationSupport string
	Config             string
	NetworkState       string
	WebData            string
	Logs               string
}

// FromHome resolves paths without consulting process-global environment.
func FromHome(home string) Writable {
	support := filepath.Join(home, "Library", "Application Support", "Vela")
	return Writable{
		ApplicationSupport: support,
		Config:             filepath.Join(support, "config.json"),
		NetworkState:       filepath.Join(support, "network"),
		WebData:            filepath.Join(support, "web-data"),
		Logs:               filepath.Join(home, "Library", "Logs", "Vela"),
	}
}

// FromApplicationSupport is the iOS entry point: the host resolves
// NSApplicationSupportDirectory and the Core keeps everything below `vela`.
func FromApplicationSupport(applicationSupport string) Writable {
	support := filepath.Join(applicationSupport, "vela")
	return Writable{
		ApplicationSupport: support,
		Config:             filepath.Join(support, "config.json"),
		NetworkState:       filepath.Join(support, "network"),
		WebData:            filepath.Join(support, "web-data"),
		Logs:               support,
	}
}

// OutsideBundle reports whether all mutable paths avoid the signed app bundle.
func (paths Writable) OutsideBundle(bundle string) bool {
	for _, path := range []string{paths.ApplicationSupport, paths.Config, paths.NetworkState, paths.WebData, paths.Logs} {
		relative, err := filepath.Rel(bundle, path)
		if err == nil && relative != ".." && relative != "." && !filepath.IsAbs(relative) && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return false
		}
	}
	return true
}
