use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let explicit_bundle = args.next().map(PathBuf::from);
    let executable = std::env::current_exe().unwrap_or_default();
    let contents = executable
        .parent()
        .and_then(std::path::Path::parent)
        .map(PathBuf::from);
    let bundle = explicit_bundle.or_else(|| {
        contents
            .as_ref()
            .map(|path| path.join("Resources/nsh/bundle.nshc"))
    });
    let Some(bundle) = bundle else {
        eprintln!("Vela cannot locate its application bundle");
        std::process::exit(2);
    };
    let assets = args.next().map(PathBuf::from).or_else(|| {
        contents
            .as_ref()
            .map(|path| path.join("Resources/nsh/assets"))
    });
    let core = args
        .next()
        .map(PathBuf::from)
        .or_else(|| contents.as_ref().map(|path| path.join("Helpers/vela-core")));
    if let Err(error) = vela_host::runner::run(&vela_host::runner::RunnerOptions {
        bundle: &bundle,
        assets: assets.as_deref().filter(|path| path.exists()),
        size: (480, 960),
        core: core.as_deref().filter(|path| path.exists()),
    }) {
        eprintln!("Vela failed: {error}");
        std::process::exit(1);
    }
}
