//! Compact `AppKit` controls used by Vela's desktop NSH surface.
#![allow(unsafe_code, reason = "AppKit target/action uses Objective-C FFI")]

use block2::RcBlock;
use nsh_platform_macos::{
    ComponentContext, NativeComponent,
    objc2::{
        AllocAnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, define_class, msg_send,
        rc::Retained, runtime::AnyObject, sel,
    },
    objc2_app_kit::{
        NSAccessibility, NSAppearance, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
        NSBezelStyle, NSButton, NSButtonCell, NSCellImagePosition, NSCellStyleMask, NSColor,
        NSControlSize, NSControlStateValue, NSControlStateValueOff, NSControlStateValueOn, NSFont,
        NSFontAttributeName, NSForegroundColorAttributeName, NSImage, NSMutableParagraphStyle,
        NSParagraphStyleAttributeName, NSResponder, NSSwitch, NSTextAlignment, NSView,
    },
    objc2_foundation::{
        NSArray, NSAttributedString, NSDictionary, NSObject, NSObjectProtocol, NSString,
    },
};
use std::{
    cell::{Cell, RefCell},
    ptr::NonNull,
};

pub const BUTTON_COMPONENT: &str = "vela.desktopButton";
pub const SWITCH_COMPONENT: &str = "vela.switch";

/// State shared between a [`DesktopButton`] and the target its `NSButton`
/// sends actions to.
struct ButtonTargetState {
    context: ComponentContext,
    /// Whether a press reaches the app. The `NSButton` itself stays enabled
    /// while Vela shows it as disabled, so the target is what drops presses.
    accepts_press: Cell<bool>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = ButtonTargetState]
    #[name = "VelaDesktopButtonTarget"]
    struct ButtonTarget;

    unsafe impl NSObjectProtocol for ButtonTarget {}

    impl ButtonTarget {
        /// Every activation path (mouse, `performClick:`, the accessibility
        /// press action) arrives here, so this one guard covers them all.
        #[unsafe(method(pressed:))]
        fn pressed(&self, _sender: &NSButton) {
            let state = self.ivars();
            if state.accepts_press.get() {
                state.context.emit("press", serde_json::Value::Null);
            }
        }
    }
);

pub struct DesktopButton {
    button: Retained<NSButton>,
    target: Retained<ButtonTarget>,
    /// The cell's own highlight mask, restored when the button is re-enabled.
    default_highlight: Option<NSCellStyleMask>,
    variant: String,
    icon_only: bool,
    enabled: bool,
    accent: Retained<NSColor>,
    accent_foreground: Retained<NSColor>,
    danger: Retained<NSColor>,
    secondary: Retained<NSColor>,
    muted: Retained<NSColor>,
    disabled_bezel: Retained<NSColor>,
    disabled_ink: Retained<NSColor>,
}

/// How a button responds to input, decided without touching `AppKit`.
///
/// A disabled button stays `enabled` as far as `AppKit` knows, because a
/// disabled `NSButton` is drawn at reduced opacity with the system's disabled
/// text color regardless of its attributed title (measured at 1.25:1 light
/// and 1.68:1 dark). Vela instead keeps it enabled, paints the disabled
/// palette itself and switches off each way the button could be activated.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(
    clippy::struct_excessive_bools,
    reason = "each flag maps onto one independent AppKit setting"
)]
struct ButtonBehavior {
    /// The target forwards presses as `press` events.
    accepts_press: bool,
    /// The cell keeps its default highlight mask; otherwise it is cleared so a
    /// mouse-down draws nothing.
    highlights: bool,
    /// Reported to accessibility clients as enabled.
    accessibility_enabled: bool,
    /// Refuses keyboard focus, so Space cannot activate it.
    refuses_first_responder: bool,
}

impl ButtonBehavior {
    const fn resolve(enabled: bool) -> Self {
        Self {
            accepts_press: enabled,
            highlights: enabled,
            accessibility_enabled: enabled,
            refuses_first_responder: !enabled,
        }
    }
}

/// The bezel fill a button variant asks `AppKit` for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Bezel {
    /// No bezel color: `AppKit` draws its own neutral bezel (or none).
    System,
    Accent,
    Disabled,
}

/// The color a button variant draws its title and template image in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Ink {
    Accent,
    AccentForeground,
    Danger,
    Secondary,
    Muted,
    Disabled,
}

