//! The `vela/webview` native component.
//!
//! It exists because the built-in `<WebView>` cannot select a
//! `WKWebsiteDataStore` per device+service or expose `isInspectable`. Vela's
//! iOS app opens every shared service inside one of these web views, keyed by
//! `dataKey`, so two Macs that both share `OpenCode` keep independent logins.
//!
//! `objc2-web-kit` publishes `WKWebView` for macOS only, so the web view
//! itself is created through the Objective-C runtime, as NSH's own iOS
//! `<webview>` does. The data-store and navigation-action types come from the
//! typed bindings.

use std::rc::Rc;

use nsh_core::JsonValue;
use nsh_platform_ios::{ComponentContext, ComponentFactory, NativeComponent};
use objc2::rc::{Allocated, Retained, Weak};
use objc2::runtime::AnyClass;
use objc2::{AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, define_class, msg_send};
use objc2_core_foundation::CGRect;
use objc2_foundation::{
    NSError, NSObject, NSObjectProtocol, NSString, NSURL, NSURLRequest, NSUUID,
};
use objc2_ui_kit::{NSLayoutConstraint, UIColor, UITraitEnvironment, UIView, UIViewAutoresizing};
use objc2_web_kit::{
    WKNavigation, WKNavigationAction, WKNavigationActionPolicy, WKScriptMessage,
    WKUserContentController, WKUserScript, WKUserScriptInjectionTime, WKWebViewConfiguration,
    WKWebsiteDataStore,
};

/// The message channel the scroll observer posts to.
const SCROLL_CHANNEL: &str = "velaScroll";

/// Reports scrolling from inside the page. Many web apps (`OpenCode`, DSH)
/// scroll an inner element, not the document, so the web view's own scroll
/// view never moves; a capturing `scroll` listener sees every scroller.
/// It posts at most one message per direction change.
const SCROLL_OBSERVER: &str = r"
(() => {
  if (window.__velaScroll) return;
  window.__velaScroll = true;
  const send = (message) => window.webkit.messageHandlers.velaScroll.postMessage(message);

  let pending = false;
  const reportTheme = () => {
    pending = false;
    // Only announce that the semantic browser color may have changed. Native
    // code reads WKWebView.themeColor; no CSS color crosses this bridge.
    send({ themeSync: true });
  };
  // Theme switches change a class or style on <html>/<body>, or the meta tag;
  // check at most once a frame, and only for those.
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(reportTheme);
  };
  const watch = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'content'] };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, watch);
  if (document.body) observer.observe(document.body, watch);
  if (document.head) observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
  window.addEventListener('load', schedule);
  // Single-page apps render after load: sample again as they settle.
  for (const delay of [100, 400, 1200, 3000]) setTimeout(schedule, delay);
  schedule();
  const last = new WeakMap();
  let direction = 0;
  const post = (next, top) => {
    if (next === direction) return;
    direction = next;
    window.webkit.messageHandlers.velaScroll.postMessage({ collapsed: next > 0, offset: top });
  };
  document.addEventListener('scroll', (event) => {
    const el = event.target === document ? document.scrollingElement : event.target;
    if (!el || el.scrollHeight - el.clientHeight < 64) return;
    const top = el.scrollTop;
    const previous = last.has(el) ? last.get(el) : top;
    last.set(el, top);
    const delta = top - previous;
    const atEnd = top <= 8 || top >= el.scrollHeight - el.clientHeight - 8;
    if (atEnd) return post(-1, top);
    if (Math.abs(delta) < 6) return;
    post(delta > 0 ? 1 : -1, top);
  }, { capture: true, passive: true });
})();
";

/// The name the TSX app passes to `nativeComponent`.
pub const COMPONENT: &str = "vela/webview";

thread_local! {
    /// The most recently created service WebView. Objective-C weak storage is
    /// zeroed automatically when NSH unmounts it, so lifecycle recovery never
    /// retains a hidden page or touches the NSH tree.
    static ACTIVE_WEB_VIEW: std::cell::RefCell<Weak<UIView>> =
        std::cell::RefCell::new(Weak::default());
}

/// Reloads the current service after Core has synchronously restored its
/// loopback mapping. This runs on `UIKit`'s main thread and bypasses NSH state.
pub fn reload_active() -> bool {
    ACTIVE_WEB_VIEW.with(|slot| {
        if let Some(web_view) = slot.borrow().load() {
            let _: () = unsafe { msg_send![&*web_view, reload] };
            true
        } else {
            false
        }
    })
}

