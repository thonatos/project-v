//! Process supervision and request correlation for `vela-core`.

use crate::protocol::{Message, ProtocolError, VERSION, decode_line, encode_line};
use serde_json::{Map, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        mpsc::{self, Receiver, Sender},
    },
    thread,
    time::{Duration, Instant},
};

/// Observable supervisor lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Stopped,
    Starting,
    Running,
    Backoff,
    ShuttingDown,
    Terminated,
    RestartExhausted,
}

/// Child launch and restart policy.
#[derive(Debug, Clone)]
pub struct Config {
    pub program: String,
    pub args: Vec<String>,
    pub max_restarts: usize,
    pub base_backoff: Duration,
    pub request_timeout: Duration,
    pub disable_tailscale_proxy: bool,
}

impl Config {
    #[must_use]
    pub fn bundled(program: String) -> Self {
        let disable_tailscale_proxy = !saved_tailscale_proxy();
        Self {
            program,
            args: Vec::new(),
            max_restarts: 3,
            base_backoff: Duration::from_millis(100),
            request_timeout: Duration::from_secs(5),
            disable_tailscale_proxy,
        }
    }
}

/// Supervises one Core process and multiplexes its protocol output.
pub struct Supervisor {
    config: Config,
    state: Mutex<State>,
    child: Mutex<Option<Child>>,
    writer: Mutex<Option<ChildStdin>>,
    pending: Mutex<HashMap<String, Sender<Message>>>,
    subscribers: Mutex<Vec<Sender<Message>>>,
    generation: AtomicU64,
    next_id: AtomicU64,
    restart_attempts: AtomicUsize,
    shutting_down: AtomicBool,
}

impl Supervisor {
    #[must_use]
    pub fn new(config: Config) -> Arc<Self> {
        Arc::new(Self {
            config,
            state: Mutex::new(State::Stopped),
            child: Mutex::new(None),
            writer: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            subscribers: Mutex::new(Vec::new()),
            generation: AtomicU64::new(0),
            next_id: AtomicU64::new(1),
            restart_attempts: AtomicUsize::new(0),
            shutting_down: AtomicBool::new(false),
        })
    }

    /// Starts the child once.
    ///
    /// # Errors
    ///
    /// Returns an error when the executable cannot be spawned or its pipes are unavailable.
    pub fn start(self: &Arc<Self>) -> Result<(), String> {
        self.start_child(false)
    }