/// How a button looks for a given variant and enabled state, decided without
/// touching `AppKit` so the mapping can be unit-tested.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ButtonStyle {
    bordered: bool,
    bezel: Bezel,
    ink: Ink,
}

impl ButtonStyle {
    /// A disabled button names its colors outright, since `AppKit` never sees
    /// it as disabled (see [`ButtonBehavior`]). Bordered variants switch to the
    /// disabled ink, and `primary` also swaps the rust bezel for the disabled
    /// one. An icon-only button tints its icon with the disabled ink whatever
    /// its variant, because nothing else would dim it.
    fn resolve(variant: &str, enabled: bool, icon_only: bool) -> Self {
        let bordered = variant != "plain";
        if !enabled && (bordered || icon_only) {
            let bezel = if bordered && variant == "primary" {
                Bezel::Disabled
            } else {
                Bezel::System
            };
            return Self {
                bordered,
                bezel,
                ink: Ink::Disabled,
            };
        }
        let (bezel, ink) = match variant {
            "primary" => (Bezel::Accent, Ink::AccentForeground),
            "outline" => (Bezel::System, Ink::Accent),
            "danger" => (Bezel::System, Ink::Danger),
            // A borderless control inherits the system label color, which
            // only matches when the surface behind it follows the system
            // appearance. Naming the color keeps icon rails readable no
            // matter which surface token sits behind them.
            "plain" => (Bezel::System, Ink::Muted),
            _ => (Bezel::System, Ink::Secondary),
        };
        Self {
            bordered,
            bezel,
            ink,
        }
    }
}

impl DesktopButton {
    #[must_use]
    pub fn new(context: &ComponentContext, mtm: MainThreadMarker) -> Self {
        let target = ButtonTarget::alloc(mtm).set_ivars(ButtonTargetState {
            context: context.clone(),
            accepts_press: Cell::new(true),
        });
        let target: Retained<ButtonTarget> = unsafe { msg_send![super(target), init] };
        let button = unsafe {
            NSButton::buttonWithTitle_target_action(
                &NSString::new(),
                Some(&target),
                Some(sel!(pressed:)),
                mtm,
            )
        };
        button.setControlSize(NSControlSize::Small);
        button.setFont(Some(&NSFont::systemFontOfSize(11.0)));
        // A key equivalent would activate the button without going through
        // focus; Vela never sets one, and `apply_behavior` keeps it that way.
        button.setKeyEquivalent(&NSString::new());
        let default_highlight = button_cell(&button).map(|cell| cell.highlightsBy());
        context.set_size(72.0, 22.0);
        Self {
            button,
            target,
            default_highlight,
            variant: "primary".into(),
            icon_only: false,
            enabled: true,
            accent: accent_color(),
            accent_foreground: accent_foreground_color(),
            danger: danger_color(),
            secondary: secondary_color(),
            muted: muted_color(),
            disabled_bezel: disabled_bezel_color(),
            disabled_ink: disabled_ink_color(),
        }
    }

    /// Applies [`ButtonBehavior`] for the current enabled state. The
    /// `NSButton` itself is never disabled.
    fn apply_behavior(&self) {
        let behavior = ButtonBehavior::resolve(self.enabled);
        self.target
            .ivars()
            .accepts_press
            .set(behavior.accepts_press);
        if let (Some(cell), Some(default)) = (button_cell(&self.button), self.default_highlight) {
            cell.setHighlightsBy(if behavior.highlights {
                default
            } else {
                NSCellStyleMask::NoCellMask
            });
        }
        self.button
            .setAccessibilityEnabled(behavior.accessibility_enabled);
        self.button
            .setRefusesFirstResponder(behavior.refuses_first_responder);
        if !behavior.accepts_press && !self.button.keyEquivalent().is_empty() {
            self.button.setKeyEquivalent(&NSString::new());
        }
        // A focused button that just turned disabled would otherwise keep
        // answering Space until focus moves.
        if behavior.refuses_first_responder
            && let Some(window) = self.button.window()
            && window.firstResponder().is_some_and(|responder| {
                let button: &NSResponder = self.button.as_ref();
                std::ptr::eq(&raw const *responder, button)
            })
        {
            window.makeFirstResponder(None);
        }
    }

