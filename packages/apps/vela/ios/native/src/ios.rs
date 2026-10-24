//! Vela's iOS host: a thin Rust `staticlib` over NSH's `UIKit` embedding API.
//!
//! `main.swift` calls [`vela_ios_main`]; everything else (window, scene
//! lifecycle, the `vela/webview` component and the Core bridge) lives here.
//!
//! The bootstrap follows `nsh-platform-ios`'s `app.rs` (Apache-2.0, NSH
//! 0.2.0), reduced to what Vela needs and extended with native components and
//! Core lifecycle calls.

#![allow(
    unsafe_code,
    reason = "UIKit and WebKit are Objective-C APIs; scene and navigation delegates require FFI"
)]

use crate::webview;

use std::cell::RefCell;
use std::ffi::{CStr, CString, c_char};
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::OnceLock;

use block2::RcBlock;
use nsh_core::ui::prelude::*;
use nsh_platform_ios::{AppView, AssetBase, Bundle, Components, SurfaceOptions, set_ui_sets};
use objc2::rc::Allocated;
use objc2::rc::Retained;
use objc2::runtime::AnyClass;
use objc2::runtime::ProtocolObject;
use objc2::{ClassType, MainThreadMarker, MainThreadOnly, define_class, extern_protocol, msg_send};
use objc2_foundation::{
    NSBundle, NSNotification, NSNotificationCenter, NSObject, NSObjectProtocol, NSOperationQueue,
    NSString, NSURL,
};
use objc2_ui_kit::{
    UIApplication, UIApplicationDelegate, UIApplicationDidBecomeActiveNotification,
    UIApplicationDidEnterBackgroundNotification, UIApplicationWillEnterForegroundNotification,
    UIApplicationWillTerminateNotification, UIColor, UIDevice, UIResponder, UIScene,
    UISceneConfiguration, UISceneConnectionOptions, UISceneDelegate, UISceneSession,
    UIStatusBarAnimation, UIStatusBarStyle, UIViewController, UIWindow, UIWindowScene,
    UIWindowSceneDelegate, UIWindowSceneSessionRoleApplication,
};

unsafe extern "C" {
    fn vela_core_start(
        application_support: *const c_char,
        device_name: *const c_char,
    ) -> *mut c_char;
    fn vela_core_stop();
    fn vela_core_request(kind: *const c_char, payload: *const c_char) -> *mut c_char;
    fn vela_core_drain_events() -> *mut c_char;
    fn vela_core_suspend();
    fn vela_core_resume() -> std::ffi::c_int;
    fn vela_core_set_signing_expiry(value: *const c_char);
    fn vela_core_free(value: *mut c_char);
}

/// Typed functions exposed to the TSX surface; mirrors
/// `ui/.nsh/types/vela/native.d.ts`.
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

    /// Starts the embedded Go Core. `path` is accepted for parity with the
    /// macOS host; iOS always uses the app container.
    ///
    /// # Errors
    ///
    /// Returns a message when the Core cannot start.
    pub fn start(_path: String) -> Result<String, String> {
        start_core()?;
        Ok("started".to_owned())
    }

    /// Sends a request whose payload is a JSON object encoded as text.
    ///
    /// # Errors
    ///
    /// Returns the Core error message for failed requests.
    #[allow(
        clippy::unused_async,
        clippy::unused_async_trait_impl,
        reason = "NSH maps async module functions to Promise-returning TS APIs"
    )]
    pub async fn request(kind: String, payload: String) -> Result<String, String> {
        let kind = CString::new(kind).map_err(|_| "request kind contains a NUL byte")?;
        let payload = CString::new(payload).map_err(|_| "request payload contains a NUL byte")?;
        let response = unsafe { vela_core_request(kind.as_ptr(), payload.as_ptr()) };
        if response.is_null() {
            return Err("Vela Core did not answer".to_owned());
        }
        let text = unsafe { CStr::from_ptr(response) }
            .to_string_lossy()
            .into_owned();
        unsafe { vela_core_free(response) };
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text)
            && value.get("type").and_then(serde_json::Value::as_str) == Some("error")
        {
            let message = value
                .pointer("/payload/message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("Vela Core 请求失败");
            return Err(message.to_owned());
        }
        Ok(text)
    }

    /// Opens an authentication URL in the system browser. Only http(s) is
    /// accepted; the Tailscale login page is the only expected target.
    ///
    /// # Errors
    ///
    /// Rejects other schemes.
    #[allow(
        clippy::needless_pass_by_value,
        reason = "NSH module arguments cross the JS bridge as owned values"
    )]
    pub fn open_external(url: String) -> Result<bool, String> {
        if !(url.starts_with("https://") || url.starts_with("http://")) {
            return Err("external URL must use http or https".to_owned());
        }
        open_url(&url);
        Ok(true)
    }

    /// Returns queued asynchronous Core events as a JSON array.
    #[must_use]
    pub fn drain_events() -> String {
        let events = unsafe { vela_core_drain_events() };
        if events.is_null() {
            return "[]".to_owned();
        }
        let text = unsafe { CStr::from_ptr(events) }
            .to_string_lossy()
            .into_owned();
        unsafe { vela_core_free(events) };
        if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&text) {
            for entry in entries {
                if entry.get("type").and_then(serde_json::Value::as_str) == Some("open_external")
                    && let Some(url) = entry
                        .pointer("/payload/url")
                        .and_then(serde_json::Value::as_str)
                {
                    open_url(url);
                }
            }
        }
        text
    }

    /// iOS builds do not render NSH's performance HUD.
    #[must_use]
    pub fn set_performance_hud(_enabled: bool) -> bool {
        false
    }

    /// The open page's status bar: `"dark"` (light content over a dark page),
    /// `"light"`, or `"app"` to follow the app's appearance again.
    #[allow(
        clippy::needless_pass_by_value,
        reason = "NSH module arguments cross the JS bridge as owned values"
    )]
    #[must_use]
    pub fn set_page_status_bar(style: String) -> bool {
        set_page_status_bar(match style.as_str() {
            "dark" => Some(true),
            "light" => Some(false),
            _ => None,
        });
        true
    }
}