    fn start_child(self: &Arc<Self>, restarting: bool) -> Result<(), String> {
        if self.shutting_down.load(Ordering::Acquire) {
            return Err("supervisor is shutting down".into());
        }
        *self.state.lock().unwrap() = State::Starting;
        let mut command = Command::new(&self.config.program);
        command
            .args(&self.config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if self.config.disable_tailscale_proxy {
            command.env(
                "TS_DISABLE_FEATURE",
                disabled_features(std::env::var("TS_DISABLE_FEATURE").ok().as_deref()),
            );
        }
        let mut child = command.spawn().map_err(|error| {
            *self.state.lock().unwrap() = State::Stopped;
            format!("start vela-core: {error}")
        })?;
        let stdin = child.stdin.take().ok_or("vela-core stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("vela-core stdout unavailable")?;
        let stderr = child.stderr.take().ok_or("vela-core stderr unavailable")?;
        let generation = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        *self.writer.lock().unwrap() = Some(stdin);
        *self.child.lock().unwrap() = Some(child);
        *self.state.lock().unwrap() = State::Running;
        if !restarting {
            self.restart_attempts.store(0, Ordering::Release);
        }

        let supervisor = Arc::clone(self);
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                match line {
                    Ok(line) => supervisor.receive_line(&line),
                    Err(_) => break,
                }
            }
            supervisor.child_ended(generation);
        });
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("vela-core: {line}");
            }
        });
        Ok(())
    }

    fn receive_line(&self, line: &str) {
        let Ok(message) = decode_line(line) else {
            return;
        };
        if let Some(id) = &message.id
            && let Some(sender) = self.pending.lock().unwrap().remove(id)
        {
            let _ = sender.send(message);
            return;
        }
        let mut subscribers = self.subscribers.lock().unwrap();
        subscribers.retain(|sender| sender.send(message.clone()).is_ok());
    }

    fn child_ended(self: &Arc<Self>, generation: u64) {
        if self.generation.load(Ordering::Acquire) != generation {
            return;
        }
        self.writer.lock().unwrap().take();
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.wait();
        }
        self.fail_pending("vela-core exited");
        if self.shutting_down.load(Ordering::Acquire) {
            *self.state.lock().unwrap() = State::Terminated;
            return;
        }
        let attempt = self.restart_attempts.fetch_add(1, Ordering::AcqRel) + 1;
        if attempt > self.config.max_restarts {
            *self.state.lock().unwrap() = State::RestartExhausted;
            return;
        }
        *self.state.lock().unwrap() = State::Backoff;
        let shift = u32::try_from(attempt.saturating_sub(1))
            .unwrap_or(u32::MAX)
            .min(8);
        thread::sleep(self.config.base_backoff.saturating_mul(1_u32 << shift));
        if self.start_child(true).is_err() && attempt >= self.config.max_restarts {
            *self.state.lock().unwrap() = State::RestartExhausted;
        }
    }

    /// Sends a correlated request and waits for its response.
    ///
    /// # Errors
    ///
    /// Returns an error when Core is not running, writing fails, the response times out,
    /// or Core returns malformed protocol output.
    ///
    /// # Panics
    ///
    /// Panics only if an internal mutex was poisoned by a prior panic.
    pub fn request(&self, kind: &str, payload: Value) -> Result<Message, String> {
        if self.state() != State::Running {
            return Err("vela-core is not running".into());
        }
        let id = format!("rust-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let message = Message {
            version: VERSION,
            id: Some(id.clone()),
            kind: kind.to_owned(),
            payload,
        };
        let line = encode_line(&message).map_err(|error| protocol_error(&error))?;
        let (sender, receiver) = mpsc::channel();
        self.pending.lock().unwrap().insert(id.clone(), sender);
        let write_result = self
            .writer
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| "vela-core stdin is unavailable".to_owned())
            .and_then(|writer| {
                writeln!(writer, "{line}")
                    .and_then(|()| writer.flush())
                    .map_err(|error| format!("write vela-core request: {error}"))
            });
        if let Err(error) = write_result {
            self.pending.lock().unwrap().remove(&id);
            return Err(error);
        }
        receiver
            .recv_timeout(self.config.request_timeout)
            .map_err(|error| {
                self.pending.lock().unwrap().remove(&id);
                format!("wait for vela-core response: {error}")
            })
    }

    /// Subscribes to asynchronous messages without stealing correlated responses.
    ///
    /// # Panics
    ///
    /// Panics only if the subscriber mutex was poisoned by a prior panic.
    #[must_use]
    pub fn subscribe(&self) -> Receiver<Message> {
        let (sender, receiver) = mpsc::channel();
        self.subscribers.lock().unwrap().push(sender);
        receiver
    }

    /// Performs bounded graceful shutdown, then kills a stuck helper.
    ///
    /// # Panics
    ///
    /// Panics only if an internal mutex was poisoned by a prior panic.
    pub fn shutdown(&self, timeout: Duration) {
        self.shutting_down.store(true, Ordering::Release);
        *self.state.lock().unwrap() = State::ShuttingDown;
        let message = Message {
            version: VERSION,
            id: Some("rust-shutdown".into()),
            kind: "shutdown".into(),
            payload: Value::Object(Map::default()),
        };
        if let Ok(line) = encode_line(&message)
            && let Some(writer) = self.writer.lock().unwrap().as_mut()
        {
            let _ = writeln!(writer, "{line}");
            let _ = writer.flush();
        }
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if self.state() == State::Terminated {
                return;
            }
            thread::sleep(Duration::from_millis(10));
        }
        if let Some(child) = self.child.lock().unwrap().as_mut() {
            let _ = child.kill();
        }
    }

    /// # Panics
    ///
    /// Panics only if the state mutex was poisoned by a prior panic.
    #[must_use]
    pub fn state(&self) -> State {
        *self.state.lock().unwrap()
    }

    #[must_use]
    pub fn restart_attempts(&self) -> usize {
        self.restart_attempts.load(Ordering::Acquire)
    }

    /// Returns the currently supervised child PID.
    ///
    /// # Panics
    ///
    /// Panics only if the child mutex was poisoned by a prior panic.
    #[must_use]
    pub fn pid(&self) -> Option<u32> {
        self.child.lock().unwrap().as_ref().map(Child::id)
    }

    #[must_use]
    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }

    fn fail_pending(&self, message: &str) {
        let pending = std::mem::take(&mut *self.pending.lock().unwrap());
        for (id, sender) in pending {
            let _ = sender.send(Message {
                version: VERSION,
                id: Some(id),
                kind: "error".into(),
                payload: serde_json::json!({"code":"core_exited","message":message,"retryable":true}),
            });
        }
    }
}

fn saved_tailscale_proxy() -> bool {
    let Some(home) = std::env::var_os("HOME") else {
        return true;
    };
    let path = std::path::PathBuf::from(home).join("Library/Application Support/Vela/config.json");
    std::fs::read_to_string(path)
        .ok()
        .is_none_or(|contents| tailscale_proxy_from_config(&contents))
}

