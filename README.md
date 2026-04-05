# Dex

A kanban board for your Claude Code sessions.

<!-- TODO: Add demo GIF here -->

## The Problem

You're running Claude Code across five tasks. Five terminal tabs. Which one was the auth fix? Did you close the migration session? What was that API thing you started yesterday?

Close a terminal and the session is gone. Forget to resume and you're starting from scratch — re-explaining context Claude already had. You end up keeping sessions open just to avoid losing them, and your desktop fills with terminals you can't tell apart.

Terminal tabs don't work for AI-assisted development. They're anonymous, ephemeral, and flat. You need something spatial.

## What Dex Does

Dex treats every Claude session as a persistent work item on a kanban board. Sessions don't disappear when you close them — they stay on the board as cards you can pick back up anytime. The conversation, the context, the working directory — it's all there when you come back.

You stop managing terminals and start managing work.

- **Create a session** by typing a name. Dex figures out the working directory automatically.
- **Work in a full-screen terminal.** Every feature you'd expect — colors, WebGL rendering, copy/paste.
- **Close whenever you want.** The card stays on the board. Come back in five minutes or five days.
- **Resume with a double-click.** Claude picks up exactly where you left off. No re-explaining.
- **See everything at a glance.** Which sessions are running, which need your input, which are done.
- **Drag cards** between columns to match your workflow — backlog, active, done, or whatever you want.

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