#[native_module("vela/native")]
fn native(registry: &mut Registry) {
    registry.module::<CoreBridge>();
}

struct Running {
    window: Retained<UIWindow>,
    _view: AppView,
    _observers: Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>>,
}

/// Filled on the main thread at scene connection, read by the Core start.
static DEVICE_NAME: OnceLock<String> = OnceLock::new();
/// The single Core start, shared by the scene and the TSX `start()` call.
static CORE: OnceLock<Result<(), String>> = OnceLock::new();

thread_local! {
    static RUNNING: RefCell<Option<Running>> = const { RefCell::new(None) };
    /// Set after Core restores mappings; consumed when UIKit declares the app
    /// active and WebKit is visible again.
    static RELOAD_ON_ACTIVE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    /// The in-app authentication session and its anchor provider, kept alive
    /// until it completes or the user cancels it.
    static AUTH: RefCell<Option<(Retained<NSObject>, Retained<AuthPresenter>)>> = const { RefCell::new(None) };
}

extern_protocol!(
    /// The subset of `ASWebAuthenticationPresentationContextProviding` Vela
    /// implements: the window the system presents the login sheet over.
    ///
    #[allow(clippy::missing_safety_doc)]
    #[name = "VelaPresentationContextProvider"]
    unsafe trait VelaPresentationContextProvider: NSObjectProtocol + MainThreadOnly {
        #[unsafe(method(presentationAnchorForWebAuthenticationSession:))]
        #[unsafe(method_family = none)]
        fn presentation_anchor(&self, session: &NSObject) -> Option<&'static UIWindow>;
    }
);

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaAuthPresenter"]
    struct AuthPresenter;

    unsafe impl NSObjectProtocol for AuthPresenter {}

    unsafe impl VelaPresentationContextProvider for AuthPresenter {
        #[unsafe(method(presentationAnchorForWebAuthenticationSession:))]
        fn presentation_anchor(&self, _session: &NSObject) -> Option<&'static UIWindow> {
            RUNNING.with(|slot| {
                slot.borrow().as_ref().map(|running| {
                    let window: &UIWindow = &running.window;
                    // SAFETY: the window lives in RUNNING for the lifetime of
                    // the app, and this delegate is only called on the main
                    // thread while it does.
                    unsafe { std::mem::transmute::<&UIWindow, &'static UIWindow>(window) }
                })
            })
        }
    }
);

