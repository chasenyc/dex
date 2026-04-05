use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{BufReader, Write};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, thiserror::Error)]
pub enum PtyError {
    #[error("failed to open PTY: {0}")]
    Open(String),
    #[error("failed to spawn command: {0}")]
    Spawn(String),
    #[error("session not found: {0}")]
    NotFound(String),
    #[error("write failed: {0}")]
    Write(String),
    #[error("resize failed: {0}")]
    Resize(String),
}

impl serde::Serialize for PtyError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    #[allow(dead_code)]
    child_pid: Option<u32>,
}

pub struct PtyManager {
    sessions: Mutex<HashMap<String, Session>>,
    /// Maps Termaude session ID → child PID for shell cwd tracking
    session_pids: Mutex<HashMap<String, u32>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            session_pids: Mutex::new(HashMap::new()),
        }
    }

    #[allow(clippy::too_many_arguments, clippy::too_many_lines)]
    pub fn create_session(
        &self,
        id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
        session_id: Option<&str>,
        cols: u16,
        rows: u16,
        app: &AppHandle,
    ) -> Result<(), PtyError> {
        let pty_system = native_pty_system();

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| PtyError::Open(e.to_string()))?;

        let mut cmd = if let Some(shell_cmd) = command {
            // Run the command inside the user's default shell as interactive
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            let mut c = CommandBuilder::new(shell);
            c.arg("-i");
            c.arg("-c");
            c.arg(shell_cmd);
            c
        } else {
            // Shell session — use ZDOTDIR to inject chpwd hook for OSC 7 CWD tracking
            // Same approach as VS Code, iTerm2, and kitty
            let mut c = CommandBuilder::new_default_prog();
            if let Some(sid) = session_id {
                let home = std::env::var("HOME").unwrap_or_default();
                let zdotdir = format!("{home}/.dex/shell/{sid}");
                let _ = std::fs::create_dir_all(&zdotdir);

                // .zshenv runs first, resets ZDOTDIR so user's real .zshrc loads,
                // and registers a chpwd hook that emits OSC 7 on directory change
                let zshenv = format!(
                    concat!(
                        "export ZDOTDIR=\"$HOME\"\n",
                        "_dex_chpwd() {{\n",
                        "  printf '\\033]7;file://dex-{sid}%s\\a' \"$PWD\"\n",
                        "}}\n",
                        "autoload -Uz add-zsh-hook\n",
                        "add-zsh-hook chpwd _dex_chpwd\n",
                        "_dex_chpwd\n",
                    ),
                    sid = sid,
                );
                let _ = std::fs::write(format!("{zdotdir}/.zshenv"), &zshenv);
                let _ = std::fs::remove_file(format!("{zdotdir}/.zshrc"));
                c.env("ZDOTDIR", &zdotdir);
            }
            c
        };
        if let Some(dir) = cwd {
            let expanded = if dir.starts_with("~/") {
                if let Ok(home) = std::env::var("HOME") {
                    format!("{}{}", home, &dir[1..])
                } else {
                    dir.to_string()
                }
            } else if dir == "~" {
                std::env::var("HOME").unwrap_or_else(|_| dir.to_string())
            } else {
                dir.to_string()
            };
            cmd.cwd(expanded);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| PtyError::Spawn(e.to_string()))?;

        let child_pid = child.process_id();

        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| PtyError::Open(e.to_string()))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| PtyError::Open(e.to_string()))?;

        let pty_id = id.to_string();
        let app_handle = app.clone();

        // Spawn a thread to read PTY output and emit events to the frontend
        thread::spawn(move || {
            let mut buf_reader = BufReader::new(reader);
            let mut buf = [0u8; 4096];
            loop {
                match std::io::Read::read(&mut buf_reader, &mut buf) {
                    Ok(0) => {
                        // PTY closed — process exited
                        let _ = app_handle.emit(&format!("pty-exit-{pty_id}"), ());
                        break;
                    }
                    Ok(n) => {
                        // Send raw bytes as a vec so xterm.js can handle them
                        let data = buf[..n].to_vec();
                        let _ = app_handle.emit(&format!("pty-output-{pty_id}"), data);
                    }
                    Err(_) => break,
                }
            }
        });

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::Open(e.to_string()))?;

        sessions.insert(
            id.to_string(),
            Session {
                writer,
                master: pair.master,
                child_pid,
            },
        );

        // Store session_id → pid mapping for cwd tracking
        if let (Some(sid), Some(pid)) = (session_id, child_pid) {
            if let Ok(mut pids) = self.session_pids.lock() {
                pids.insert(sid.to_string(), pid);
            }
        }

        Ok(())
    }

    pub fn write_to_session(&self, id: &str, data: &[u8]) -> Result<(), PtyError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::Write(e.to_string()))?;

        let session = sessions
            .get_mut(id)
            .ok_or_else(|| PtyError::NotFound(id.to_string()))?;

        session
            .writer
            .write_all(data)
            .map_err(|e| PtyError::Write(e.to_string()))?;

        session
            .writer
            .flush()
            .map_err(|e| PtyError::Write(e.to_string()))?;

        Ok(())
    }

    pub fn resize_session(&self, id: &str, cols: u16, rows: u16) -> Result<(), PtyError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::Resize(e.to_string()))?;

        let session = sessions
            .get(id)
            .ok_or_else(|| PtyError::NotFound(id.to_string()))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::Resize(e.to_string()))?;

        Ok(())
    }

    pub fn close_session(&self, id: &str) -> Result<(), PtyError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| PtyError::Write(e.to_string()))?;

        sessions.remove(id);
        Ok(())
    }
}
