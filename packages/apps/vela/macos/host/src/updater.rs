//! Sparkle is loaded from Vela.app rather than the build machine. The one
//! controller lives on `AppKit`'s main thread and owns all update state/UI.
#![allow(
    unsafe_code,
    reason = "Sparkle is an Objective-C framework loaded at runtime"
)]

use nsh_platform_macos::objc2::{
    MainThreadMarker, MainThreadOnly, define_class, msg_send,
    rc::{Allocated, Retained},
    runtime::{AnyClass, AnyObject},
};
use nsh_platform_macos::objc2_foundation::{
    NSBundle, NSError, NSObject, NSObjectProtocol, NSString,
};
use std::cell::RefCell;

thread_local! {
    static OWNER: RefCell<Option<Owner>> = const { RefCell::new(None) };
}

struct Owner {
    controller: Retained<NSObject>,
    _delegate: Retained<UpdaterDelegate>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaUpdaterDelegate"]
    struct UpdaterDelegate;

    unsafe impl NSObjectProtocol for UpdaterDelegate {}

    impl UpdaterDelegate {
        #[unsafe(method(updater:willInstallUpdate:))]
        fn will_install(&self, _updater: &AnyObject, _item: &AnyObject) {
            eprintln!("VELA_UPDATE will-install");
        }

        #[unsafe(method(updaterShouldRelaunchApplication:))]
        fn should_relaunch(&self, _updater: &AnyObject) -> bool {
            eprintln!("VELA_UPDATE should-relaunch=true");
            true
        }

        #[unsafe(method(updaterWillRelaunchApplication:))]
        fn will_relaunch(&self, _updater: &AnyObject) {
            eprintln!("VELA_UPDATE will-relaunch");
        }

        #[unsafe(method(updater:didAbortWithError:))]
        fn did_abort(&self, _updater: &AnyObject, error: &NSError) {
            eprintln!("VELA_UPDATE aborted code={}", error.code());
        }
    }
);

impl UpdaterDelegate {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        unsafe { msg_send![Self::alloc(mtm), init] }
    }
}

const MANUAL_RELEASE_URL: &str = "https://github.com/thonatos/project-v/releases";

/// Starts the one Sparkle controller. Calling it again is harmless.
///
/// # Errors
///
/// Returns a user-safe recovery message when the embedded framework is absent,
/// cannot load, or does not export the expected controller class.
pub fn start(mtm: MainThreadMarker) -> Result<(), String> {
    OWNER.with(|slot| {
        if slot.borrow().is_some() {
            return Ok(());
        }
        let frameworks = NSBundle::mainBundle()
            .privateFrameworksPath()
            .ok_or_else(|| format!("自动更新不可用；请从 {MANUAL_RELEASE_URL} 手动下载"))?;
        let path = format!("{frameworks}/Sparkle.framework");
        let bundle = NSBundle::bundleWithPath(&NSString::from_str(&path))
            .ok_or_else(|| format!("自动更新组件缺失；请从 {MANUAL_RELEASE_URL} 手动下载"))?;
        unsafe { bundle.loadAndReturnError() }.map_err(|error| {
            eprintln!("VELA_UPDATE framework-load-failed");
            format!(
                "自动更新组件无法加载：{}；请从 {MANUAL_RELEASE_URL} 手动下载",
                error.localizedDescription()
            )
        })?;
        let class = AnyClass::get(c"SPUStandardUpdaterController")
            .ok_or_else(|| format!("自动更新组件不兼容；请从 {MANUAL_RELEASE_URL} 手动下载"))?;
        let delegate = UpdaterDelegate::new(mtm);
        let allocated: Allocated<NSObject> = unsafe { msg_send![class, alloc] };
        let controller: Retained<NSObject> = unsafe {
            msg_send![
                allocated,
                initWithStartingUpdater: true,
                updaterDelegate: &*delegate,
                userDriverDelegate: Option::<&AnyObject>::None
            ]
        };
        *slot.borrow_mut() = Some(Owner {
            controller,
            _delegate: delegate,
        });
        Ok(())
    })
}

/// Opens Sparkle's verbose manual update check on the main thread.
#[must_use]
pub fn check_for_updates() -> bool {
    dispatch2::DispatchQueue::main().exec_async(|| {
        if std::env::var_os("VELA_UPDATE_SMOKE").is_some() {
            eprintln!("VELA_UPDATE_SMOKE check=1");
            return;
        }
        if let Some(mtm) = MainThreadMarker::new()
            && OWNER.with(|slot| slot.borrow().is_none())
            && let Err(error) = start(mtm)
        {
            eprintln!("VELA_UPDATE unavailable: {error}");
        }
        OWNER.with(|slot| {
            if let Some(owner) = slot.borrow().as_ref() {
                #[allow(
                    clippy::semicolon_if_nothing_returned,
                    reason = "objc2 needs the void return type inferred from this expression"
                )]
                let _: () = unsafe {
                    msg_send![&owner.controller, checkForUpdates: Option::<&AnyObject>::None]
                };
            } else {
                eprintln!("VELA_UPDATE unavailable; manual-download={MANUAL_RELEASE_URL}");
                let _ = crate::CoreBridge::open_external(MANUAL_RELEASE_URL.to_owned());
            }
        });
    });
    true
}

#[cfg(test)]
mod tests {
    use super::MANUAL_RELEASE_URL;
    #[derive(Default)]
    struct Owner {
        starts: usize,
        checks: usize,
        running: bool,
    }

    impl Owner {
        fn start(&mut self) {
            if !self.running {
                self.running = true;
                self.starts += 1;
            }
        }
        fn check(&mut self) -> bool {
            if !self.running {
                return false;
            }
            self.checks += 1;
            true
        }
    }

    #[test]
    fn updater_has_one_owner_and_each_command_checks_once() {
        let mut owner = Owner::default();
        owner.start();
        owner.start();
        assert!(owner.check());
        assert_eq!(owner.starts, 1);
        assert_eq!(owner.checks, 1);
    }

    #[test]
    fn missing_updater_keeps_the_running_app() {
        let mut owner = Owner::default();
        assert!(!owner.check());
        assert_eq!(owner.checks, 0);
        assert!(MANUAL_RELEASE_URL.starts_with("https://github.com/thonatos/project-v/releases"));
    }
}