define_class!(
    #[unsafe(super(UIResponder, NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaAppDelegate"]
    struct AppDelegate;

    unsafe impl NSObjectProtocol for AppDelegate {}

    unsafe impl UIApplicationDelegate for AppDelegate {
        #[unsafe(method_id(application:configurationForConnectingSceneSession:options:))]
        fn configuration_for_scene(
            &self,
            _application: &UIApplication,
            session: &UISceneSession,
            _options: &UISceneConnectionOptions,
        ) -> Retained<UISceneConfiguration> {
            let config = UISceneConfiguration::initWithName_sessionRole(
                UISceneConfiguration::alloc(self.mtm()),
                None,
                &session.role(),
            );
            // SAFETY: `SceneDelegate` implements `UIWindowSceneDelegate`.
            unsafe { config.setDelegateClass(Some(SceneDelegate::class())) };
            config
        }
    }
);

define_class!(
    #[unsafe(super(UIResponder, NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaSceneDelegate"]
    struct SceneDelegate;

    unsafe impl NSObjectProtocol for SceneDelegate {}

    unsafe impl UISceneDelegate for SceneDelegate {
        #[unsafe(method(scene:willConnectToSession:options:))]
        fn will_connect(
            &self,
            scene: &UIScene,
            session: &UISceneSession,
            _options: &UISceneConnectionOptions,
        ) {
            // SAFETY: reading an immutable UIKit constant.
            if *session.role() != *unsafe { UIWindowSceneSessionRoleApplication } {
                return;
            }
            let Some(scene) = scene.downcast_ref::<UIWindowScene>() else {
                return;
            };
            connect(self.mtm(), scene);
        }
    }

    unsafe impl UIWindowSceneDelegate for SceneDelegate {}
);

/// The status bar style the open page asked for; `None` follows the app.
static PAGE_STATUS_BAR: std::sync::Mutex<Option<bool>> = std::sync::Mutex::new(None);

define_class!(
    /// The window's root controller. While a service page is open its status
    /// bar follows the page's top color (light content over a dark page);
    /// otherwise it follows NSH's (the app's appearance).
    #[unsafe(super(UIViewController, UIResponder, NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaRootController"]
    struct RootController;

    impl RootController {
        #[unsafe(method(preferredStatusBarStyle))]
        fn preferred_status_bar_style(&self) -> UIStatusBarStyle {
            match *PAGE_STATUS_BAR.lock().unwrap_or_else(std::sync::PoisonError::into_inner) {
                Some(true) => UIStatusBarStyle::LightContent,
                Some(false) => UIStatusBarStyle::DarkContent,
                None => nsh_platform_ios::preferred_status_bar_style(),
            }
        }

        #[unsafe(method(prefersStatusBarHidden))]
        fn prefers_status_bar_hidden(&self) -> bool {
            nsh_platform_ios::prefers_status_bar_hidden()
        }

        #[unsafe(method(preferredStatusBarUpdateAnimation))]
        fn preferred_status_bar_update_animation(&self) -> UIStatusBarAnimation {
            UIStatusBarAnimation::Fade
        }
    }
);

/// Sets the page's status bar (`Some(true)`: light content) and asks `UIKit`
/// to re-read it on the main thread.
fn set_page_status_bar(dark: Option<bool>) {
    *PAGE_STATUS_BAR
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = dark;
    dispatch2::DispatchQueue::main().exec_async(|| {
        RUNNING.with(|slot| {
            if let Some(running) = slot.borrow().as_ref()
                && let Some(controller) = running.window.rootViewController()
            {
                controller.setNeedsStatusBarAppearanceUpdate();
            }
        });
    });
}

fn connect(mtm: MainThreadMarker, scene: &UIWindowScene) {
    let window = UIWindow::initWithWindowScene(UIWindow::alloc(mtm), scene);
    let controller: Retained<UIViewController> =
        unsafe { Retained::cast_unchecked(msg_send![RootController::alloc(mtm), init]) };
    let root = controller.view().expect("view controller has a view");
    root.setBackgroundColor(Some(&UIColor::whiteColor()));
    window.setRootViewController(Some(&controller));
    window.makeKeyAndVisible();

    // Read the hardware name here, on the main thread, so the Core can be
    // (re)started later from the JS engine thread without touching UIKit.
    let _ = DEVICE_NAME.set(UIDevice::currentDevice(mtm).name().to_string());

    let components = Components::default();
    components.register(webview::COMPONENT, webview::factory(mtm));
    crate::controls::register(&components, mtm);

    let resources = NSBundle::mainBundle().bundlePath().to_string();
    let assets = PathBuf::from(resources).join("nsh/assets");
    let view = AppView::new(
        mtm,
        root.bounds(),
        SurfaceOptions {
            components,
            asset_base: assets.exists().then_some(AssetBase::Directory(assets)),
            ..SurfaceOptions::default()
        },
    );
    view.set_error_handler(|error| eprintln!("VELA_IOS bundle error: {error}"));
    root.addSubview(view.view());

    if let Err(error) = start_core() {
        eprintln!("VELA_IOS core start failed: {error}");
    }
    load_bundle(&view);
    let observers = register_lifecycle();
    RUNNING.with(|slot| {
        *slot.borrow_mut() = Some(Running {
            window,
            _view: view,
            _observers: observers,
        });
    });
}