/// Creates the `vela/webview` factory for one surface.
pub fn factory(mtm: MainThreadMarker) -> ComponentFactory {
    Rc::new(move |context| Box::new(WebViewComponent::new(context, mtm)))
}

struct HandlerIvars {
    context: ComponentContext,
    /// The last vertical offset reported, to derive scroll direction.
    last_offset: std::cell::Cell<f64>,
    /// The last direction emitted ("up" reveals the bar, "down" collapses it).
    direction: std::cell::Cell<i8>,
}

define_class!(
    /// Forwards WKWebView navigation callbacks to the TSX component. All
    /// methods are selectors WebKit calls; the class does not need to declare
    /// a protocol conformance in Rust.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaWebViewHandler"]
    #[ivars = HandlerIvars]
    struct NavigationHandler;

    unsafe impl NSObjectProtocol for NavigationHandler {}

    impl NavigationHandler {
        #[unsafe(method(webView:decidePolicyForNavigationAction:decisionHandler:))]
        fn decide_policy(
            &self,
            _web_view: &UIView,
            action: &WKNavigationAction,
            handler: &block2::DynBlock<dyn Fn(WKNavigationActionPolicy)>,
        ) {
            let url = unsafe { action.request().URL() }
                .and_then(|url| url.absoluteString())
                .map(|url| url.to_string())
                .unwrap_or_default();
            // Only loopback and ordinary web pages: Vela is not a jump box and
            // must not follow custom schemes out of the app.
            let allowed = url.is_empty()
                || url.starts_with("http://127.0.0.1")
                || url.starts_with("https://")
                || url.starts_with("about:");
            if !allowed {
                self.emit(
                    "error",
                    serde_json::json!({"message": "该页面尝试离开 Vela", "url": url}),
                );
            }
            handler.call((
                if allowed {
                    WKNavigationActionPolicy::Allow
                } else {
                    WKNavigationActionPolicy::Cancel
                },
            ));
        }

        /// `UIScrollViewDelegate`: the page scrolled. Emits a direction change
        /// once per reversal so TSX can collapse or expand its chrome.
        #[unsafe(method(scrollViewDidScroll:))]
        fn did_scroll(&self, scroll_view: &UIView) {
            let offset: objc2_core_foundation::CGPoint = unsafe { msg_send![scroll_view, contentOffset] };
            let inset: objc2_ui_kit::UIEdgeInsets = unsafe { msg_send![scroll_view, adjustedContentInset] };
            let content: objc2_core_foundation::CGSize = unsafe { msg_send![scroll_view, contentSize] };
            let bounds = scroll_view.bounds();
            let tracking: bool = unsafe { msg_send![scroll_view, isTracking] };
            let y = offset.y + inset.top;
            let bottom = content.height + inset.top + inset.bottom - bounds.size.height;
            let delta = y - self.ivars().last_offset.get();
            self.ivars().last_offset.set(y);
            // Near the top or at the end of the page the bar always shows.
            let next = if y <= 8.0 || y >= bottom - 8.0 {
                -1
            } else if !tracking || delta.abs() < 6.0 {
                return;
            } else if delta > 0.0 {
                1
            } else {
                -1
            };
            if self.ivars().direction.replace(next) != next {
                self.emit("scroll", serde_json::json!({ "collapsed": next > 0, "offset": y }));
            }
        }

        /// `WKScriptMessageHandler`: the page's scroll observer posted.
        #[unsafe(method(userContentController:didReceiveScriptMessage:))]
        fn did_receive_message(&self, _controller: &WKUserContentController, message: &WKScriptMessage) {
            let body: Retained<objc2::runtime::AnyObject> = unsafe { message.body() };
            let theme_sync: Option<Retained<objc2::runtime::AnyObject>> =
                unsafe { msg_send![&body, objectForKey: &*NSString::from_str("themeSync")] };
            if theme_sync.is_some() {
                let web_view: Option<Retained<UIView>> = unsafe { msg_send![message, webView] };
                if let Some(web_view) = web_view {
                    self.sync_theme(&web_view);
                }
                return;
            }
            let collapsed: Option<Retained<objc2::runtime::AnyObject>> =
                unsafe { msg_send![&body, objectForKey: &*NSString::from_str("collapsed")] };
            let collapsed = collapsed.is_some_and(|value| {
                let flag: bool = unsafe { msg_send![&value, boolValue] };
                flag
            });
            let next: i8 = if collapsed { 1 } else { -1 };
            if self.ivars().direction.replace(next) != next {
                self.emit("scroll", serde_json::json!({ "collapsed": collapsed, "offset": 0 }));
            }
        }

        #[unsafe(method(webView:didStartProvisionalNavigation:))]
        fn did_start(&self, web_view: &UIView, _navigation: Option<&WKNavigation>) {
            self.emit_state("navigationStateChange", web_view);
        }

        #[unsafe(method(webView:didFinishNavigation:))]
        fn did_finish(&self, web_view: &UIView, _navigation: Option<&WKNavigation>) {
            self.sync_theme(web_view);
            self.emit_state("load", web_view);
            self.emit_state("navigationStateChange", web_view);
        }

        #[unsafe(method(webView:didFailNavigation:withError:))]
        fn did_fail(
            &self,
            _web_view: &UIView,
            _navigation: Option<&WKNavigation>,
            error: &NSError,
        ) {
            self.emit_error(error);
        }

        #[unsafe(method(webView:didFailProvisionalNavigation:withError:))]
        fn did_fail_provisional(
            &self,
            _web_view: &UIView,
            _navigation: Option<&WKNavigation>,
            error: &NSError,
        ) {
            self.emit_error(error);
        }
    }
);

