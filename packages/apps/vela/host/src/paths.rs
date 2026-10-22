//! User-writable and bundle paths used by the macOS host.

use std::path::{Path, PathBuf};

/// Stable bundle identifier for `Vela.app`.
pub const BUNDLE_ID: &str = "io.implements.vela.macos";

/// Every path the running application may write.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WritablePaths {
    pub application_support: PathBuf,
    pub config: PathBuf,
    pub network_state: PathBuf,
    pub web_data: PathBuf,
    pub logs: PathBuf,
}

impl WritablePaths {
    /// Resolves Vela's writable directories from an explicit home directory.
    #[must_use]
    pub fn from_home(home: &Path) -> Self {
        let application_support = home.join("Library/Application Support/Vela");
        Self {
            config: application_support.join("config.json"),
            network_state: application_support.join("network"),
            web_data: application_support.join("web-data"),
            logs: home.join("Library/Logs/Vela"),
            application_support,
        }
    }

    /// Returns true when every writable path is outside the application bundle.
    #[must_use]
    pub fn is_outside_bundle(&self, bundle: &Path) -> bool {
        [
            &self.application_support,
            &self.config,
            &self.network_state,
            &self.web_data,
            &self.logs,
        ]
        .into_iter()
        .all(|path| !path.starts_with(bundle))
    }
}

#[cfg(test)]
mod tests {
    use super::{BUNDLE_ID, WritablePaths};
    use std::path::Path;

    #[test]
    fn writable_paths_never_use_the_app_bundle() {
        let bundle = Path::new("/Applications/Vela.app");
        let paths = WritablePaths::from_home(Path::new("/Users/tester"));

        assert!(paths.is_outside_bundle(bundle));
        assert_eq!(
            paths.config,
            Path::new("/Users/tester/Library/Application Support/Vela/config.json")
        );
        assert_eq!(paths.logs, Path::new("/Users/tester/Library/Logs/Vela"));
    }

    #[test]
    fn bundle_identifier_matches_nsh_metadata() {
        assert_eq!(BUNDLE_ID, "io.implements.vela.macos");
    }

    #[test]
    fn rejects_writable_paths_inside_bundle() {
        let bundle = Path::new("/Applications/Vela.app");
        let paths = WritablePaths::from_home(Path::new("/Applications/Vela.app/Contents"));
        assert!(!paths.is_outside_bundle(bundle));
    }
}
