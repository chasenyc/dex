// Tauri commands require owned types for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub default_folder: Option<String>,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to get app data dir: {e}"))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("failed to create data dir: {e}"))?;
    Ok(data_dir.join("settings.json"))
}

#[tauri::command]
pub fn get_default_folder(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
        let settings: AppSettings =
            serde_json::from_str(&content).map_err(|e| format!("parse error: {e}"))?;
        Ok(settings.default_folder)
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn set_default_folder(app: AppHandle, folder: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppSettings::default()
    };
    settings.default_folder = Some(folder);
    let json =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("serialize error: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("write error: {e}"))?;
    Ok(())
}