fn tailscale_proxy_from_config(contents: &str) -> bool {
    serde_json::from_str::<Value>(contents)
        .ok()
        .and_then(|value| {
            value
                .pointer("/preferences/tailscaleProxy")
                .and_then(Value::as_bool)
        })
        .unwrap_or(true)
}

fn disabled_features(existing: Option<&str>) -> String {
    let mut features: Vec<&str> = existing
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .collect();
    if !features.contains(&"useproxy") {
        features.push("useproxy");
    }
    features.join(",")
}

fn protocol_error(error: &ProtocolError) -> String {
    error.to_string()
}

fn bridge_response(response: &Message) -> Result<String, String> {
    if response.kind == "error" {
        let code = response.payload["code"].as_str().unwrap_or("core_error");
        let message = response.payload["message"]
            .as_str()
            .unwrap_or("vela-core request failed");
        return Err(format!("{code}: {message}"));
    }
    serde_json::to_string(&response).map_err(|error| error.to_string())
}

struct GlobalState {
    supervisor: Arc<Supervisor>,
    events: Mutex<Receiver<Message>>,
}

static GLOBAL: OnceLock<GlobalState> = OnceLock::new();

/// The process-global supervisor the NSH module uses.
///
/// One `OnceLock` owns both the supervisor and its event receiver, so a failed
/// start can never leave the pair half-initialized.
pub struct Global;

impl Global {
    /// Starts the process-global supervisor.
    ///
    /// # Errors
    ///
    /// Returns an error when the helper cannot start or global state was
    /// initialized inconsistently.
    pub fn start(path: String) -> Result<(), String> {
        if GLOBAL.get().is_some() {
            return Ok(());
        }
        let supervisor = Supervisor::new(Config::bundled(path));
        supervisor.start()?;
        let events = supervisor.subscribe();
        GLOBAL
            .set(GlobalState {
                supervisor,
                events: Mutex::new(events),
            })
            .map_err(|_| "supervisor already initialized".to_owned())
    }

    /// Sends a request through the process-global supervisor.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid payload JSON, missing supervisor state,
    /// transport failures or response encoding.
    pub fn request(kind: &str, payload: &str) -> Result<String, String> {
        let payload: Value = serde_json::from_str(payload)
            .map_err(|error| format!("invalid payload JSON: {error}"))?;
        let response = GLOBAL
            .get()
            .ok_or("vela-core has not started")?
            .supervisor
            .request(kind, payload)?;
        bridge_response(&response)
    }

    /// Drains queued Core events as a JSON array.
    ///
    /// # Panics
    ///
    /// Panics only if the event receiver mutex was poisoned by a prior panic.
    #[must_use]
    pub fn drain_events() -> String {
        let Some(state) = GLOBAL.get() else {
            return "[]".into();
        };
        let messages: Vec<_> = state.events.lock().unwrap().try_iter().collect();
        serde_json::to_string(&messages).unwrap_or_else(|_| "[]".into())
    }

    /// Returns the global helper identity for lifecycle diagnostics.
    #[must_use]
    pub fn identity() -> Option<(u32, u64)> {
        GLOBAL.get().and_then(|state| {
            state
                .supervisor
                .pid()
                .map(|pid| (pid, state.supervisor.generation()))
        })
    }

