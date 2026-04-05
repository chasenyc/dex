use serde::{Deserialize, Serialize};
use std::thread;
use tauri::{AppHandle, Emitter};

const LISTEN_ADDR: &str = "127.0.0.1:7878";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEvent {
    pub session_id: Option<String>,
    #[serde(alias = "hook_event_name")]
    pub event_name: Option<String>,
    pub tool_name: Option<String>,
    pub notification_type: Option<String>,
    pub last_assistant_message: Option<String>,
    pub transcript_path: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StateUpdate {
    pub session_id: String,
    pub state: String,
    pub event: String,
    pub preview_lines: Vec<String>,
    pub cwd: Option<String>,
    pub timestamp: u64,
}

fn map_event_to_state(event: &HookEvent) -> Option<&'static str> {
    let event_name = event.event_name.as_deref()?;
    match event_name {
        "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "SessionStart" => Some("working"),
        "Stop" => Some("waiting"),
        "Notification" => match event.notification_type.as_deref() {
            Some("permission_prompt") => Some("permission"),
            _ => Some("waiting"),
        },
        "PermissionRequest" => Some("permission"),
        "StopFailure" => Some("error"),
        "SessionEnd" => Some("ended"),
        _ => None,
    }
}

#[allow(clippy::cast_possible_truncation)]
fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Start the hook HTTP server on a background thread.
/// Emits `hook-state-update` events to the frontend via Tauri.
pub fn start(app: AppHandle) {
    thread::spawn(move || {
        // Try to bind, retry once after 500ms if port is busy (old process exiting)
        let server = if let Ok(s) = tiny_http::Server::http(LISTEN_ADDR) {
            s
        } else {
            log::warn!("Port {LISTEN_ADDR} busy, retrying in 500ms...");
            thread::sleep(std::time::Duration::from_millis(500));
            let Ok(s) = tiny_http::Server::http(LISTEN_ADDR) else {
                log::error!("Failed to start hook server on {LISTEN_ADDR}");
                return;
            };
            s
        };

        log::info!("Hook server listening on {LISTEN_ADDR}");

        for mut request in server.incoming_requests() {
            if request.method() != &tiny_http::Method::Post {
                let response =
                    tiny_http::Response::from_string("{\"error\":\"method not allowed\"}")
                        .with_status_code(405);
                let _ = request.respond(response);
                continue;
            }

            let mut body = String::new();
            if std::io::Read::read_to_string(request.as_reader(), &mut body).is_err() {
                let response = tiny_http::Response::from_string("{\"error\":\"bad request\"}")
                    .with_status_code(400);
                let _ = request.respond(response);
                continue;
            }

            if let Ok(event) = serde_json::from_str::<HookEvent>(&body) {
                if let (Some(session_id), Some(event_name)) = (&event.session_id, &event.event_name)
                {
                    // ShellPwd is a custom event from our injected precmd hook
                    if event_name == "ShellPwd" {
                        let home = std::env::var("HOME").unwrap_or_default();
                        let cwd = event.cwd.as_deref().unwrap_or("~");
                        let display_cwd = if cwd.starts_with(&home) {
                            format!("~{}", &cwd[home.len()..])
                        } else {
                            cwd.to_string()
                        };
                        let update = StateUpdate {
                            session_id: session_id.clone(),
                            state: String::new(),
                            event: "ShellPwd".to_string(),
                            preview_lines: Vec::new(),
                            cwd: Some(display_cwd),
                            timestamp: now_millis(),
                        };
                        let _ = app.emit("hook-state-update", &update);
                    } else if let Some(state) = map_event_to_state(&event) {
                        let preview_lines = if let Some(msg) = &event.last_assistant_message {
                            msg.lines()
                                .rev()
                                .filter(|l| !l.trim().is_empty())
                                .take(3)
                                .collect::<Vec<_>>()
                                .into_iter()
                                .rev()
                                .map(|l| l.trim().to_string())
                                .collect()
                        } else {
                            Vec::new()
                        };

                        let update = StateUpdate {
                            session_id: session_id.clone(),
                            state: state.to_string(),
                            event: event_name.clone(),
                            preview_lines,
                            cwd: None,
                            timestamp: now_millis(),
                        };
                        let _ = app.emit("hook-state-update", &update);
                    }
                }
            }

            let response = tiny_http::Response::from_string("{}")
                .with_status_code(200)
                .with_header(
                    "Content-Type: application/json"
                        .parse::<tiny_http::Header>()
                        .expect("valid header"),
                );
            let _ = request.respond(response);
        }
    });
}
