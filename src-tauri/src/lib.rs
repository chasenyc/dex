mod commands;
mod git_status;
mod hook_server;
mod hooks;
mod persistence;
mod project_index;
mod pty;

use pty::PtyManager;

/// Start the Tauri application.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialize.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_session,
            commands::write_to_session,
            commands::resize_session,
            commands::close_session,
            persistence::load_registry,
            persistence::save_registry,
            project_index::scan_projects,
            project_index::load_project_index,
            project_index::check_directory_exists,
            hooks::install_hooks,
            hooks::uninstall_hooks,
            hooks::check_hooks_status,
            git_status::get_git_info,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start the hook HTTP server for real-time Claude state updates
            hook_server::start(app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
