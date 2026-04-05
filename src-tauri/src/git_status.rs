// Tauri commands require owned types for deserialization from JSON.
#![allow(clippy::needless_pass_by_value)]

use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub additions: u32,
    pub deletions: u32,
}

fn expand_path(path: &str) -> String {
    if path.starts_with("~/") {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{}{}", home, &path[1..])
    } else if path == "~" {
        std::env::var("HOME").unwrap_or_default()
    } else {
        path.to_string()
    }
}

#[tauri::command]
pub fn get_git_info(cwd: String) -> Option<GitInfo> {
    let dir = expand_path(&cwd);

    // Check if inside a git repo
    let check = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&dir)
        .output()
        .ok()?;

    if !check.status.success() {
        return None;
    }

    // Get branch name
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&dir)
        .output()
        .ok()?;

    let branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Get diff stats (unstaged + staged combined)
    let diff_output = Command::new("git")
        .args(["diff", "--shortstat", "HEAD"])
        .current_dir(&dir)
        .output()
        .ok()?;

    let stat_line = String::from_utf8_lossy(&diff_output.stdout);
    let (additions, deletions) = parse_shortstat(&stat_line);

    Some(GitInfo {
        branch,
        additions,
        deletions,
    })
}

fn parse_shortstat(line: &str) -> (u32, u32) {
    let mut additions = 0u32;
    let mut deletions = 0u32;

    for part in line.split(',') {
        let trimmed = part.trim();
        if trimmed.contains("insertion") {
            if let Some(num) = trimmed.split_whitespace().next() {
                additions = num.parse().unwrap_or(0);
            }
        } else if trimmed.contains("deletion") {
            if let Some(num) = trimmed.split_whitespace().next() {
                deletions = num.parse().unwrap_or(0);
            }
        }
    }

    (additions, deletions)
}
