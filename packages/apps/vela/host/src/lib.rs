//! macOS application host for Vela.
//!
//! The host owns the application lifecycle and will embed the NSH surface.

#[cfg(target_os = "macos")]
pub mod desktop_controls;
pub mod paths;
pub mod protocol;
#[cfg(target_os = "macos")]
pub mod runner;
pub mod supervisor;

use nsh_core::ui::prelude::*;

/// Typed functions exposed to the NSH TSX surface.
pub struct CoreBridge;

#[module]
impl CoreBridge {
    /// Current Rust/Go control protocol version.
    #[must_use]
    pub fn protocol_version() -> u32 {
        u32::from(protocol::VERSION)
    }

    /// Starts the bundled Core helper at `path`.
    ///
    /// # Errors
    ///
    /// Returns a message when the helper cannot be started.
    pub fn start(path: String) -> Result<String, String> {
        supervisor::global_start(path).map(|()| "started".to_owned())
    }

    /// Sends a request whose payload is a JSON object encoded as text.
    ///
    /// # Errors
    ///
    /// Returns a message when the payload or Core request fails.
    #[allow(
        clippy::unused_async,
        clippy::unused_async_trait_impl,
        reason = "NSH maps async module functions to Promise-returning TS APIs"
    )]
    pub async fn request(kind: String, payload: String) -> Result<String, String> {
        supervisor::global_request(&kind, &payload)
    }

    /// Opens a Tailscale authentication URL in the user's default browser.
    ///
    /// # Errors
    ///
    /// Rejects non-HTTP schemes and malformed URLs.
    #[cfg(target_os = "macos")]
    #[allow(
        clippy::needless_pass_by_value,
        reason = "NSH module arguments cross the JS bridge as owned values"
    )]
    pub fn open_external(url: String) -> Result<bool, String> {
        use nsh_platform_macos::objc2_app_kit::NSWorkspace;
        use nsh_platform_macos::objc2_foundation::{NSString, NSURL};

        if !(url.starts_with("https://") || url.starts_with("http://")) {
            return Err("external URL must use http or https".into());
        }
        let value = NSString::from_str(&url);
        let parsed = NSURL::URLWithString(&value).ok_or("invalid external URL")?;
        if NSWorkspace::sharedWorkspace().openURL(&parsed) {
            Ok(true)
        } else {
            Err("macOS could not open the external URL".into())
        }
    }

    /// Returns queued asynchronous Core events as a JSON array.
    #[must_use]
    pub fn drain_events() -> String {
        supervisor::global_drain_events()
    }

    /// Shows or hides NSH's performance HUD for debugging.
    #[cfg(target_os = "macos")]
    #[must_use]
    pub fn set_performance_hud(enabled: bool) -> bool {
        runner::set_performance_hud(enabled)
    }
}

/// Native functions available to the TSX entry.
#[native_module("vela/native")]
fn native(registry: &mut Registry) {
    registry.module::<CoreBridge>();
}

/// Stable product name shared by the runner and its bundle metadata.
pub const PRODUCT_NAME: &str = "Vela";

#[cfg(test)]
mod tests {
    use super::PRODUCT_NAME;

    #[test]
    fn product_name_is_stable() {
        assert_eq!(PRODUCT_NAME, "Vela");
    }
}