    /// Maps a semantic variant onto `AppKit` bezel, title and tint colors.
    ///
    /// Vela's accent is its own rust tone rather than the system accent, so
    /// `primary` names its color instead of following `controlAccentColor`.
    ///
    /// A title must be colored through `attributedTitle`:
    /// `setContentTintColor` only tints template images, so on its own it
    /// leaves every text button at the system default.
    ///
    /// Runs again whenever `variant`, `title` or `disabled` changes, because
    /// props can arrive in any order and each one changes the outcome.
    fn apply_variant(&self) {
        let style = ButtonStyle::resolve(&self.variant, self.enabled, self.icon_only);
        self.button.setBordered(style.bordered);
        self.button.setBezelStyle(NSBezelStyle::Push);
        let bezel = match style.bezel {
            Bezel::System => None,
            Bezel::Accent => Some(self.accent.clone()),
            Bezel::Disabled => Some(self.disabled_bezel.clone()),
        };
        self.button.setBezelColor(bezel.as_deref());
        let ink = match style.ink {
            Ink::Accent => self.accent.clone(),
            Ink::AccentForeground => self.accent_foreground.clone(),
            Ink::Danger => self.danger.clone(),
            Ink::Secondary => self.secondary.clone(),
            Ink::Muted => self.muted.clone(),
            Ink::Disabled => self.disabled_ink.clone(),
        };
        self.button.setContentTintColor(Some(&ink));
        self.apply_title_color(&ink);
    }

    /// Redraws the current title in `color`, preserving the control's font and
    /// centered alignment.
    ///
    /// An icon-only control keeps its plain title: it serves as the tooltip and
    /// the accessibility label, and is never drawn. Giving it an attributed
    /// title would also reset `imagePosition` to `NSImageOverlaps`, which makes
    /// the label appear next to the icon.
    fn apply_title_color(&self, color: &NSColor) {
        let title = self.button.title();
        if self.icon_only || title.is_empty() {
            return;
        }
        let paragraph = NSMutableParagraphStyle::new();
        paragraph.setAlignment(NSTextAlignment::Center);
        let attributes = NSDictionary::from_slices(
            &[
                unsafe { NSForegroundColorAttributeName },
                unsafe { NSFontAttributeName },
                unsafe { NSParagraphStyleAttributeName },
            ],
            &[
                color as &AnyObject,
                &*self
                    .button
                    .font()
                    .unwrap_or_else(|| NSFont::systemFontOfSize(NSFont::smallSystemFontSize())),
                &*paragraph,
            ],
        );
        // SAFETY: Every value in `attributes` is the object type its key
        // documents: a color, a font and a paragraph style.
        let styled = unsafe {
            NSAttributedString::initWithString_attributes(
                NSAttributedString::alloc(),
                &title,
                Some(&attributes),
            )
        };
        self.button.setAttributedTitle(&styled);
    }
}

/// Leaks one sRGB color per shade so the dynamic provider below can hand `AppKit`
/// a pointer that stays valid for the life of the process. [`dynamic_color`]
/// caches its result, so each palette shade is created exactly once.
fn leaked_srgb(red: f64, green: f64, blue: f64) -> NonNull<NSColor> {
    let color = NSColor::colorWithSRGBRed_green_blue_alpha(red, green, blue, 1.0);
    // SAFETY: `Retained::into_raw` returns a non-null, +1-retained pointer. The
    // color is intentionally never released: it is a palette constant.
    unsafe { NonNull::new_unchecked(Retained::into_raw(color)) }
}

/// Builds a color that `AppKit` resolves per appearance, so Vela's palette lives
/// in one place and follows appearance changes without any probing of its own.
///
/// Colors are cached per light/dark pair, so the leaked shades behind them are
/// created once however often a control re-applies its palette.
fn dynamic_color(light: (f64, f64, f64), dark: (f64, f64, f64)) -> Retained<NSColor> {
    type Key = [u64; 6];
    thread_local! {
        static CACHE: RefCell<Vec<(Key, Retained<NSColor>)>> = const { RefCell::new(Vec::new()) };
    }
    let key = [
        light.0.to_bits(),
        light.1.to_bits(),
        light.2.to_bits(),
        dark.0.to_bits(),
        dark.1.to_bits(),
        dark.2.to_bits(),
    ];
    CACHE.with_borrow_mut(|cache| {
        if let Some((_, color)) = cache.iter().find(|(cached, _)| *cached == key) {
            return color.clone();
        }
        let color = build_dynamic_color(light, dark);
        cache.push((key, color.clone()));
        color
    })
}

