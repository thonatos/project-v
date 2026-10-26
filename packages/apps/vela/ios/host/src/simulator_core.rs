//! Link-only Core ABI for NSH's iOS simulator development host.
//!
//! Product device builds link the Go C archive. UI semantic fixtures do not
//! call Core, but the development host still needs every symbol at link time.

use std::ffi::{CString, c_char};

fn owned(value: &str) -> *mut c_char {
    CString::new(value)
        .expect("static JSON has no NUL")
        .into_raw()
}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_start(_support: *const c_char, _device: *const c_char) -> *mut c_char {
    std::ptr::null_mut()
}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_stop() {}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_request(_kind: *const c_char, _payload: *const c_char) -> *mut c_char {
    owned(
        r#"{"type":"error","payload":{"message":"Core is unavailable in the UI semantics fixture"}}"#,
    )
}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_drain_events() -> *mut c_char {
    owned("[]")
}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_suspend() {}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_resume() -> std::ffi::c_int {
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn vela_core_set_signing_expiry(_value: *const c_char) {}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn vela_core_free(value: *mut c_char) {
    if !value.is_null() {
        // SAFETY: every non-null pointer returned above came from CString::into_raw.
        unsafe { drop(CString::from_raw(value)) };
    }
}
