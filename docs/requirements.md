# Termaude - Requirements

## Vision

A terminal application that organizes terminal sessions (primarily Claude Code instances) in a kanban-style layout instead of traditional tabs. Users can visually manage multiple AI coding sessions by dragging them between columns representing workflow stages.

## Core Requirements

### Kanban Terminal Management

- Columns represent workflow stages (e.g., "Backlog", "In Progress", "Review", "Done")
- Each card in a column is a live terminal session
- Cards can be dragged between columns to reflect workflow state
- Clicking/selecting a card expands it to a focused terminal view
- Cards show a preview/summary of terminal activity (last few lines, status indicators)
- Users can create, rename, and reorder columns

### Terminal Emulation

- Full terminal emulation (xterm-compatible) for each session
- Support for running Claude Code instances as the primary use case
- Support for any CLI tool (not locked to Claude Code)
- Proper handling of ANSI colors, cursor movement, and terminal resize
- Copy/paste support
- Scrollback buffer per session

### Session Management

- Create new terminal sessions from any column
- Close/archive sessions
- Persist session layout across app restarts (column assignments, order)
- Optional: save/restore terminal scrollback on restart

### Aesthetics

- Modern, polished UI — not a bare-bones terminal
- Smooth animations for drag-and-drop, transitions, column reordering
- Customizable color themes (dark/light, accent colors)
- Card status indicators (idle, active, error) with visual cues
- Clean typography and spacing
- Minimal chrome — the terminal content should be front and center

### Cross-Platform

- macOS (primary)
- Linux
- Windows

## Non-Functional Requirements

- Low latency terminal rendering (typing should feel instant)
- Reasonable memory usage with many sessions open (10+)
- Native-feeling UI on each platform (keyboard shortcuts, window management)
- Accessible (keyboard navigation for all kanban operations)

## Nice-to-Have (Future)

- Session templates (pre-configured commands per column)
- Session grouping/tagging beyond columns
- Split-pane view within a card
- Session search/filter
- Notifications when a session needs attention (command finished, error)
- Export session output to file
- Shared layouts/presets

---

## Technology Decision (DECIDED)

**Tauri v2 + TypeScript + React + xterm.js**

- **Tauri v2** — app shell, native OS integration, Rust backend
- **TypeScript + React** — UI framework
- **xterm.js** — terminal emulation
- **dnd-kit** — drag-and-drop kanban
- **Tailwind CSS** — styling
- **portable-pty (Rust)** — PTY management from Rust backend, IPC to frontend xterm.js

See `docs/technology-evaluation.md` for the full comparison that led to this decision.
