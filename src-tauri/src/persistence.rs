// Tauri commands require owned types for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to get app data dir: {e}"))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("failed to create data dir: {e}"))?;
    Ok(data_dir.join("sessions.json"))
}

#[tauri::command]
pub fn load_registry(app: AppHandle) -> Result<String, String> {
    let path = registry_path(&app)?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("failed to read registry: {e}"))
    } else {
        Ok("null".to_string())
    }
}

#[tauri::command]
pub fn save_registry(app: AppHandle, data: String) -> Result<(), String> {
    let path = registry_path(&app)?;
    fs::write(&path, data).map_err(|e| format!("failed to write registry: {e}"))
}