fn build_dynamic_color(light: (f64, f64, f64), dark: (f64, f64, f64)) -> Retained<NSColor> {
    let light = leaked_srgb(light.0, light.1, light.2);
    let dark = leaked_srgb(dark.0, dark.1, dark.2);
    let provider = RcBlock::new(
        move |appearance: NonNull<NSAppearance>| -> NonNull<NSColor> {
            // SAFETY: AppKit passes a live appearance for the duration of the call,
            // and the appearance names are documented constants.
            let matched = unsafe {
                appearance
                    .as_ref()
                    .bestMatchFromAppearancesWithNames(&NSArray::from_slice(&[
                        NSAppearanceNameAqua,
                        NSAppearanceNameDarkAqua,
                    ]))
            };
            if matched.is_some_and(|name| *name == *unsafe { NSAppearanceNameDarkAqua }) {
                dark
            } else {
                light
            }
        },
    );
    // SAFETY: The provider returns one of two permanently retained colors, so
    // the pointer AppKit receives is always valid.
    unsafe { NSColor::colorWithName_dynamicProvider(None, &provider) }
}

/// One semantic color: the shade `AppKit` picks for the current appearance.
struct Role {
    light: (f64, f64, f64),
    dark: (f64, f64, f64),
}

impl Role {
    fn color(&self) -> Retained<NSColor> {
        dynamic_color(self.light, self.dark)
    }
}

// The native-control palette. Comments carry the hex values the design tokens
// use, so a reviewer can compare this table with nsh.json without decoding
// fractions.
const ACCENT: Role = Role {
    light: (168.0 / 255.0, 73.0 / 255.0, 31.0 / 255.0), // #A8491F
    dark: (224.0 / 255.0, 138.0 / 255.0, 94.0 / 255.0), // #E08A5E
};
const ACCENT_FOREGROUND: Role = Role {
    light: (1.0, 1.0, 1.0),                           // #FFFFFF
    dark: (27.0 / 255.0, 26.0 / 255.0, 24.0 / 255.0), // #1B1A18
};
const DANGER: Role = Role {
    light: (166.0 / 255.0, 58.0 / 255.0, 46.0 / 255.0), // #A63A2E
    dark: (232.0 / 255.0, 121.0 / 255.0, 107.0 / 255.0), // #E8796B
};
const SECONDARY: Role = Role {
    light: (31.0 / 255.0, 30.0 / 255.0, 28.0 / 255.0), // #1F1E1C
    dark: (242.0 / 255.0, 240.0 / 255.0, 236.0 / 255.0), // #F2F0EC
};
const MUTED: Role = Role {
    light: (107.0 / 255.0, 103.0 / 255.0, 97.0 / 255.0), // #6B6761
    dark: (168.0 / 255.0, 162.0 / 255.0, 154.0 / 255.0), // #A8A29A
};
const DISABLED_BEZEL: Role = Role {
    light: (232.0 / 255.0, 229.0 / 255.0, 221.0 / 255.0), // #E8E5DD
    dark: (46.0 / 255.0, 44.0 / 255.0, 41.0 / 255.0),     // #2E2C29
};
const DISABLED_INK: Role = Role {
    light: (95.0 / 255.0, 91.0 / 255.0, 85.0 / 255.0), // #5F5B55, 5.3:1 on the bezel
    dark: (168.0 / 255.0, 162.0 / 255.0, 154.0 / 255.0), // #A8A29A
};

fn accent_color() -> Retained<NSColor> {
    ACCENT.color()
}

fn accent_foreground_color() -> Retained<NSColor> {
    ACCENT_FOREGROUND.color()
}

fn danger_color() -> Retained<NSColor> {
    DANGER.color()
}

fn secondary_color() -> Retained<NSColor> {
    SECONDARY.color()
}

fn muted_color() -> Retained<NSColor> {
    MUTED.color()
}

fn disabled_bezel_color() -> Retained<NSColor> {
    DISABLED_BEZEL.color()
}

