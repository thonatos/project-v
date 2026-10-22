// Package paths defines Vela's user-writable filesystem boundary.
package paths

import (
	"path/filepath"
	"strings"
)

// BundleID is shared with the macOS host and NSH metadata.
const BundleID = "io.implements.vela.macos"

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