impl NavigationHandler {
    fn new(mtm: MainThreadMarker, context: ComponentContext) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(HandlerIvars {
            context,
            last_offset: std::cell::Cell::new(0.0),
            direction: std::cell::Cell::new(-1),
        });
        unsafe { msg_send![super(this), init] }
    }

    fn emit(&self, event: &str, data: JsonValue) {
        self.ivars().context.emit(event, data);
    }

    fn emit_error(&self, error: &NSError) {
        self.emit(
            "error",
            serde_json::json!({
                "message": error.localizedDescription().to_string(),
                "code": error.code(),
                "url": "",
            }),
        );
    }

    /// Paints the full-screen component container with the semantic browser
    /// color declared by the page. This fills the 63pt top and 84pt bottom
    /// bands without extending the `WebView` into them.
    fn sync_theme(&self, web_view: &UIView) {
        let theme: Option<Retained<UIColor>> = unsafe { msg_send![web_view, themeColor] };
        let color = theme.unwrap_or_else(|| {
            let under_page: Option<Retained<UIColor>> =
                unsafe { msg_send![web_view, underPageBackgroundColor] };
            under_page.unwrap_or_else(UIColor::systemBackgroundColor)
        });
        if let Some(container) = web_view.superview() {
            container.setBackgroundColor(Some(&color));
        }

        let mut red = 0.0;
        let mut green = 0.0;
        let mut blue = 0.0;
        let mut alpha = 0.0;
        let resolved = color.resolvedColorWithTraitCollection(&web_view.traitCollection());
        let converted = unsafe {
            resolved.getRed_green_blue_alpha(
                &raw mut red,
                &raw mut green,
                &raw mut blue,
                &raw mut alpha,
            )
        };
        if converted {
            let linear = |value: f64| {
                if value <= 0.039_28 {
                    value / 12.92
                } else {
                    ((value + 0.055) / 1.055).powf(2.4)
                }
            };
            let luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
            self.emit("theme", serde_json::json!({ "isDark": luminance < 0.4 }));
        }
    }

    fn emit_state(&self, event: &str, web_view: &UIView) {
        let url: Option<Retained<NSURL>> = unsafe { msg_send![web_view, URL] };
        let url = url
            .and_then(|url| url.absoluteString())
            .map(|url| url.to_string())
            .unwrap_or_default();
        let title: Option<Retained<NSString>> = unsafe { msg_send![web_view, title] };
        let title = title.map(|title| title.to_string()).unwrap_or_default();
        let loading: bool = unsafe { msg_send![web_view, isLoading] };
        let can_go_back: bool = unsafe { msg_send![web_view, canGoBack] };
        let can_go_forward: bool = unsafe { msg_send![web_view, canGoForward] };
        self.emit(
            event,
            serde_json::json!({
                "url": url,
                "title": title,
                "loading": loading,
                "canGoBack": can_go_back,
                "canGoForward": can_go_forward,
            }),
        );
    }
}

/// One service page. The `UIKit` container exists from the start; the
/// `WKWebView` is made once both `source` and `dataKey` are known so the data
/// store can be selected before the first request.
pub struct WebViewComponent {
    mtm: MainThreadMarker,
    context: ComponentContext,
    container: Retained<UIView>,
    web_view: Option<Retained<UIView>>,
    #[allow(
        dead_code,
        reason = "retains the navigation delegate while the web view lives"
    )]
    handler: Option<Retained<NavigationHandler>>,
    source: Option<String>,
    data_key: String,
    bottom_inset: f64,
    top_inset: f64,
    top_constraint: Option<Retained<NSLayoutConstraint>>,
    toolbar_constraint: Option<Retained<NSLayoutConstraint>>,
}