    /// Shuts down the global Core within the supplied bound.
    pub fn shutdown(timeout: Duration) {
        if let Some(state) = GLOBAL.get() {
            state.supervisor.shutdown(timeout);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Config, Message, State, Supervisor, VERSION, bridge_response};
    use serde_json::json;
    use std::{
        fs,
        process::Command,
        thread,
        time::{Duration, SystemTime},
    };

    fn shell(script: &str, max_restarts: usize) -> std::sync::Arc<Supervisor> {
        Supervisor::new(Config {
            program: "/bin/sh".into(),
            args: vec!["-c".into(), script.into()],
            max_restarts,
            base_backoff: Duration::from_millis(10),
            request_timeout: Duration::from_secs(1),
            disable_tailscale_proxy: false,
        })
    }

    #[test]
    fn tailscale_proxy_setting_only_adds_the_useproxy_feature() {
        assert!(super::tailscale_proxy_from_config("{}"));
        assert!(super::tailscale_proxy_from_config(
            r#"{"preferences":{"tailscaleProxy":true}}"#
        ));
        assert!(!super::tailscale_proxy_from_config(
            r#"{"preferences":{"tailscaleProxy":false}}"#
        ));
        assert_eq!(super::disabled_features(None), "useproxy");
        assert_eq!(
            super::disabled_features(Some("ssh, taildrop")),
            "ssh,taildrop,useproxy"
        );
        assert_eq!(super::disabled_features(Some("useproxy")), "useproxy");
    }

    #[test]
    fn disabled_proxy_reaches_the_child_environment() {
        let supervisor = Supervisor::new(Config {
            program: "/bin/sh".into(),
            args: vec![
                "-c".into(),
                r#"read line
printf '%s\n' '{"version":1,"id":"rust-1","type":"status","payload":{"disabled":"'"$TS_DISABLE_FEATURE"'"}}'"#.into(),
            ],
            max_restarts: 0,
            base_backoff: Duration::ZERO,
            request_timeout: Duration::from_secs(1),
            disable_tailscale_proxy: true,
        });
        supervisor.start().unwrap();
        let response = supervisor.request("status.get", json!({})).unwrap();
        assert!(
            response.payload["disabled"]
                .as_str()
                .unwrap()
                .split(',')
                .any(|item| item == "useproxy")
        );
        supervisor.shutdown(Duration::from_secs(1));
    }

    #[test]
    fn correlates_responses_and_distributes_events() {
        let script = r#"
while IFS= read -r line; do
  id=$(printf "%s" "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  case "$line" in
    *status.get*)
      printf '%s\n' '{"version":1,"type":"event.network","payload":{"state":"connected"}}'
      printf '{"version":1,"id":"%s","type":"status","payload":{"network":"connected"}}\n' "$id"
      ;;
    *shutdown*) printf '%s\n' '{"version":1,"type":"stopped","payload":{}}'; exit 0 ;;
  esac
done
"#;
        let supervisor = shell(script, 0);
        let events = supervisor.subscribe();
        supervisor.start().unwrap();
        let response = supervisor.request("status.get", json!({})).unwrap();
        assert_eq!(response.kind, "status");
        assert_eq!(
            events.recv_timeout(Duration::from_secs(1)).unwrap().kind,
            "event.network"
        );
        supervisor.shutdown(Duration::from_secs(1));
        wait_for(&supervisor, State::Terminated);
    }

    #[test]
    fn bridge_rejects_structured_core_errors() {
        let error = bridge_response(&Message {
            version: VERSION,
            id: Some("request-1".into()),
            kind: "error".into(),
            payload: json!({"code":"remote_failed","message":"remote Mac is offline","retryable":false}),
        })
        .unwrap_err();
        assert_eq!(error, "remote_failed: remote Mac is offline");
    }

    #[test]
    fn eof_restarts_with_backoff_until_exhausted() {
        let supervisor = shell("exit 1", 2);
        supervisor.start().unwrap();
        wait_for(&supervisor, State::RestartExhausted);
        assert_eq!(supervisor.restart_attempts(), 3);
    }

    #[test]
    fn shutdown_never_restarts() {
        let script =
            r#"while IFS= read -r line; do case "$line" in *shutdown*) exit 0;; esac; done"#;
        let supervisor = shell(script, 5);
        supervisor.start().unwrap();
        supervisor.shutdown(Duration::from_secs(1));
        wait_for(&supervisor, State::Terminated);
        let attempts = supervisor.restart_attempts();
        thread::sleep(Duration::from_millis(50));
        assert_eq!(supervisor.state(), State::Terminated);
        assert_eq!(supervisor.restart_attempts(), attempts);
    }

    #[test]
    fn production_go_core_rejects_unpublished_mapping_with_structured_error() {
        let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../.tmp/runtime")
            .join(format!("rust-go-{unique}"));
        fs::create_dir_all(&directory).unwrap();
        let binary = directory.join("vela-core");
        let status = Command::new("go")
            .args(["build", "-o"])
            .arg(&binary)
            .arg("./cmd/vela-core")
            .current_dir(root.join("../../core"))
            .status()
            .unwrap();
        assert!(status.success());

        let supervisor = Supervisor::new(Config {
            program: binary.to_string_lossy().into_owned(),
            args: Vec::new(),
            max_restarts: 0,
            base_backoff: Duration::ZERO,
            request_timeout: Duration::from_secs(3),
            disable_tailscale_proxy: false,
        });
        supervisor.start().unwrap();
        let rejected = supervisor
            .request(
                "mapping.open",
                json!({"device":"home.example.ts.net","service":"opencode"}),
            )
            .unwrap();
        assert_eq!(rejected.kind, "error");
        assert_eq!(rejected.payload["code"], "mapping_failed");

        supervisor.shutdown(Duration::from_secs(2));
        wait_for(&supervisor, State::Terminated);
        let _ = fs::remove_dir_all(directory);
    }

    fn wait_for(supervisor: &Supervisor, expected: State) {
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < deadline {
            if supervisor.state() == expected {
                return;
            }
            thread::sleep(Duration::from_millis(10));
        }
        panic!("state {:?}, expected {expected:?}", supervisor.state());
    }
}
