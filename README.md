# Dex

A kanban board for your Claude Code sessions.

<!-- TODO: Add demo GIF here -->

## The Problem

You're running Claude Code across five tasks. Five terminal tabs. Which one was the auth fix? Did you close the migration session? What was that API thing you started yesterday?

Terminal tabs don't work for AI-assisted development. They're anonymous, ephemeral, and flat. You need something spatial.

## What Dex Does

Dex organizes your Claude Code sessions as cards on a kanban board. Each card is a live (or resumable) Claude session. You see what's running, what's waiting for input, and what's done — at a glance.

- **Create a session** by typing a name. Dex figures out the working directory automatically.
- **Double-click a card** to enter the full-screen terminal.
- **Close a session** and it stays on the board. Double-click to resume the conversation.
- **Drag cards** between columns to track your workflow.

## Install

```bash
brew install --cask chasenyc/tap/dex
```

> On first launch, right-click the app → Open (macOS Gatekeeper).

Or download directly from [Releases](https://github.com/chasenyc/dex/releases).

## Features

### Smart Session Creation

Type a session name and Dex infers the working directory by matching against your projects on disk. Type "my-api" and it finds `~/projects/my-api`. Type "auth bug" and it matches the word "auth" to the right repo.

A ghost line below the input shows where the session will start. Press **Tab** to open a directory picker if it's wrong.

Prefix with `!` for a raw shell session instead of Claude.

### Real-Time Status

Cards show live status via Claude Code hooks:

| Dot | Meaning |
|-----|---------|
| Green (pulse) | Claude is working |
| White | Waiting for your input |
| Amber | Needs permission approval |
| Gray | Session closed (resumable) |
| Red | Error |

Install hooks with `Cmd+K` → `>install`.

### Session Persistence

Close Dex, reopen it — your board is exactly as you left it. Cards, columns, order, everything. Previously running sessions show as closed and can be resumed with a double-click.

Each Claude session is backed by a UUID. Resume picks up the conversation where you left off.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New session (opens input on first column) |
| `Cmd+K` | Quick-switch between sessions |
| `Cmd+K` → `>` | Command palette |
| `Cmd+B` | Toggle board / focus view |
| `Cmd+W` | Close active terminal |
| `Cmd+[` / `Cmd+]` | Previous / next session |

### Command Palette

`Cmd+K` then type `>` to access commands:

- **Install Claude Hooks** — enable real-time session status
- **Uninstall Claude Hooks** — remove Dex hooks from Claude
- **Rescan Projects** — refresh the project directory index
- **Set Default Folder** — change the default working directory for new sessions

### Board Management

- Add, rename, and delete columns
- Drag-and-drop cards between columns and reorder within
- Double-click column headers to rename
- Each column shows a session count

### Terminal

- Full terminal emulation via xterm.js with WebGL rendering
- Gap-free line rendering with custom glyphs
- Copy/paste support
- When Claude exits, you land in an interactive shell in the same directory
- Shell sessions track `pwd` in real-time via OSC 7

### Git Integration

The title bar shows the current branch and uncommitted changes (`+additions -deletions`) for the active session's working directory.

## Development

```bash
npm install
npm run tauri dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run tauri dev` | Full app (frontend + Rust backend) |
| `npm run lint` | Biome check (TypeScript) |
| `npm run lint:rust` | clippy + rustfmt (Rust) |
| `npm run test` | Vitest (TypeScript) |
| `npm run test:rust` | cargo test (Rust) |
| `npm run typecheck` | tsc --noEmit |

### Stack

- **Tauri v2** — Rust backend, native webview
- **React + TypeScript** — UI
- **xterm.js + WebGL** — terminal emulation
- **portable-pty** — Rust PTY management
- **dnd-kit** — drag-and-drop
- **Tailwind CSS** — styling
- **Biome** — linting/formatting

## License

MIT
