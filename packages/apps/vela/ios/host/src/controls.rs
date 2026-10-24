//! Native controls the TSX surface uses where NSH's own drawing would read as
//! "not iOS": SF Symbols, `UISwitch` and `UISegmentedControl`.

use std::rc::Rc;

use nsh_core::JsonValue;
use nsh_platform_ios::{ComponentContext, ComponentFactory, NativeComponent};
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{DefinedClass, MainThreadMarker, MainThreadOnly, define_class, msg_send, sel};
use objc2_core_foundation::CGRect;
use objc2_foundation::{NSObject, NSObjectProtocol, NSString};
use objc2_ui_kit::{
    UIColor, UIControlEvents, UIImage, UIImageSymbolConfiguration, UIImageSymbolWeight,
    UIImageView, UISegmentedControl, UISwitch, UIView, UIViewContentMode,
};

pub const SYMBOL: &str = "vela/symbol";
pub const SWITCH: &str = "vela/switch";
pub const SEGMENTED: &str = "vela/segmented";

/// Registers every control on `components`.
pub fn register(components: &nsh_platform_ios::Components, mtm: MainThreadMarker) {
    components.register(SYMBOL, symbol_factory(mtm));
    components.register(SWITCH, switch_factory(mtm));
    components.register(SEGMENTED, segmented_factory(mtm));
}

/// `#RRGGBB` or `#RRGGBBAA` to a `UIColor`.
pub fn color(hex: &str) -> Option<Retained<UIColor>> {
    let value = hex.trim().trim_start_matches('#');
    let channel = |index: usize| u8::from_str_radix(value.get(index..index + 2)?, 16).ok();
    let (red, green, blue) = (channel(0)?, channel(2)?, channel(4)?);
    let alpha = if value.len() == 8 { channel(6)? } else { 255 };
    Some(UIColor::colorWithRed_green_blue_alpha(
        f64::from(red) / 255.0,
        f64::from(green) / 255.0,
        f64::from(blue) / 255.0,
        f64::from(alpha) / 255.0,
    ))
}

fn text(value: Option<&JsonValue>) -> String {
    value
        .and_then(JsonValue::as_str)
        .unwrap_or_default()
        .to_owned()
}

// --- SF Symbol --------------------------------------------------------------

fn symbol_factory(mtm: MainThreadMarker) -> ComponentFactory {
    Rc::new(move |_context| Box::new(Symbol::new(mtm)))
}

struct Symbol {
    view: Retained<UIImageView>,
    name: String,
    size: f64,
    weight: UIImageSymbolWeight,
}

impl Symbol {
    fn new(mtm: MainThreadMarker) -> Self {
        let view = UIImageView::initWithImage(UIImageView::alloc(mtm), None);
        view.setContentMode(UIViewContentMode::Center);
        Self {
            view,
            name: String::new(),
            size: 17.0,
            weight: UIImageSymbolWeight::Regular,
        }
    }

    fn render(&self) {
        if self.name.is_empty() {
            self.view.setImage(None);
            return;
        }
        let configuration =
            UIImageSymbolConfiguration::configurationWithPointSize_weight(self.size, self.weight);
        let image = UIImage::systemImageNamed_withConfiguration(
            &NSString::from_str(&self.name),
            Some(&configuration),
        );
        self.view.setImage(image.as_deref());
    }
}

impl NativeComponent for Symbol {
    fn view(&self) -> &UIView {
        &self.view
    }

    fn set_prop(&mut self, name: &str, value: Option<&JsonValue>) {
        match name {
            "name" => self.name = text(value),
            "size" => self.size = value.and_then(JsonValue::as_f64).unwrap_or(17.0),
            "weight" => {
                self.weight = match value.and_then(JsonValue::as_str) {
                    Some("medium") => UIImageSymbolWeight::Medium,
                    Some("semibold") => UIImageSymbolWeight::Semibold,
                    Some("bold") => UIImageSymbolWeight::Bold,
                    _ => UIImageSymbolWeight::Regular,
                };
            }
            "tint" => {
                let tint = value.and_then(JsonValue::as_str).and_then(color);
                unsafe { self.view.setTintColor(tint.as_deref()) };
                return;
            }
            _ => return,
        }
        self.render();
    }
}

// --- Target-action bridge ---------------------------------------------------

struct TargetIvars {
    context: ComponentContext,
}

