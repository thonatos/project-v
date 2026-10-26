use crossbeam_channel::{Receiver, Sender};
use nsh_base::Theme;
use nsh_core::{
    ApproxTextEngine, Color, JsonValue, MountBatch, MountItem, Size, geometry::px, time::Clock,
};
use nsh_engine::{App, Bundle, Engine, EngineConfig, Environment, EnvironmentPins, MountSink};
use std::{
    collections::HashMap,
    path::PathBuf,
    time::{Duration, Instant},
};

struct ChannelSink(Sender<MountBatch>);

impl MountSink for ChannelSink {
    fn submit(&self, batch: MountBatch) {
        let _ = self.0.send(batch);
    }
}

fn macos_fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/ThemeOverrideFixture.tsx")
}

fn ios_fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../ios/host/tests/fixtures/ThemeOverrideFixture.tsx")
}

fn start(entry: PathBuf) -> (Engine, Receiver<MountBatch>) {
    let bundle = nsh_bundler::bundle(&nsh_bundler::BundleOptions {
        entry,
        minify: false,
        split: false,
        ui_sets: vec![nsh_base::registry().into()],
    })
    .expect("Vela theme fixture should bundle");
    let (tx, rx) = crossbeam_channel::unbounded();
    let config = EngineConfig {
        app: App::Js(Bundle::source(bundle.code)),
        viewport: Size::new(px(480.0), px(960.0)),
        trace: false,
        network: None,
        websocket: None,
        filesystem: None,
        assets: None,
        environment: Environment::default(),
        header_heights: nsh_core::NO_NATIVE_HEADER,
        limits: nsh_engine::Limits::default(),
        ui_sets: Vec::new(),
        runtime: None,
        data_dir: None,
        storage: None,
        clock: Clock::default(),
        pinned: EnvironmentPins::default(),
        clipboard: None,
    };
    (
        Engine::start(config, || ApproxTextEngine, ChannelSink(tx))
            .expect("fixture engine should start"),
        rx,
    )
}

fn changes(
    rx: &Receiver<MountBatch>,
    names: &mut HashMap<u32, String>,
    wanted: &str,
    expected_native: usize,
) -> (bool, HashMap<String, String>) {
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut tsx = false;
    let mut native = HashMap::new();
    while Instant::now() < deadline && (!tsx || native.len() < expected_native) {
        let Ok(batch) = rx.recv_timeout(Duration::from_millis(300)) else {
            continue;
        };
        for item in batch.items {
            match item {
                MountItem::Component { id, name } => {
                    names.insert(id, name.to_string());
                }
                MountItem::ComponentProps { id, props } => {
                    let Some(name) = names.get(&id) else { continue };
                    for (key, value) in props {
                        if matches!(
                            (name.as_str(), key.as_ref()),
                            ("vela.desktopButton", "accent")
                                | ("vela/symbol" | "vela/switch", "tint")
                        ) && value
                            .as_ref()
                            .and_then(JsonValue::as_str)
                            .is_some_and(|value| value.eq_ignore_ascii_case(wanted))
                        {
                            native.insert(name.clone(), wanted.to_owned());
                        }
                    }
                }
                MountItem::ViewStyle { style, .. }
                    if style.background_color == Color(0x12ab_34ff) =>
                {
                    tsx = true;
                }
                _ => {}
            }
        }
    }
    (tsx, native)
}

#[test]
fn host_theme_override_updates_tsx_and_native_control_props() {
    for (entry, expected) in [
        (macos_fixture(), ["vela.desktopButton"].as_slice()),
        (ios_fixture(), ["vela/switch", "vela/symbol"].as_slice()),
    ] {
        let (engine, rx) = start(entry);
        let mut names = HashMap::new();
        // Drain the first frame and retain native component identities.
        let _ = changes(&rx, &mut names, "#000000", expected.len());

        let theme = Theme::from_json(r##"{"cssVars":{"light":{"accent":"#12AB34"}}}"##)
            .expect("override theme should parse");
        engine.control().set_tokens(Some(theme.into_tokens()));

        let (tsx, native) = changes(&rx, &mut names, "#12ab34ff", expected.len());
        assert!(tsx, "a TSX bg-accent view must receive the host override");
        assert_eq!(
            native
                .keys()
                .map(String::as_str)
                .collect::<std::collections::BTreeSet<_>>(),
            expected.iter().copied().collect(),
            "native control props must receive the same override",
        );
    }
}
