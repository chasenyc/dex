# Termaude

## What It Is

Termaude is a kanban-style workspace manager for Claude Code. Instead of juggling terminal tabs or windows, you see all your Claude sessions laid out as cards on a board — grouped into columns that represent whatever workflow stages make sense to you.

## The Problem It Solves

Developers using Claude Code across multiple tasks hit a wall: you start `claude` in one terminal for auth work, another for the frontend, a third for tests. Within an hour you have six terminal tabs, no idea which is which, and you're mentally tracking "was that the auth session or the API one?" Close a terminal and the session is gone.

The existing tools don't help:
- **Terminal tabs** are anonymous. They show the current command, not what you're working on.
- **Terminal multiplexers** (tmux, screen) solve persistence but not organization. They're horizontal lists, not spatial workspaces.
- **IDE terminals** are buried in panels, competing for screen space with the editor.

None of these treat Claude Code sessions as first-class work items that persist, resume, and organize visually.

## How It Works

### The Board

The default view is a kanban board with columns. Each card is a Claude Code session. You see session names, working directories, status indicators, and the last few lines of terminal output — all at a glance.

Create a session by typing a name at the bottom of any column. Termaude automatically figures out the working directory by matching your session name against your projects on disk. Type "termaude" and it knows you mean `~/sites/termaude`. Type "auth fix" and it matches the word "auth" to `~/projects/auth-service`. No paths to remember or type.

### Focus View

Double-click a card and the board slides away — replaced by a full-screen terminal. This is where you actually work with Claude. Every terminal feature works: colors, cursor, resize, copy/paste, WebGL-rendered text with zero line gaps.

`Cmd+B` toggles back to the board. `Cmd+K` opens a quick-switch overlay to jump between sessions without touching the board.

### Session Persistence

Sessions survive across app restarts. Close Termaude, reopen it, and your board is exactly as you left it — cards in their columns, in their order. Previously running sessions show as "closed" with a gray dot. Double-click to resume the Claude conversation right where you left off, powered by `claude --resume`.

Each session is backed by a Claude Code session UUID. The board is the persistent view. The terminal is transient.

### Smart Working Directory

When you create a session, Termaude infers the working directory:

1. **Project name match** — "termaude" → `~/sites/termaude` (scans your filesystem for git repos and project markers)
2. **Word match** — "termaude bug" → matches "termaude" → `~/sites/termaude`
3. **Column consensus** — if 2+ sessions in the column share a directory, new sessions default there
4. **Recency** — falls back to your most recently used directory

A ghost line below the input shows the inferred directory in real time. Press Tab to open a searchable directory picker if the inference is wrong. Press Enter to accept.

## Features

- **Kanban board** with customizable columns (add, rename, delete, reorder)
- **Drag-and-drop** cards between columns and within columns
- **Claude Code by default** — every session starts Claude with a UUID
- **Session resume** — closed sessions stay on the board, double-click to resume
- **Shell escape hatch** — prefix with `!` for a raw shell session
- **Smart CWD inference** — project index + word matching + column context
- **Tab directory picker** — fuzzy search across all indexed projects
- **Quick-switch** (`Cmd+K`) — fuzzy search across all sessions
- **Keyboard shortcuts** — `Cmd+N` new, `Cmd+B` board toggle, `Cmd+[`/`]` prev/next
- **Card previews** — last 2-3 lines of terminal output shown on each card
- **Status indicators** — green pulse (running), gray (closed), red (error)
- **Session persistence** — board layout, columns, card order all saved to disk
- **WebGL terminal rendering** — gap-free, GPU-accelerated, xterm.js with custom glyphs
- **Dark theme** — achromatic surfaces, muted accent, designed after Warp + Zed

## Technology

- **Tauri v2** — Rust backend, native webview, ~10MB binary
- **React + TypeScript** — UI framework
- **xterm.js + WebGL** — terminal emulation
- **portable-pty** — Rust PTY management
- **dnd-kit** — drag-and-drop
- **Biome** — linting and formatting
- **Vitest** — testing

## Who It's For

Developers who run multiple Claude Code sessions simultaneously and want to organize them spatially rather than as a flat list of tabs. Especially useful for:

- Working across multiple repos or features in parallel
- Keeping track of long-running Claude conversations
- Resuming work after breaks without losing context
- Teams that think in kanban (backlog → active → done)
