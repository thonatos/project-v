//go:build tools

// Package dependencies pins build-time dependencies before their runtime
// integration lands in later tasks.
package dependencies

import _ "tailscale.com/tsnet"