fn load_bundle(view: &AppView) {
    let bundle_path = bundle_path();
    match read_bundle(&bundle_path) {
        Ok(bundle) => view.load(bundle),
        Err(error) => eprintln!("VELA_IOS cannot read {}: {error}", bundle_path.display()),
    }
}

fn read_bundle(path: &Path) -> Result<Bundle, String> {
    if !path.exists() {
        return Err("bundle.nshc is missing from the app resources".to_owned());
    }
    let result = if path
        .extension()
        .is_some_and(|extension| extension == "nshc")
    {
        // SAFETY: the bundle is a read-only resource of Vela's signed app.
        unsafe { Bundle::read_trusted(path) }
    } else {
        Bundle::read(path)
    };
    result.map_err(|error| error.to_string())
}

fn bundle_path() -> PathBuf {
    let resources = NSBundle::mainBundle().bundlePath().to_string();
    PathBuf::from(resources).join("nsh/bundle.nshc")
}

fn register_lifecycle() -> Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>> {
    let center = NSNotificationCenter::defaultCenter();
    let queue = NSOperationQueue::mainQueue();
    let background = RcBlock::new(|_: NonNull<NSNotification>| {
        eprintln!("VELA_IOS lifecycle=background");
        unsafe { vela_core_suspend() };
    });
    let foreground = RcBlock::new(|_: NonNull<NSNotification>| {
        eprintln!("VELA_IOS lifecycle=foreground");
        if unsafe { vela_core_resume() } != 0 {
            RELOAD_ON_ACTIVE.with(|pending| pending.set(true));
        } else {
            eprintln!("VELA_IOS lifecycle=resume-failed");
        }
    });
    let active = RcBlock::new(|_: NonNull<NSNotification>| {
        if RELOAD_ON_ACTIVE.with(std::cell::Cell::take) {
            let reloaded = webview::reload_active();
            eprintln!("VELA_IOS lifecycle=active reload={reloaded}");
        }
    });
    let terminate = RcBlock::new(|_: NonNull<NSNotification>| {
        eprintln!("VELA_IOS lifecycle=stop");
        unsafe { vela_core_stop() };
    });
    // SAFETY: documented UIKit notification names; each block only calls the
    // C ABI and is delivered on the main queue.
    unsafe {
        vec![
            center.addObserverForName_object_queue_usingBlock(
                Some(UIApplicationDidEnterBackgroundNotification),
                None,
                Some(&queue),
                &background,
            ),
            center.addObserverForName_object_queue_usingBlock(
                Some(UIApplicationWillEnterForegroundNotification),
                None,
                Some(&queue),
                &foreground,
            ),
            center.addObserverForName_object_queue_usingBlock(
                Some(UIApplicationDidBecomeActiveNotification),
                None,
                Some(&queue),
                &active,
            ),
            center.addObserverForName_object_queue_usingBlock(
                Some(UIApplicationWillTerminateNotification),
                None,
                Some(&queue),
                &terminate,
            ),
        ]
    }
}

fn start_core() -> Result<(), String> {
    // The scene and the TSX entry may both ask to start; the C ABI is not
    // reentrant and the first start owns the Core.
    CORE.get_or_init(start_core_inner).clone()
}

fn start_core_inner() -> Result<(), String> {
    let support = application_support_dir()?;
    let support = CString::new(support.to_string_lossy().as_bytes())
        .map_err(|_| "Application Support path contains a NUL byte")?;
    let device = DEVICE_NAME
        .get()
        .cloned()
        .unwrap_or_else(|| "iPhone".to_owned());
    let device = CString::new(device).map_err(|_| "the device name contains a NUL byte")?;
    let error = unsafe { vela_core_start(support.as_ptr(), device.as_ptr()) };
    if !error.is_null() {
        let message = unsafe { CStr::from_ptr(error) }
            .to_string_lossy()
            .into_owned();
        unsafe { vela_core_free(error) };
        return Err(message);
    }
    if let Some(expiry) = signing_expiry()
        && let Ok(expiry) = CString::new(expiry)
    {
        unsafe { vela_core_set_signing_expiry(expiry.as_ptr()) };
    }
    Ok(())
}