fn disabled_ink_color() -> Retained<NSColor> {
    DISABLED_INK.color()
}

/// A boolean prop: absent, `null` or non-boolean values read as `false`.
fn bool_prop(value: Option<&serde_json::Value>) -> bool {
    value.and_then(serde_json::Value::as_bool).unwrap_or(false)
}

/// Parses the `#RRGGBB` / `#RRGGBBAA` value NSH's reactive `token()` emits.
fn color_prop(value: Option<&serde_json::Value>) -> Option<Retained<NSColor>> {
    let raw = value?.as_str()?.trim().trim_start_matches('#');
    if raw.len() != 6 && raw.len() != 8 {
        return None;
    }
    let channel = |at: usize| u8::from_str_radix(raw.get(at..at + 2)?, 16).ok();
    let (red, green, blue) = (channel(0)?, channel(2)?, channel(4)?);
    let alpha = if raw.len() == 8 { channel(6)? } else { 255 };
    Some(NSColor::colorWithSRGBRed_green_blue_alpha(
        f64::from(red) / 255.0,
        f64::from(green) / 255.0,
        f64::from(blue) / 255.0,
        f64::from(alpha) / 255.0,
    ))
}

/// The button's cell as the `NSButtonCell` that owns its highlight mask.
fn button_cell(button: &NSButton) -> Option<Retained<NSButtonCell>> {
    button.cell()?.downcast::<NSButtonCell>().ok()
}

impl NativeComponent for DesktopButton {
    fn view(&self) -> Retained<NSView> {
        Retained::into_super(Retained::into_super(self.button.clone()))
    }

    fn set_prop(&mut self, name: &str, value: Option<&serde_json::Value>) {
        match name {
            "title" => {
                let title = value.and_then(serde_json::Value::as_str).unwrap_or("");
                self.button.setTitle(&NSString::from_str(title));
                self.button.setToolTip(Some(&NSString::from_str(title)));
                // A plain title resets the attributed one, so the variant's
                // color has to be re-applied after every title change.
                self.apply_variant();
                self.button.sizeToFit();
                #[allow(
                    clippy::cast_possible_truncation,
                    reason = "AppKit control widths are small finite point values"
                )]
                let width = self.button.frame().size.width.max(38.0) as f32 + 8.0;
                self.button
                    .setFrameSize(nsh_platform_macos::objc2_foundation::NSSize::new(
                        f64::from(width),
                        22.0,
                    ));
                self.target.ivars().context.set_size(width, 22.0);
            }
            "disabled" => {
                // The `NSButton` stays enabled so `AppKit` draws Vela's
                // disabled palette instead of fading it; `apply_behavior`
                // makes it inert.
                self.enabled = !bool_prop(value);
                self.apply_behavior();
                self.apply_variant();
            }
            "variant" => {
                value
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("primary")
                    .clone_into(&mut self.variant);
                self.apply_variant();
            }
            "symbol" => {
                let symbol = value.and_then(serde_json::Value::as_str).unwrap_or("");
                let image = NSImage::imageWithSystemSymbolName_accessibilityDescription(
                    &NSString::from_str(symbol),
                    None,
                );
                if let Some(image) = image.as_deref() {
                    image.setTemplate(true);
                }
                self.button.setImage(image.as_deref());
                self.button.setImagePosition(if symbol.is_empty() {
                    NSCellImagePosition::NoImage
                } else {
                    NSCellImagePosition::ImageLeading
                });
                self.button.setImageHugsTitle(true);
                self.button.sizeToFit();
            }
            "iconOnly" if bool_prop(value) => {
                self.icon_only = true;
                // Drop any attributed title set before this prop arrived, so
                // the label cannot be drawn beside the icon.
                self.button.setAttributedTitle(&NSAttributedString::new());
                self.button
                    .setTitle(&self.button.toolTip().unwrap_or_default());
                self.button.setImagePosition(NSCellImagePosition::ImageOnly);
                // A disabled icon-only button dims its icon with the disabled
                // ink, so the palette depends on this prop too.
                self.apply_variant();
                self.target.ivars().context.set_size(28.0, 28.0);
            }
            "accent" | "accentForeground" | "danger" | "secondary" | "muted" | "disabledBezel"
            | "disabledInk" => {
                let Some(color) = color_prop(value) else {
                    return;
                };
                match name {
                    "accent" => self.accent = color,
                    "accentForeground" => self.accent_foreground = color,
                    "danger" => self.danger = color,
                    "secondary" => self.secondary = color,
                    "muted" => self.muted = color,
                    "disabledBezel" => self.disabled_bezel = color,
                    "disabledInk" => self.disabled_ink = color,
                    _ => unreachable!(),
                }
                self.apply_variant();
            }
            _ => {}
        }
    }
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = SwitchTargetState]
    #[name = "VelaSwitchTarget"]
    struct SwitchTarget;

    unsafe impl NSObjectProtocol for SwitchTarget {}

    impl SwitchTarget {
        /// `AppKit` sends the action only for a user toggle, never for
        /// `setState`, so the `value` prop cannot echo back as `change`.
        ///
        /// AppKit has already moved the switch. Keep that immediate feedback and
        /// remember it so another click before the app's async reply toggles in
        /// the other direction; the next `value` prop remains authoritative.
        #[unsafe(method(toggled:))]
        fn toggled(&self, sender: &NSSwitch) {
            let state = self.ivars();
            let requested = is_on(sender.state());
            state.value.set(requested);
            state.context.emit("change", change_payload(requested));
        }
    }
);

