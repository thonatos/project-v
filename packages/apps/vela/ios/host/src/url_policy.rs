//! URL boundary shared by the iOS `WebView` and host-side unit tests.

use url::{Host, Url};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(not(any(target_os = "ios", test)), allow(dead_code))]
pub(crate) enum NavigationPolicy {
    Allow,
    OpenExternal,
    Block,
}

/// Vela's `WebView` may only load the exact loopback hosts Core returns.
#[cfg_attr(not(any(target_os = "ios", test)), allow(dead_code))]
pub(crate) fn loopback_http(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    if url.scheme() != "http" || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    match url.host() {
        Some(Host::Domain(host)) => host.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback() && address.octets() == [127, 0, 0, 1],
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

/// Top-level pages stay on Core's loopback mapping. HTTPS authentication is
/// handed to the system browser/session; other destinations are rejected.
#[cfg_attr(not(any(target_os = "ios", test)), allow(dead_code))]
pub(crate) fn navigation_policy(raw: &str) -> NavigationPolicy {
    if raw.is_empty() || raw == "about:blank" {
        return NavigationPolicy::Allow;
    }
    if loopback_http(raw) {
        return NavigationPolicy::Allow;
    }
    let Ok(url) = Url::parse(raw) else {
        return NavigationPolicy::Block;
    };
    if url.scheme() == "https"
        && url.host().is_some()
        && url.username().is_empty()
        && url.password().is_none()
    {
        NavigationPolicy::OpenExternal
    } else {
        NavigationPolicy::Block
    }
}

#[cfg(test)]
mod tests {
    use super::{NavigationPolicy, loopback_http, navigation_policy};

    #[test]
    fn accepts_only_loopback_http_mappings() {
        for valid in [
            "http://localhost:43100/",
            "http://127.0.0.1:43100/x",
            "http://[::1]:43100/",
        ] {
            assert!(loopback_http(valid), "{valid}");
        }
        for invalid in [
            "https://localhost:43100/",
            "http://localhost.evil.test/",
            "http://127.0.0.2/",
            "http://localhost@evil.test/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "not a url",
        ] {
            assert!(!loopback_http(invalid), "{invalid}");
        }
    }

    #[test]
    fn navigation_keeps_services_local_and_hands_https_authentication_out() {
        assert_eq!(
            navigation_policy("http://127.0.0.1:43100/app"),
            NavigationPolicy::Allow
        );
        assert_eq!(navigation_policy("about:blank"), NavigationPolicy::Allow);
        assert_eq!(
            navigation_policy("https://accounts.example.test/oauth"),
            NavigationPolicy::OpenExternal
        );
        for blocked in [
            "http://accounts.example.test/oauth",
            "https://trusted.test@evil.test/",
            "custom-auth://callback",
            "javascript:alert(1)",
        ] {
            assert_eq!(
                navigation_policy(blocked),
                NavigationPolicy::Block,
                "{blocked}"
            );
        }
    }
}
