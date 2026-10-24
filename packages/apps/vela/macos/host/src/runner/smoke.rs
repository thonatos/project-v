//! Development-only smoke sequences for the macOS host.
//!
//! They run only when `VELA_LIFECYCLE_SCRIPT` or `VELA_UI_SMOKE` is set, so a
//! production launch never reaches them. Keeping them here leaves the runner
//! focused on the window and lifecycle.
use nsh_platform_macos::objc2::MainThreadMarker;
use nsh_platform_macos::objc2_app_kit::{NSApplication, NSWindow};
use nsh_platform_macos::objc2_foundation::{NSPoint, NSString};
use std::rc::Rc;
use std::time::Duration;

use super::RUNNING;

/// Starts whichever script the environment asked for. Called once by the
/// runner after the window is visible.
pub(super) fn schedule_if_requested() {
    schedule_lifecycle_smoke();
    schedule_ui_smoke();
}

/// Executes a deterministic close/reopen/quit smoke sequence when requested by
/// the test harness. Production launches do not set this environment variable.
fn schedule_lifecycle_smoke() {
    if std::env::var("VELA_LIFECYCLE_SCRIPT").as_deref() != Ok("close,reopen,quit") {
        return;
    }
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(250));
        dispatch2::DispatchQueue::main().exec_async(|| {
            RUNNING.with(|slot| {
                if let Some(running) = slot.borrow().as_ref() {
                    eprintln!(
                        "VELA_SMOKE generation=1 action=close window={:p} view={:p}",
                        &*running.window,
                        Rc::as_ptr(&running.view)
                    );
                    eprintln!(
                        "VELA_SMOKE core={:?}",
                        crate::supervisor::Global::identity()
                    );
                    running.window.performClose(None);
                }
            });
        });
        std::thread::sleep(Duration::from_millis(250));
        dispatch2::DispatchQueue::main().exec_async(|| {
            RUNNING.with(|slot| {
                if let Some(running) = slot.borrow().as_ref() {
                    eprintln!(
                        "VELA_SMOKE generation=1 action=reopen window={:p} view={:p}",
                        &*running.window,
                        Rc::as_ptr(&running.view)
                    );
                    eprintln!(
                        "VELA_SMOKE core={:?}",
                        crate::supervisor::Global::identity()
                    );
                    running.window.makeKeyAndOrderFront(None);
                }
            });
        });
        std::thread::sleep(Duration::from_millis(250));
        dispatch2::DispatchQueue::main().exec_async(|| {
            if let Some(mtm) = MainThreadMarker::new() {
                eprintln!("VELA_SMOKE action=quit");
                NSApplication::sharedApplication(mtm).terminate(None);
            }
        });
    });
}

fn schedule_ui_smoke() {
    let Ok(script) = std::env::var("VELA_UI_SMOKE") else {
        return;
    };
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        let actions: Vec<(u64, &str)> = match script.as_str() {
            "open,back,quit" => vec![(0, "open"), (600, "back"), (250, "verify"), (0, "quit")],
            "menu,quit" => vec![(0, "settings"), (500, "sidebar"), (500, "quit")],
            _ => return,
        };
        for (delay, action) in actions {
            std::thread::sleep(Duration::from_millis(delay));
            dispatch2::DispatchQueue::main().exec_async(move || {
                if action == "quit" {
                    if let Some(mtm) = MainThreadMarker::new() {
                        NSApplication::sharedApplication(mtm).terminate(None);
                    }
                    return;
                }
                RUNNING.with(|slot| {
                    let binding = slot.borrow();
                    let Some(running) = binding.as_ref() else {
                        return;
                    };
                    match action {
                        "open" => post_click(&running.window, 1000.0, 260.0),
                        "back" => post_click(&running.window, 120.0, 26.0),
                        "settings" => post_key(&running.window, ",", 43, true, false),
                        "sidebar" => post_key(&running.window, "S", 1, true, true),
                        "verify" => eprintln!(
                            "VELA_UI_SMOKE returned-to-devices core={:?}",
                            crate::supervisor::Global::identity()
                        ),
                        _ => {}
                    }
                });
            });
        }
    });
}

fn post_key(window: &NSWindow, chars: &str, code: u16, command: bool, shift: bool) {
    use nsh_platform_macos::objc2_app_kit::{NSEvent, NSEventModifierFlags, NSEventType};
    let mut flags = NSEventModifierFlags::empty();
    if command {
        flags |= NSEventModifierFlags::Command;
    }
    if shift {
        flags |= NSEventModifierFlags::Shift;
    }
    for event_type in [NSEventType::KeyDown, NSEventType::KeyUp] {
        if let Some(event) = NSEvent::keyEventWithType_location_modifierFlags_timestamp_windowNumber_context_characters_charactersIgnoringModifiers_isARepeat_keyCode(
            event_type,
            NSPoint::ZERO,
            flags,
            0.0,
            window.windowNumber(),
            None,
            &NSString::from_str(chars),
            &NSString::from_str(chars),
            false,
            code,
        ) {
            NSApplication::sharedApplication(MainThreadMarker::from(window)).sendEvent(&event);
        }
    }
}

fn post_click(window: &NSWindow, x: f64, y: f64) {
    use nsh_platform_macos::objc2_app_kit::{NSEvent, NSEventModifierFlags, NSEventType};
    let location = NSPoint::new(
        x,
        window
            .contentView()
            .map_or(720.0, |view| view.frame().size.height)
            - y,
    );
    for event_type in [NSEventType::LeftMouseDown, NSEventType::LeftMouseUp] {
        if let Some(event) = NSEvent::mouseEventWithType_location_modifierFlags_timestamp_windowNumber_context_eventNumber_clickCount_pressure(
            event_type, location, NSEventModifierFlags::empty(), 0.0, window.windowNumber(), None, 0, 1, 1.0,
        ) {
            NSApplication::sharedApplication(MainThreadMarker::from(window)).sendEvent(&event);
        }
    }
}
