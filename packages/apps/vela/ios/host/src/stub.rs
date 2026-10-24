//! Host-side declaration of `vela/native`, used only to build the TSX bundle.

use nsh_core::ui::prelude::*;

#[module]
/// Typed functions exposed to the TSX surface as `vela/native`.
pub struct CoreBridge;

#[module]
impl CoreBridge {
    /// Current Rust/Go control protocol version.
    #[must_use]
    pub fn protocol_version() -> u32 {
        1
    }

    /// Starts the embedded Go Core (iOS only).
    ///
    /// # Errors
    ///
    /// Always fails on the build host.
    pub fn start(_path: String) -> Result<String, String> {
        Err("the iOS Core is only available in the iOS app".to_owned())
    }

    /// Sends a Core request (iOS only).
    ///
    /// # Errors
    ///
    /// Always fails on the build host.
    #[allow(
        clippy::unused_async,
        clippy::unused_async_trait_impl,
        reason = "the iOS build keeps this async for the TSX surface"
    )]
    pub async fn request(_kind: String, _payload: String) -> Result<String, String> {
        Err("the iOS Core is only available in the iOS app".to_owned())
    }

    /// Opens an external URL (iOS only).
    ///
    /// # Errors
    ///
    /// Always fails on the build host.
    pub fn open_external(_url: String) -> Result<bool, String> {
        Err("the iOS host is only available in the iOS app".to_owned())
    }

    /// Returns queued Core events (iOS only).
    #[must_use]
    pub fn drain_events() -> String {
        "[]".to_owned()
    }

    /// iOS builds do not render NSH's performance HUD.
    #[must_use]
    pub fn set_performance_hud(_enabled: bool) -> bool {
        false
    }

    /// The open page's status bar (iOS only).
    #[must_use]
    pub fn set_page_status_bar(_style: String) -> bool {
        false
    }
}

#[native_module("vela/native")]
fn native(registry: &mut Registry) {
    registry.module::<CoreBridge>();
}
