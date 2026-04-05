// Tauri commands require owned types (String, Vec<u8>) for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use crate::pty::{PtyError, PtyManager};
use tauri::State;

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn create_session(
    id: String,
    cwd: Option<String>,
    command: Option<String>,
    session_id: Option<String>,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
    app: tauri::AppHandle,
) -> Result<(), PtyError> {
    manager.create_session(
        &id,
        cwd.as_deref(),
        command.as_deref(),
        session_id.as_deref(),
        cols,
        rows,
        &app,
    )
}

#[tauri::command]
pub fn write_to_session(
    id: String,
    data: Vec<u8>,
    manager: State<'_, PtyManager>,
) -> Result<(), PtyError> {
    manager.write_to_session(&id, &data)
}

#[tauri::command]
pub fn resize_session(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
) -> Result<(), PtyError> {
    manager.resize_session(&id, cols, rows)
}

#[tauri::command]
pub fn close_session(id: String, manager: State<'_, PtyManager>) -> Result<(), PtyError> {
    manager.close_session(&id)
}