define_class!(
    /// Receives `UIControlEventValueChanged` and forwards it to TSX.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "VelaControlTarget"]
    #[ivars = TargetIvars]
    struct ControlTarget;

    unsafe impl NSObjectProtocol for ControlTarget {}

    impl ControlTarget {
        #[unsafe(method(switchChanged:))]
        fn switch_changed(&self, sender: &UISwitch) {
            self.ivars()
                .context
                .emit("change", serde_json::json!({ "value": sender.isOn() }));
        }

        #[unsafe(method(segmentChanged:))]
        fn segment_changed(&self, sender: &UISegmentedControl) {
            self.ivars()
                .context
                .emit("change", serde_json::json!({ "index": sender.selectedSegmentIndex() }));
        }
    }
);

impl ControlTarget {
    fn new(mtm: MainThreadMarker, context: ComponentContext) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(TargetIvars { context });
        unsafe { msg_send![super(this), init] }
    }
}

// --- UISwitch ---------------------------------------------------------------

fn switch_factory(mtm: MainThreadMarker) -> ComponentFactory {
    Rc::new(move |context| Box::new(Switch::new(context, mtm)))
}

struct Switch {
    control: Retained<UISwitch>,
    _target: Retained<ControlTarget>,
}

impl Switch {
    fn new(context: ComponentContext, mtm: MainThreadMarker) -> Self {
        let control = UISwitch::initWithFrame(UISwitch::alloc(mtm), CGRect::ZERO);
        // The system decides the switch's size (it changed in iOS 26):
        // report what UIKit lays it out at instead of a fixed 51 x 31.
        control.sizeToFit();
        let natural = control.frame().size;
        #[allow(
            clippy::cast_possible_truncation,
            reason = "a switch is a few dozen points"
        )]
        context.set_size(natural.width as f32, natural.height as f32);
        let target = ControlTarget::new(mtm, context);
        unsafe {
            control.addTarget_action_forControlEvents(
                Some(&*(Retained::as_ptr(&target).cast::<AnyObject>())),
                sel!(switchChanged:),
                UIControlEvents::ValueChanged,
            );
        }
        Self {
            control,
            _target: target,
        }
    }
}

impl NativeComponent for Switch {
    fn view(&self) -> &UIView {
        &self.control
    }

    fn set_prop(&mut self, name: &str, value: Option<&JsonValue>) {
        match name {
            "value" => self
                .control
                .setOn_animated(value.and_then(JsonValue::as_bool).unwrap_or(false), true),
            "disabled" => self
                .control
                .setEnabled(!value.and_then(JsonValue::as_bool).unwrap_or(false)),
            "tint" => {
                let tint = value.and_then(JsonValue::as_str).and_then(color);
                self.control.setOnTintColor(tint.as_deref());
            }
            _ => {}
        }
    }
}

// --- UISegmentedControl -----------------------------------------------------

fn segmented_factory(mtm: MainThreadMarker) -> ComponentFactory {
    Rc::new(move |context| Box::new(Segmented::new(context, mtm)))
}

struct Segmented {
    control: Retained<UISegmentedControl>,
    _target: Retained<ControlTarget>,
    selected: isize,
}

impl Segmented {
    fn new(context: ComponentContext, mtm: MainThreadMarker) -> Self {
        let control =
            unsafe { UISegmentedControl::initWithItems(UISegmentedControl::alloc(mtm), None) };
        let target = ControlTarget::new(mtm, context);
        unsafe {
            control.addTarget_action_forControlEvents(
                Some(&*(Retained::as_ptr(&target).cast::<AnyObject>())),
                sel!(segmentChanged:),
                UIControlEvents::ValueChanged,
            );
        }
        Self {
            control,
            _target: target,
            selected: 0,
        }
    }
}

impl NativeComponent for Segmented {
    fn view(&self) -> &UIView {
        &self.control
    }

    fn set_prop(&mut self, name: &str, value: Option<&JsonValue>) {
        match name {
            "items" => {
                self.control.removeAllSegments();
                let items = value
                    .and_then(JsonValue::as_array)
                    .cloned()
                    .unwrap_or_default();
                for (index, item) in items.iter().enumerate() {
                    let title = NSString::from_str(item.as_str().unwrap_or_default());
                    self.control.insertSegmentWithTitle_atIndex_animated(
                        Some(&title),
                        index,
                        false,
                    );
                }
                self.control.setSelectedSegmentIndex(self.selected);
            }
            "selected" => {
                self.selected = value
                    .and_then(JsonValue::as_i64)
                    .and_then(|index| isize::try_from(index).ok())
                    .unwrap_or(0);
                self.control.setSelectedSegmentIndex(self.selected);
            }
            _ => {}
        }
    }
}