impl WebViewComponent {
    fn new(context: ComponentContext, mtm: MainThreadMarker) -> Self {
        let container = UIView::initWithFrame(UIView::alloc(mtm), CGRect::ZERO);
        container.setAutoresizingMask(
            UIViewAutoresizing::FlexibleWidth | UIViewAutoresizing::FlexibleHeight,
        );
        Self {
            mtm,
            context,
            container,
            web_view: None,
            handler: None,
            source: None,
            data_key: String::new(),
            bottom_inset: 0.0,
            top_inset: 0.0,
            top_constraint: None,
            toolbar_constraint: None,
        }
    }

    fn ensure_web_view(&mut self) -> bool {
        if self.web_view.is_some() {
            return true;
        }
        if self.data_key.is_empty() {
            // Wait for dataKey: the store cannot change after creation.
            return false;
        }
        let Some(class) = AnyClass::get(c"WKWebView") else {
            self.context.emit(
                "error",
                serde_json::json!({"message": "WebKit 不可用", "url": ""}),
            );
            return false;
        };
        let configuration = unsafe { WKWebViewConfiguration::new(self.mtm) };
        let store = data_store(&self.data_key, self.mtm);
        unsafe { configuration.setWebsiteDataStore(&store) };
        let handler = NavigationHandler::new(self.mtm, self.context.clone());
        let controller = unsafe { configuration.userContentController() };
        let script = unsafe {
            WKUserScript::initWithSource_injectionTime_forMainFrameOnly(
                WKUserScript::alloc(self.mtm),
                &NSString::from_str(SCROLL_OBSERVER),
                WKUserScriptInjectionTime::AtDocumentEnd,
                true,
            )
        };
        unsafe { controller.addUserScript(&script) };
        // The content controller retains its handler; the handler holds only
        // the component context, so there is no cycle with the web view.
        let channel = NSString::from_str(SCROLL_CHANNEL);
        let _: () =
            unsafe { msg_send![&controller, addScriptMessageHandler: &*handler, name: &*channel] };
        let allocated: Allocated<UIView> = unsafe { msg_send![class, alloc] };
        let web_view: Retained<UIView> = unsafe {
            msg_send![allocated, initWithFrame: self.container.bounds(), configuration: &*configuration]
        };
        web_view.setTranslatesAutoresizingMaskIntoConstraints(false);
        // Web Inspector is a development aid; release builds do not expose
        // the page to a connected Mac.
        let _: () = unsafe { msg_send![&web_view, setInspectable: cfg!(debug_assertions)] };
        let _: () = unsafe { msg_send![&web_view, setNavigationDelegate: &*handler] };
        let scroll_view: Retained<UIView> = unsafe { msg_send![&web_view, scrollView] };
        let _: () = unsafe { msg_send![&scroll_view, setDelegate: &*handler] };
        // The view's real bounds clear Vela's chrome. Its bottom edge follows
        // UIKeyboardLayoutGuide, so UIKit handles every keyboard transition
        // without mutating WebKit's viewport, content inset or scroll offset.
        let _: () = unsafe { msg_send![&scroll_view, setContentInsetAdjustmentBehavior: 2isize] };
        let _: () = unsafe { msg_send![&scroll_view, setAlwaysBounceVertical: false] };
        self.container.addSubview(&web_view);
        let leading = web_view
            .leadingAnchor()
            .constraintEqualToAnchor(&self.container.leadingAnchor());
        let trailing = web_view
            .trailingAnchor()
            .constraintEqualToAnchor(&self.container.trailingAnchor());
        let top = web_view
            .topAnchor()
            .constraintEqualToAnchor_constant(&self.container.topAnchor(), self.top_inset);
        let toolbar = web_view
            .bottomAnchor()
            .constraintEqualToAnchor_constant(&self.container.bottomAnchor(), -self.bottom_inset);
        // The toolbar position wins while the keyboard is hidden. When the
        // keyboard rises, this softer equality yields to the required upper
        // bound at the keyboard's top edge.
        toolbar.setPriority(999.0);
        let above_keyboard = web_view
            .bottomAnchor()
            .constraintLessThanOrEqualToAnchor(&self.container.keyboardLayoutGuide().topAnchor());
        for constraint in [&leading, &trailing, &top, &toolbar, &above_keyboard] {
            constraint.setActive(true);
        }
        self.top_constraint = Some(top);
        self.toolbar_constraint = Some(toolbar);
        ACTIVE_WEB_VIEW.with(|slot| {
            *slot.borrow_mut() = Weak::from_retained(&web_view);
        });
        self.web_view = Some(web_view);
        self.handler = Some(handler);
        true
    }