fn application_support_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME").ok_or("the app container has no HOME")?;
    let directory = PathBuf::from(home).join("Library/Application Support");
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("create Application Support: {error}"))?;
    Ok(directory)
}

/// Best-effort read of the development profile's expiry, shown in Settings.
fn signing_expiry() -> Option<String> {
    let resources = NSBundle::mainBundle().bundlePath().to_string();
    let contents = std::fs::read(Path::new(&resources).join("embedded.mobileprovision")).ok()?;
    let text = String::from_utf8_lossy(&contents);
    let key = "<key>ExpirationDate</key>";
    let after_key = &text[text.find(key)? + key.len()..];
    let start = after_key.find("<date>")? + "<date>".len();
    let end = after_key.find("</date>")?;
    Some(after_key[start..end].to_owned())
}

#[allow(
    deprecated,
    reason = "UIApplication.openURL is the simplest http(s) hand-off; iOS 17 still supports it"
)]
fn open_url(url: &str) {
    let url = url.to_owned();
    // UIKit is main-thread only; CoreBridge calls may run on the engine thread.
    dispatch2::DispatchQueue::main().exec_async(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        if url.contains("login.tailscale.com") {
            // The login must happen in-app: leaving for Safari would suspend
            // the process and stop tsnet's login polling.
            present_auth_session(&url, mtm);
            return;
        }
        open_in_browser(&url, mtm);
    });
}

fn present_auth_session(url: &str, mtm: MainThreadMarker) {
    let Some(class) = AnyClass::get(c"ASWebAuthenticationSession") else {
        open_in_browser(url, mtm);
        return;
    };
    let Some(parsed) = NSURL::URLWithString(&NSString::from_str(url)) else {
        eprintln!("VELA_IOS invalid authentication URL: {url}");
        return;
    };
    let callback = NSString::from_str("vela");
    let completion = RcBlock::new(
        |_callback_url: *mut NSURL, error: *mut objc2_foundation::NSError| {
            if !error.is_null() {
                // Cancellation is the common case when the user closes the sheet.
                eprintln!("VELA_IOS authentication session ended");
            }
        },
    );
    let presenter: Retained<AuthPresenter> = unsafe { msg_send![AuthPresenter::alloc(mtm), init] };
    let completion: &block2::DynBlock<dyn Fn(*mut NSURL, *mut objc2_foundation::NSError)> =
        &completion;
    let allocated: Allocated<NSObject> = unsafe { msg_send![class, alloc] };
    let session: Retained<NSObject> = unsafe {
        msg_send![
            allocated,
            initWithURL: &*parsed,
            callbackURLScheme: &*callback,
            completionHandler: completion
        ]
    };
    let _: () = unsafe { msg_send![&session, setPresentationContextProvider: &*presenter] };
    let started: bool = unsafe { msg_send![&session, start] };
    if !started {
        eprintln!("VELA_IOS could not present the authentication session; using the browser");
        open_in_browser(url, mtm);
        return;
    }
    AUTH.with(|slot| *slot.borrow_mut() = Some((session, presenter)));
}

#[allow(
    deprecated,
    reason = "UIApplication.openURL is the simplest http(s) hand-off; iOS 17 still supports it"
)]
fn open_in_browser(url: &str, mtm: MainThreadMarker) {
    let Some(parsed) = NSURL::URLWithString(&NSString::from_str(url)) else {
        eprintln!("VELA_IOS invalid external URL: {url}");
        return;
    };
    UIApplication::sharedApplication(mtm).openURL(&parsed);
}

/// Entry point called by `main.swift`. Never returns.
///
/// # Panics
///
/// Panics when it is not called on the main thread, as `UIKit` requires.
#[unsafe(no_mangle)]
pub extern "C" fn vela_ios_main() -> ! {
    let mtm = MainThreadMarker::new().expect("vela_ios_main must run on the main thread");
    set_ui_sets(vec![nsh_base::registry(), __nsh_native_module()]);
    let delegate = NSString::from_str(
        AppDelegate::class()
            .name()
            .to_str()
            .expect("class name is UTF-8"),
    );
    UIApplication::main(None, Some(&delegate), mtm)
}
