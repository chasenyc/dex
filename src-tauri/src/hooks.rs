// Tauri commands require owned types for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

const HOOK_URL: &str = "http://127.0.0.1:7878/hook";

fn claude_settings_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let dir = PathBuf::from(home).join(".claude");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create .claude dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

fn make_hook_entry(matcher: &str) -> Value {
    json!({
        "matcher": matcher,
        "hooks": [{
            "type": "http",
            "url": HOOK_URL,
            "timeout": 5
        }]
    })
}

fn is_termaude_hook(entry: &Value) -> bool {
    if let Some(hooks) = entry.get("hooks").and_then(|h| h.as_array()) {
        hooks.iter().any(|h| {
            h.get("url")
                .and_then(|u| u.as_str())
                .is_some_and(|u| u.contains("127.0.0.1:7878"))
        })
    } else {
        false
    }
}

/// Events and their matchers that Termaude needs
fn required_hooks() -> Vec<(&'static str, &'static str)> {
    vec![
        ("UserPromptSubmit", ""),
        ("PreToolUse", ".*"),
        ("PostToolUse", ".*"),
        ("Stop", ""),
        ("Notification", "idle_prompt"),
        ("Notification", "permission_prompt"),
        ("PermissionRequest", ".*"),
        ("StopFailure", ""),
        ("SessionEnd", ""),
        ("SessionStart", ""),
    ]
}

#[tauri::command]
pub fn install_hooks() -> Result<String, String> {
    let path = claude_settings_path()?;

    // Read existing settings
    let mut settings: Value = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
        serde_json::from_str(&content).map_err(|e| format!("parse error: {e}"))?
    } else {
        json!({})
    };

    // Backup before modifying
    if path.exists() {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let backup = path.with_extension(format!("json.bak.{timestamp}"));
        fs::copy(&path, &backup).map_err(|e| format!("backup error: {e}"))?;
    }

    // Ensure hooks object exists
    if settings.get("hooks").is_none() {
        settings["hooks"] = json!({});
    }

    let mut added = 0;
    for (event, matcher) in required_hooks() {
        let hooks_obj = settings["hooks"]
            .as_object_mut()
            .ok_or("hooks is not an object")?;

        let event_array = hooks_obj
            .entry(event)
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or(format!("hooks.{event} is not an array"))?;

        // Check if we already have this exact hook (same event + matcher)
        let already_exists = event_array.iter().any(|entry| {
            is_termaude_hook(entry)
                && entry.get("matcher").and_then(|m| m.as_str()).unwrap_or("") == matcher
        });

        if !already_exists {
            event_array.push(make_hook_entry(matcher));
            added += 1;
        }
    }

    // Atomic write
    let json_str =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("serialize error: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &json_str).map_err(|e| format!("write error: {e}"))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("rename error: {e}"))?;

    if added > 0 {
        Ok(format!(
            "Installed {added} hooks. Restart running Claude sessions to activate."
        ))
    } else {
        Ok("Hooks already installed.".to_string())
    }
}

#[tauri::command]
pub fn uninstall_hooks() -> Result<String, String> {
    let path = claude_settings_path()?;

    if !path.exists() {
        return Ok("No settings file found.".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
    let mut settings: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse error: {e}"))?;

    let Some(hooks_obj) = settings.get_mut("hooks").and_then(|h| h.as_object_mut()) else {
        return Ok("No hooks found.".to_string());
    };

    let mut removed = 0;
    let events: Vec<String> = hooks_obj.keys().cloned().collect();
    for event in &events {
        if let Some(arr) = hooks_obj.get_mut(event).and_then(|v| v.as_array_mut()) {
            let before = arr.len();
            arr.retain(|entry| !is_termaude_hook(entry));
            removed += before - arr.len();
        }
    }

    // Clean up empty arrays
    let empty_events: Vec<String> = hooks_obj
        .iter()
        .filter(|(_, v)| v.as_array().is_some_and(Vec::is_empty))
        .map(|(k, _)| k.clone())
        .collect();
    for event in &empty_events {
        hooks_obj.remove(event);
    }

    // Backup and atomic write
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = path.with_extension(format!("json.bak.{timestamp}"));
    fs::copy(&path, &backup).map_err(|e| format!("backup error: {e}"))?;

    let json_str =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("serialize error: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &json_str).map_err(|e| format!("write error: {e}"))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("rename error: {e}"))?;

    if removed > 0 {
        Ok(format!("Removed {removed} hooks."))
    } else {
        Ok("No Termaude hooks found.".to_string())
    }
}

#[tauri::command]
pub fn check_hooks_status() -> Result<bool, String> {
    let path = claude_settings_path()?;

    if !path.exists() {
        return Ok(false);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
    let settings: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse error: {e}"))?;

    let Some(hooks_obj) = settings.get("hooks").and_then(|h| h.as_object()) else {
        return Ok(false);
    };

    let has_stop = hooks_obj
        .get("Stop")
        .and_then(|v| v.as_array())
        .is_some_and(|arr| arr.iter().any(is_termaude_hook));

    Ok(has_stop)
}