    fn load(&mut self) {
        let Some(source) = self.source.clone() else {
            return;
        };
        if !self.ensure_web_view() {
            return;
        }
        let Some(web_view) = self.web_view.as_ref() else {
            return;
        };
        let Some(url) = NSURL::URLWithString(&NSString::from_str(&source)) else {
            self.context.emit(
                "error",
                serde_json::json!({"message": "服务地址无效", "url": source}),
            );
            return;
        };
        let request = NSURLRequest::requestWithURL(&url);
        let _: () = unsafe { msg_send![web_view, loadRequest: &*request] };
        self.context.emit(
            "navigationStateChange",
            serde_json::json!({"url": source, "title": "", "loading": true}),
        );
    }
}

impl NativeComponent for WebViewComponent {
    fn view(&self) -> &UIView {
        &self.container
    }

    fn set_prop(&mut self, name: &str, value: Option<&JsonValue>) {
        match name {
            "source" => {
                self.source = value.and_then(JsonValue::as_str).map(str::to_owned);
                self.load();
            }
            "bottomInset" | "topInset" => {
                let inset = value.and_then(JsonValue::as_f64).unwrap_or(0.0);
                if name == "topInset" {
                    self.top_inset = inset;
                } else {
                    self.bottom_inset = inset;
                }
                if name == "topInset" {
                    if let Some(constraint) = self.top_constraint.as_ref() {
                        constraint.setConstant(self.top_inset);
                    }
                } else if let Some(constraint) = self.toolbar_constraint.as_ref() {
                    constraint.setConstant(-self.bottom_inset);
                }
            }
            "dataKey" => {
                value
                    .and_then(JsonValue::as_str)
                    .unwrap_or_default()
                    .clone_into(&mut self.data_key);
                if self.source.is_some() {
                    self.load();
                }
            }
            _ => {}
        }
    }

    fn command(&mut self, name: &str, _args: &JsonValue) {
        let Some(web_view) = self.web_view.as_ref() else {
            if name == "reload" {
                self.load();
            }
            return;
        };
        match name {
            "reload" => {
                let _: () = unsafe { msg_send![web_view, reload] };
            }
            "goBack" => {
                let _: Option<Retained<WKNavigation>> = unsafe { msg_send![web_view, goBack] };
            }
            "goForward" => {
                let _: Option<Retained<WKNavigation>> = unsafe { msg_send![web_view, goForward] };
            }
            "home" => {
                if let Some(source) = self.source.clone()
                    && let Some(url) = NSURL::URLWithString(&NSString::from_str(&source))
                {
                    let request = NSURLRequest::requestWithURL(&url);
                    let _: () = unsafe { msg_send![web_view, loadRequest: &*request] };
                }
            }
            _ => {}
        }
    }
}

fn data_store(data_key: &str, mtm: MainThreadMarker) -> Retained<WKWebsiteDataStore> {
    let identifier = uuid_for(data_key);
    unsafe { WKWebsiteDataStore::dataStoreForIdentifier(&identifier, mtm) }
}

/// Deterministic UUID for a device+service key. FNV-1a is enough: the value is
/// only a local data-store name, not a secret.
fn uuid_for(data_key: &str) -> Retained<NSUUID> {
    let mut first: u64 = 0xcbf2_9ce4_8422_2325;
    let mut second: u64 = 0x8422_2325_cbf2_9ce4;
    for byte in data_key.as_bytes() {
        first ^= u64::from(*byte);
        first = first.wrapping_mul(0x0000_0100_0000_01b3);
        second ^= u64::from(*byte).rotate_left(1);
        second = second.wrapping_mul(0x0000_0100_0000_01b3);
    }
    let text = format!(
        "{:08x}-{:04x}-5{:03x}-8{:03x}-{:012x}",
        first >> 32,
        (first >> 16) & 0xffff,
        first & 0xfff,
        (second >> 48) & 0xfff,
        second & 0x0000_ffff_ffff_ffff,
    );
    let string = NSString::from_str(&text);
    NSUUID::initWithUUIDString(NSUUID::alloc(), &string).unwrap_or_else(NSUUID::UUID)
}
