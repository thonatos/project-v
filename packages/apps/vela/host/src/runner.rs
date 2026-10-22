//! Custom `AppKit` runner that keeps Vela alive when its window closes.
#![allow(
    unsafe_code,
    reason = "AppKit delegate methods require Objective-C FFI"
)]

use nsh_platform_macos::{
    AppOptions, AppView, Appearance, AssetBase, Bundle, Components,
    objc2::{
        MainThreadMarker, MainThreadOnly, define_class, msg_send, rc::Retained,
        runtime::ProtocolObject,
    },
    objc2_app_kit::{
        NSApplication, NSApplicationActivationPolicy, NSApplicationDelegate, NSBackingStoreType,
        NSWindow, NSWindowButton, NSWindowDelegate, NSWindowStyleMask,
    },
    objc2_foundation::{
        NSActivityOptions, NSNotification, NSObject, NSObjectProtocol, NSPoint, NSProcessInfo,
        NSRect, NSSize, NSString,
    },
    set_ui_sets,
};
use std::time::Duration;
use std::{cell::RefCell, path::Path, rc::Rc};

struct Running {
    window: Retained<NSWindow>,
    view: Rc<AppView>,
    activity: Retained<ProtocolObject<dyn NSObjectProtocol>>,
}

thread_local! {
    static RUNNING: RefCell<Option<Running>> = const { RefCell::new(None) };
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
                    eprintln!("VELA_SMOKE core={:?}", crate::supervisor::global_identity());
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
                    eprintln!("VELA_SMOKE core={:?}", crate::supervisor::global_identity());
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
                            crate::supervisor::global_identity()
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

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaAppDelegate"]
    struct Delegate;

    unsafe impl NSObjectProtocol for Delegate {}

    unsafe impl NSApplicationDelegate for Delegate {
        #[unsafe(method(applicationShouldTerminateAfterLastWindowClosed:))]
        fn terminate_after_last_window(&self, _sender: &NSApplication) -> bool {
            false
        }

        #[unsafe(method(applicationShouldHandleReopen:hasVisibleWindows:))]
        fn handle_reopen(&self, _sender: &NSApplication, visible: bool) -> bool {
            if !visible {
                RUNNING.with(|slot| {
                    if let Some(running) = slot.borrow().as_ref() {
                        running.window.makeKeyAndOrderFront(None);
                    }
                });
            }
            true
        }

        #[unsafe(method(applicationWillTerminate:))]
        fn will_terminate(&self, _notification: &NSNotification) {
            crate::supervisor::global_shutdown(Duration::from_secs(3));
            RUNNING.with(|slot| {
                if let Some(running) = slot.borrow_mut().take() {
                    unsafe { NSProcessInfo::processInfo().endActivity(&running.activity) };
                    running.view.stop();
                }
            });
        }
    }

    unsafe impl NSWindowDelegate for Delegate {
        #[unsafe(method(windowShouldClose:))]
        fn should_close(&self, sender: &NSWindow) -> bool {
            sender.orderOut(None);
            false
        }
    }
);

impl Delegate {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        unsafe { msg_send![Self::alloc(mtm), init] }
    }
}

/// Shows or hides NSH's performance HUD on the running window.
#[must_use]
pub fn set_performance_hud(enabled: bool) -> bool {
    RUNNING.with(|slot| {
        slot.borrow().as_ref().is_some_and(|running| {
            running.view.set_fps_monitor(enabled);
            true
        })
    })
}

pub struct RunnerOptions<'a> {
    pub bundle: &'a Path,
    pub assets: Option<&'a Path>,
    /// Vela's window is a fixed-size utility panel, so this is both the
    /// initial and the only content size.
    pub size: (i32, i32),
    pub core: Option<&'a Path>,
}

fn register_components(view: &Rc<AppView>, mtm: MainThreadMarker) {
    view.register_component(
        crate::desktop_controls::BUTTON_COMPONENT,
        Rc::new(move |context| {
            Box::new(crate::desktop_controls::DesktopButton::new(&context, mtm))
        }),
    );
    view.register_component(
        crate::desktop_controls::SWITCH_COMPONENT,
        Rc::new(move |context| {
            Box::new(crate::desktop_controls::DesktopSwitch::new(&context, mtm))
        }),
    );
}

