//! Versioned JSON Lines messages exchanged with `vela-core`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

/// Current control protocol version.
pub const VERSION: u16 = 1;

/// A single JSON Lines message. Business payloads are decoded by the owner of
/// each message type after this envelope has been validated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub version: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub payload: Value,
}

/// A stable error payload returned over the control channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

/// Envelope validation failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtocolError {
    InvalidJson(String),
    UnsupportedVersion(u16),
    UnsupportedMessage(String),
    MissingRequestId(String),
}

impl fmt::Display for ProtocolError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(message) => write!(formatter, "invalid JSON: {message}"),
            Self::UnsupportedVersion(version) => {
                write!(formatter, "unsupported protocol version: {version}")
            }
            Self::UnsupportedMessage(kind) => write!(formatter, "unsupported message type: {kind}"),
            Self::MissingRequestId(kind) => write!(formatter, "message {kind} requires an id"),
        }
    }
}

impl std::error::Error for ProtocolError {}

/// Decodes and validates exactly one JSON Lines record.
///
/// # Errors
///
/// Returns [`ProtocolError`] when JSON is malformed, the version or message
/// type is unsupported, or a correlated message has no request ID.
pub fn decode_line(line: &str) -> Result<Message, ProtocolError> {
    let message: Message = serde_json::from_str(line)
        .map_err(|error| ProtocolError::InvalidJson(error.to_string()))?;
    validate(&message)?;
    Ok(message)
}

/// Serializes one message without a trailing newline.
///
/// # Errors
///
/// Returns [`ProtocolError`] when the message envelope is invalid or cannot be
/// represented as JSON.
pub fn encode_line(message: &Message) -> Result<String, ProtocolError> {
    validate(message)?;
    serde_json::to_string(message).map_err(|error| ProtocolError::InvalidJson(error.to_string()))
}

fn validate(message: &Message) -> Result<(), ProtocolError> {
    if message.version != VERSION {
        return Err(ProtocolError::UnsupportedVersion(message.version));
    }
    if !KNOWN_TYPES.contains(&message.kind.as_str()) {
        return Err(ProtocolError::UnsupportedMessage(message.kind.clone()));
    }
    if requires_id(&message.kind) && message.id.as_deref().is_none_or(str::is_empty) {
        return Err(ProtocolError::MissingRequestId(message.kind.clone()));
    }
    Ok(())
}

fn requires_id(kind: &str) -> bool {
    !kind.starts_with("event.") && kind != "stopped" && kind != "error"
}

/// Complete v1 envelope vocabulary. Adding a type requires fixtures in both
/// language implementations.
pub const KNOWN_TYPES: &[&str] = &[
    "status.get",
    "status",
    "events.subscribe",
    "events.subscribed",
    "event.network",
    "event.service",
    "event.remote",
    "event.mapping",
    "auth.start",
    "auth.reconnect",
    "auth.logout",
    "auth.url",
    "sharing.get",
    "sharing.update",
    "sharing",
    "services.refresh",
    "services",
    "device.update",
    "service.upsert",
    "service.remove",
    "remote.add",
    "remote.remove",
    "remote.refresh",
    "remotes",
    "mapping.open",
    "mapping.close",
    "mapping",
    "preferences.update",
    "preferences",
    "diagnostics.logs",
    "diagnostics.activity",
    "shutdown",
    "stopped",
    "error",
];

#[cfg(test)]
mod tests {
    use super::{ProtocolError, decode_line, encode_line};
    use std::{fs, path::PathBuf};

    fn fixture(name: &str) -> String {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../protocol/fixtures")
            .join(name);
        fs::read_to_string(path).expect("fixture should be readable")
    }

    #[test]
    fn accepts_and_round_trips_shared_valid_fixtures() {
        for line in fixture("valid-v1.jsonl").lines() {
            let decoded = decode_line(line).expect("fixture should decode");
            let encoded = encode_line(&decoded).expect("fixture should encode");
            assert_eq!(decode_line(&encoded).unwrap(), decoded);
        }
    }

    #[test]
    fn rejects_shared_invalid_fixtures() {
        let version = decode_line(fixture("invalid-version.jsonl").trim()).unwrap_err();
        assert_eq!(version, ProtocolError::UnsupportedVersion(2));

        let kind = decode_line(fixture("invalid-type.jsonl").trim()).unwrap_err();
        assert_eq!(
            kind,
            ProtocolError::UnsupportedMessage("unknown.command".into())
        );
    }

    #[test]
    fn vocabulary_matches_the_go_core() {
        let path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../core/internal/protocol/protocol.go");
        let source = fs::read_to_string(path).expect("core protocol should be readable");
        let table = source
            .split_once("var knownTypes = map[string]struct{}{")
            .expect("core must declare its vocabulary")
            .1
            .split_once("\n}")
            .expect("core vocabulary must be terminated")
            .0;
        for kind in super::KNOWN_TYPES {
            assert!(
                table.contains(&format!("\"{kind}\"")),
                "the Go core must accept {kind}"
            );
        }
        for kind in [
            "preferences.update",
            "diagnostics.logs",
            "diagnostics.activity",
        ] {
            assert!(
                super::KNOWN_TYPES.contains(&kind),
                "the Rust host must accept {kind}"
            );
        }
    }
}