/// State shared between a [`DesktopSwitch`] and its action target.
struct SwitchTargetState {
    context: ComponentContext,
    /// The `value` prop: what the switch shows until the app changes it.
    value: Cell<bool>,
}

/// `NSSwitch` wrapper: props `value`, `disabled`, `label`; event `change`
/// with `{ "value": bool }` when the user toggles it. It shows `value` only.
pub struct DesktopSwitch {
    switch: Retained<NSSwitch>,
    target: Retained<SwitchTarget>,
}

impl DesktopSwitch {
    /// Size used when `fittingSize` reports nothing usable.
    const FALLBACK_SIZE: (f32, f32) = (38.0, 22.0);

    #[must_use]
    pub fn new(context: &ComponentContext, mtm: MainThreadMarker) -> Self {
        let target = SwitchTarget::alloc(mtm).set_ivars(SwitchTargetState {
            context: context.clone(),
            value: Cell::new(false),
        });
        let target: Retained<SwitchTarget> = unsafe { msg_send![super(target), init] };
        let switch = NSSwitch::new(mtm);
        // SAFETY: `toggled:` is defined on `SwitchTarget` with the
        // `(id sender)` signature AppKit uses for actions, and `target` keeps
        // the target alive for as long as the switch can send to it.
        unsafe {
            switch.setTarget(Some(&target));
            switch.setAction(Some(sel!(toggled:)));
        }
        switch.setControlSize(NSControlSize::Small);
        let fitting = switch.fittingSize();
        let (width, height) = switch_size(fitting.width, fitting.height);
        switch.setFrameSize(nsh_platform_macos::objc2_foundation::NSSize::new(
            f64::from(width),
            f64::from(height),
        ));
        context.set_size(width, height);
        Self { switch, target }
    }
}

impl NativeComponent for DesktopSwitch {
    fn view(&self) -> Retained<NSView> {
        Retained::into_super(Retained::into_super(self.switch.clone()))
    }

    fn set_prop(&mut self, name: &str, value: Option<&serde_json::Value>) {
        match name {
            "value" => {
                let on = bool_prop(value);
                self.target.ivars().value.set(on);
                self.switch.setState(state_for(on));
            }
            "disabled" => self.switch.setEnabled(!bool_prop(value)),
            "label" => {
                let label = value
                    .and_then(serde_json::Value::as_str)
                    .filter(|label| !label.is_empty())
                    .map(NSString::from_str);
                self.switch.setAccessibilityLabel(label.as_deref());
                self.switch.setToolTip(label.as_deref());
            }
            _ => {}
        }
    }
}

fn is_on(state: NSControlStateValue) -> bool {
    state == NSControlStateValueOn
}

fn state_for(on: bool) -> NSControlStateValue {
    if on {
        NSControlStateValueOn
    } else {
        NSControlStateValueOff
    }
}

fn change_payload(value: bool) -> serde_json::Value {
    serde_json::json!({ "value": value })
}