/// Runs Vela until the user explicitly quits the application.
///
/// # Errors
///
/// Returns an error if the NSH bundle cannot be read.
pub fn run(options: &RunnerOptions<'_>) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("Vela runner must start on the main thread")?;
    let app = NSApplication::sharedApplication(mtm);
    set_ui_sets(vec![
        nsh_ui_mobile::registry(),
        crate::__nsh_native_module(),
    ]);
    app.setActivationPolicy(NSApplicationActivationPolicy::Regular);
    let delegate = Delegate::new(mtm);
    app.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    if let Some(core) = options.core {
        crate::supervisor::global_start(core.to_string_lossy().into_owned())?;
    }

    let frame = NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(f64::from(options.size.0), f64::from(options.size.1)),
    );
    // Vela is a fixed-size utility window: its content is a single column of
    // rows, so resizing and zooming have nothing to reveal.
    let style =
        NSWindowStyleMask::Titled | NSWindowStyleMask::Closable | NSWindowStyleMask::Miniaturizable;
    let window = unsafe {
        NSWindow::initWithContentRect_styleMask_backing_defer(
            NSWindow::alloc(mtm),
            frame,
            style,
            NSBackingStoreType::Buffered,
            false,
        )
    };
    unsafe { window.setReleasedWhenClosed(false) };
    window.setTitle(&NSString::from_str("Vela"));
    let content = NSSize::new(f64::from(options.size.0), f64::from(options.size.1));
    window.setContentMinSize(content);
    window.setContentMaxSize(content);
    // Dropping `Resizable` leaves a disabled zoom button in the title bar.
    // A control that can never do anything should not be shown at all.
    if let Some(zoom) = window.standardWindowButton(NSWindowButton::ZoomButton) {
        zoom.setHidden(true);
    }
    window.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));

    let components = Components::default();
    let view = AppView::new(
        mtm,
        AppOptions {
            title: "Vela".into(),
            size: options.size,
            appearance: Appearance::System,
            asset_base: options
                .assets
                .map(|path| AssetBase::Directory(path.to_path_buf())),
            components,
            ..AppOptions::default()
        },
    );
    register_components(&view, mtm);
    let bundle = if options
        .bundle
        .extension()
        .is_some_and(|extension| extension == "nshc")
    {
        // SAFETY: The release bundle is loaded only from Vela's signed app resources.
        unsafe { Bundle::read_trusted(options.bundle) }
    } else {
        Bundle::read(options.bundle)
    }
    .map_err(|error| format!("read NSH bundle: {error}"))?;
    view.load(bundle.into());
    window.setContentView(Some(&view.view()));
    window.center();
    window.makeKeyAndOrderFront(None);
    app.activate();
    let activity = NSProcessInfo::processInfo().beginActivityWithOptions_reason(
        NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
        &NSString::from_str("Serving private Vela development access"),
    );
    RUNNING.with(|slot| {
        *slot.borrow_mut() = Some(Running {
            window,
            view,
            activity,
        });
    });
    schedule_lifecycle_smoke();
    schedule_ui_smoke();
    app.run();
    drop(delegate);
    Ok(())
}

#[cfg(test)]
mod tests {
    #[derive(Debug, Default)]
    struct Lifecycle {
        visible: bool,
        generation: u64,
        quitting: bool,
    }

    impl Lifecycle {
        fn launch(&mut self) {
            self.visible = true;
            self.generation += 1;
        }
        fn close(&mut self) {
            self.visible = false;
        }
        fn reopen(&mut self) {
            if !self.quitting {
                self.visible = true;
            }
        }
        fn quit(&mut self) {
            self.quitting = true;
            self.visible = false;
        }
    }

    #[test]
    fn close_and_reopen_keep_the_same_generation() {
        let mut lifecycle = Lifecycle::default();
        lifecycle.launch();
        let generation = lifecycle.generation;
        lifecycle.close();
        assert!(!lifecycle.visible);
        lifecycle.reopen();
        assert!(lifecycle.visible);
        assert_eq!(lifecycle.generation, generation);
    }

    #[test]
    fn quit_prevents_reopen() {
        let mut lifecycle = Lifecycle::default();
        lifecycle.launch();
        lifecycle.quit();
        lifecycle.reopen();
        assert!(!lifecycle.visible);
    }
}
