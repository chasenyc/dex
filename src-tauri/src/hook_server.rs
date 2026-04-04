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
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StateUpdate {
    pub session_id: String,
    pub state: String,
    pub event: String,
    pub timestamp: u64,
}

fn map_event_to_state(event: &HookEvent) -> Option<&'static str> {
    let event_name = event.event_name.as_deref()?;
    match event_name {
        "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "SessionStart" => Some("working"),
        "Stop" => Some("waiting"),
        "Notification" => {
            // Distinguish permission_prompt from idle_prompt
            match event.notification_type.as_deref() {
                Some("permission_prompt") => Some("permission"),
                _ => Some("waiting"),
            }
        }
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
        let Ok(server) = tiny_http::Server::http(LISTEN_ADDR) else {
            log::error!("Failed to start hook server on {LISTEN_ADDR}");
            return;
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
                log::info!(
                    "Hook event: session={} event={} body={}",
                    event.session_id.as_deref().unwrap_or("none"),
                    event.event_name.as_deref().unwrap_or("none"),
                    &body[..body.len().min(500)]
                );
                if let (Some(session_id), Some(event_name)) = (&event.session_id, &event.event_name)
                {
                    if let Some(state) = map_event_to_state(&event) {
                        let update = StateUpdate {
                            session_id: session_id.clone(),
                            state: state.to_string(),
                            event: event_name.clone(),
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