/// The switch's reported size, or [`DesktopSwitch::FALLBACK_SIZE`] when
/// `AppKit` reports an empty or non-finite one.
fn switch_size(width: f64, height: f64) -> (f32, f32) {
    let usable = |side: f64| side.is_finite() && side >= 1.0;
    if usable(width) && usable(height) {
        #[allow(
            clippy::cast_possible_truncation,
            reason = "AppKit control sizes are small finite point values"
        )]
        (width.ceil() as f32, height.ceil() as f32)
    } else {
        DesktopSwitch::FALLBACK_SIZE
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn style(variant: &str, enabled: bool) -> (bool, Bezel, Ink) {
        let style = ButtonStyle::resolve(variant, enabled, false);
        (style.bordered, style.bezel, style.ink)
    }

    #[test]
    fn enabled_variants_keep_their_palette() {
        assert_eq!(
            style("primary", true),
            (true, Bezel::Accent, Ink::AccentForeground)
        );
        assert_eq!(style("outline", true), (true, Bezel::System, Ink::Accent));
        assert_eq!(style("danger", true), (true, Bezel::System, Ink::Danger));
        assert_eq!(
            style("secondary", true),
            (true, Bezel::System, Ink::Secondary)
        );
        assert_eq!(style("plain", true), (false, Bezel::System, Ink::Muted));
        assert_eq!(
            style("unknown", true),
            (true, Bezel::System, Ink::Secondary)
        );
    }

    #[test]
    fn disabled_primary_drops_the_accent_bezel() {
        assert_eq!(
            style("primary", false),
            (true, Bezel::Disabled, Ink::Disabled)
        );
    }

    #[test]
    fn disabled_bordered_variants_use_disabled_ink() {
        for variant in ["outline", "danger", "secondary", "unknown"] {
            assert_eq!(
                style(variant, false),
                (true, Bezel::System, Ink::Disabled),
                "{variant}"
            );
        }
    }

    #[test]
    fn disabled_plain_keeps_its_muted_ink() {
        assert_eq!(style("plain", false), (false, Bezel::System, Ink::Muted));
    }

    #[test]
    fn disabled_icon_only_tints_with_disabled_ink() {
        for (variant, bordered) in [("plain", false), ("secondary", true), ("primary", true)] {
            let style = ButtonStyle::resolve(variant, false, true);
            assert_eq!(style.ink, Ink::Disabled, "{variant}");
            assert_eq!(style.bordered, bordered, "{variant}");
        }
        assert_eq!(ButtonStyle::resolve("plain", true, true).ink, Ink::Muted);
    }

    #[test]
    fn enabled_behavior_is_fully_interactive() {
        assert_eq!(
            ButtonBehavior::resolve(true),
            ButtonBehavior {
                accepts_press: true,
                highlights: true,
                accessibility_enabled: true,
                refuses_first_responder: false,
            }
        );
    }

    #[test]
    fn disabled_behavior_is_inert() {
        assert_eq!(
            ButtonBehavior::resolve(false),
            ButtonBehavior {
                accepts_press: false,
                highlights: false,
                accessibility_enabled: false,
                refuses_first_responder: true,
            }
        );
    }

    #[test]
    fn bool_prop_reads_only_true_as_true() {
        assert!(bool_prop(Some(&json!(true))));
        assert!(!bool_prop(Some(&json!(false))));
        assert!(!bool_prop(Some(&json!(null))));
        assert!(!bool_prop(Some(&json!("true"))));
        assert!(!bool_prop(None));
    }

    #[test]
    fn switch_state_round_trips() {
        assert!(is_on(state_for(true)));
        assert!(!is_on(state_for(false)));
        assert!(!is_on(NSControlStateValueOff));
        assert!(!is_on(-1));
    }

    #[test]
    fn change_payload_shape() {
        assert_eq!(change_payload(true), json!({ "value": true }));
        assert_eq!(change_payload(false), json!({ "value": false }));
    }

    #[test]
    fn switch_size_falls_back_when_unusable() {
        assert_eq!(switch_size(38.0, 22.0), (38.0, 22.0));
        assert_eq!(switch_size(31.5, 17.2), (32.0, 18.0));
        assert_eq!(switch_size(0.0, 0.0), DesktopSwitch::FALLBACK_SIZE);
        assert_eq!(switch_size(f64::NAN, 22.0), DesktopSwitch::FALLBACK_SIZE);
    }
}
