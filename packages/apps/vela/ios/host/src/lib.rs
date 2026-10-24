//! Vela's iOS host crate.
//!
//! On iOS this is the Rust staticlib behind `main.swift`: window, scene
//! lifecycle, the `vela/webview` component and the Core C ABI bridge. On the
//! build host it only declares the same `vela/native` module so `nsh build`
//! can describe the TSX surface; nothing else is compiled there.

#![allow(
    unsafe_code,
    reason = "UIKit and WebKit are Objective-C APIs; scene and navigation delegates require FFI"
)]

#[cfg(target_os = "ios")]
mod controls;
#[cfg(target_os = "ios")]
mod ios;
#[cfg(target_os = "ios")]
mod webview;
#[cfg(target_os = "ios")]
pub use ios::*;

#[cfg(not(target_os = "ios"))]
mod stub;
#[cfg(not(target_os = "ios"))]
pub use stub::*;
