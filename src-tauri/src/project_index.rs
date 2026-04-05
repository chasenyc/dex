// Tauri commands require owned types for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub path: String,
}

const PROJECT_MARKERS: &[&str] = &[
    ".git",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
];

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".cache",
    "Library",
    "Applications",
    ".Trash",
    "Pictures",
    "Music",
    "Movies",
    "Downloads",
    ".npm",
    ".cargo",
    ".rustup",
    "target",
    "dist",
    ".git",
    "vendor",
];

fn is_project_dir(path: &Path) -> bool {
    PROJECT_MARKERS
        .iter()
        .any(|marker| path.join(marker).exists())
}

fn scan_directory(root: &Path, max_depth: usize, results: &mut Vec<Project>) {
    scan_recursive(root, max_depth, 0, results);
}

fn scan_recursive(dir: &Path, max_depth: usize, current_depth: usize, results: &mut Vec<Project>) {
    if current_depth > max_depth {
        return;
    }

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        // Skip hidden dirs (except .config) and known non-project dirs
        if name.starts_with('.') && name != ".config" {
            continue;
        }
        if SKIP_DIRS.contains(&name) {
            continue;
        }

        if is_project_dir(&path) {
            let path_str = path.to_string_lossy().to_string();
            // Replace home dir with ~ for display
            let home = std::env::var("HOME").unwrap_or_default();
            let display_path = if path_str.starts_with(&home) {
                format!("~{}", &path_str[home.len()..])
            } else {
                path_str
            };
            results.push(Project {
                name: name.to_string(),
                path: display_path,
            });
            // Don't recurse into project dirs (they are leaves)
            continue;
        }

        // Recurse into non-project directories
        if current_depth < max_depth {
            scan_recursive(&path, max_depth, current_depth + 1, results);
        }
    }
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to get app data dir: {e}"))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("failed to create data dir: {e}"))?;
    Ok(data_dir.join("project_index.json"))
}

fn do_scan() -> Vec<Project> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    let home_path = Path::new(&home);

    let mut results = Vec::new();

    // Scan common project directories at depth 2
    let deep_roots = [
        "sites",
        "projects",
        "code",
        "repos",
        "dev",
        "work",
        "Developer",
        "src",
    ];
    for dir in &deep_roots {
        let path = home_path.join(dir);
        if path.is_dir() {
            scan_directory(&path, 2, &mut results);
        }
    }

    // Scan home at depth 1 (catches top-level projects)
    scan_directory(home_path, 1, &mut results);

    // Scan Desktop at depth 1
    let desktop = home_path.join("Desktop");
    if desktop.is_dir() {
        scan_directory(&desktop, 1, &mut results);
    }

    // Deduplicate by path
    results.sort_by(|a, b| a.path.cmp(&b.path));
    results.dedup_by(|a, b| a.path == b.path);

    // Sort alphabetically by name for display
    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    results
}

#[tauri::command]
pub fn check_directory_exists(path: String) -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let abs = if path.starts_with("~/") {
        format!("{}{}", home, &path[1..])
    } else if path == "~" {
        home
    } else {
        path
    };
    std::path::Path::new(&abs).is_dir()
}

#[tauri::command]
pub fn scan_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let projects = do_scan();

    // Cache to disk
    let path = cache_path(&app)?;
    let json =
        serde_json::to_string_pretty(&projects).map_err(|e| format!("serialize error: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("cache write error: {e}"))?;

    Ok(projects)
}

#[tauri::command]
pub fn load_project_index(app: AppHandle) -> Result<Vec<Project>, String> {
    let path = cache_path(&app)?;
    if path.exists() {
        let json = fs::read_to_string(&path).map_err(|e| format!("read error: {e}"))?;
        let projects: Vec<Project> =
            serde_json::from_str(&json).map_err(|e| format!("parse error: {e}"))?;
        // Filter out directories that no longer exist
        let home = std::env::var("HOME").unwrap_or_default();
        let valid: Vec<Project> = projects
            .into_iter()
            .filter(|p| {
                let abs = if p.path.starts_with("~/") {
                    format!("{}{}", home, &p.path[1..])
                } else {
                    p.path.clone()
                };
                std::path::Path::new(&abs).is_dir()
            })
            .collect();
        Ok(valid)
    } else {
        // No cache yet, do a fresh scan
        scan_projects(app)
    }
}
