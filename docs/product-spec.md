# Termaude - Product Spec

## The Concept

Termaude replaces the mental model of "tabs in a terminal" with a spatial workspace. Instead of a row of anonymous tabs you cycle through, you see all your terminal sessions laid out as cards on a board — grouped by what stage of work they represent. You glance at the board and immediately know: what's waiting, what's active, what's done.

The primary user is someone running multiple Claude Code sessions across different tasks or repos simultaneously.

---

## Layout & Views

### Board View (Default)

The main screen is a horizontal kanban board that fills the window.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Termaude                                              [+]  [⚙]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Backlog ──────┐  ┌─ Active ───────┐  ┌─ Review ──────┐       │
│  │                 │  │                 │  │                │       │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐│      │
│  │ │ api-refactor│ │  │ │ auth-fix    │ │  │ │ db-migration││      │
│  │ │ ~/proj/api  │ │  │ │ ~/proj/auth │ │  │ │ ~/proj/db   ││      │
│  │ │ ○ idle      │ │  │ │ ● running   │ │  │ │ ✓ complete  ││      │
│  │ │             │ │  │ │ > fixing... │ │  │ │ > done.     ││      │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘│      │
│  │                 │  │                 │  │                │       │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │                │       │
│  │ │ tests       │ │  │ │ frontend    │ │  │                │       │
│  │ │ ~/proj/test │ │  │ │ ~/proj/web  │ │  │                │       │
│  │ │ ○ idle      │ │  │ │ ● running   │ │  │                │       │
│  │ │             │ │  │ │ > building..│ │  │                │       │
│  │ └─────────────┘ │  │ └─────────────┘ │  │                │       │
│  │                 │  │                 │  │                │       │
│  │    [+ New]      │  │    [+ New]      │  │    [+ New]     │       │
│  └─────────────────┘  └─────────────────┘  └────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Columns:**
- Default columns: "Backlog", "Active", "Done" (user can customize)
- Each column has a header with its name, card count, and a collapse toggle
- Columns are horizontally scrollable if they overflow the window
- Columns can be reordered by dragging the header
- "+" button on column header or at bottom to add a new session to that column
- Right-click column header: rename, delete (moves cards to adjacent column), change color

**Cards:**
- Each card represents one terminal session
- Card shows: session name, working directory, status indicator, last 2-3 lines of output
- Cards are vertically stacked within a column, scrollable if they overflow
- Drag a card to reorder within a column or move to another column
- Double-click a card to enter Focus View

### Focus View

When you select a card, the board slides away and the terminal fills the screen. This is where you actually type and interact.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Board    auth-fix (Active)                    [Split] [Archive] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ~/projects/auth $ claude                                           │
│                                                                     │
│  ╭────────────────────────────────────────────────────────────╮     │
│  │ I'll fix the authentication middleware. Let me start by    │     │
│  │ reading the current implementation...                      │     │
│  ╰────────────────────────────────────────────────────────────╯     │
│                                                                     │
│  Read src/middleware/auth.ts                                        │
│  Read src/config/jwt.ts                                             │
│                                                                     │
│  ╭────────────────────────────────────────────────────────────╮     │
│  │ I found the issue. The token validation is not checking    │     │
│  │ the expiry timestamp correctly...                          │     │
│  ╰────────────────────────────────────────────────────────────╯     │
│                                                                     │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Full terminal emulation — everything works exactly like a normal terminal
- Top bar shows session name, which column it's in, and quick actions
- "← Board" button (or `Esc` / keyboard shortcut) returns to board view
- The terminal session continues running in the background when you switch away
- Transition: smooth slide/fade animation between board and focus (not jarring)

### Quick-Switch Overlay

A command-palette style overlay to jump between sessions without going back to the board.

```
┌──────────────────────────────────────┐
│  Switch Session           ⌘K        │
├──────────────────────────────────────┤
│  > search...                         │
│                                      │
│  ● auth-fix          Active          │
│  ● frontend          Active          │
│  ○ api-refactor      Backlog         │
│  ○ tests             Backlog         │
│  ✓ db-migration      Review          │
└──────────────────────────────────────┘
```

- Triggered by `Cmd+K` / `Ctrl+K`
- Fuzzy search by session name, directory, or column
- Shows status indicator next to each session
- Arrow keys + Enter to select, Esc to dismiss

---

## Card Anatomy (Detail)

```
┌───────────────────────────────┐
│  auth-fix                  ●  │  ← name + status dot
│  ~/projects/auth              │  ← working directory
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  > I found the issue. The     │  ← last lines of terminal output
│  > token validation is not... │     (live-updating preview)
│                               │
│  claude · 3m ago              │  ← process name + last activity
└───────────────────────────────┘
```

**Status indicators:**
- `●` green pulse — actively producing output right now
- `●` blue steady — process running, waiting for input
- `○` gray — idle / shell prompt, nothing happening
- `●` red — process exited with error
- `✓` green — process exited successfully (exit code 0)

**Card interactions:**
- Single click — select (highlight border, show actions in a small toolbar)
- Double click — enter Focus View
- Drag — move between columns or reorder
- Right-click — context menu: rename, archive, duplicate, move to column
- Hover — subtle elevation/shadow increase, shows full session name if truncated

---

## Session Lifecycle

### Creating a Session

1. Click "+" on a column header or the "+" button in the top bar
2. A modal/popover appears:
   - Session name (auto-suggested from directory name)
   - Working directory (file picker or type path)
   - Starting command (default: user's default shell; preset: `claude`)
   - Which column to place it in
3. Session spawns and card appears in the column
4. Optionally auto-enter Focus View on creation

**Quick create:** `Cmd+N` creates a new session in the "Active" column with defaults, immediately entering Focus View. Minimal friction for "I just need another terminal."

### Archiving a Session

- Sessions can be archived (not deleted) — removed from the board but stored
- Archived sessions retain their scrollback and metadata
- An "Archive" drawer/panel accessible from the sidebar to browse or restore old sessions
- Auto-archive suggestion: if a session's process has exited and it's been idle for > 24h

### Session Persistence

- Column assignments and card order persist across app restarts
- Running processes are *not* preserved on restart (terminals close on quit)
- On relaunch, sessions that were running show as "disconnected" with option to restart
- Scrollback history is optionally persisted to disk (configurable)

---

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|---|---|---|
| New session | `Cmd+N` | `Ctrl+N` |
| Quick switch | `Cmd+K` | `Ctrl+K` |
| Back to board | `Esc` (when in focus) | `Esc` |
| Next session | `Cmd+]` | `Ctrl+]` |
| Previous session | `Cmd+[` | `Ctrl+[` |
| Close/archive session | `Cmd+W` | `Ctrl+W` |
| Settings | `Cmd+,` | `Ctrl+,` |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` |
| Move card to next column | `Cmd+Shift+→` | `Ctrl+Shift+→` |
| Move card to prev column | `Cmd+Shift+←` | `Ctrl+Shift+←` |

Note: These must not conflict with terminal keybindings. When in Focus View, most shortcuts require a modifier prefix so they don't interfere with the running CLI. The app captures `Cmd/Ctrl` combos; the terminal gets everything else.

---

## Visual Design Direction

### Aesthetic

**Dark-first, with light mode support.** The app should feel like a premium developer tool — think Linear meets Warp. Clean, spacious, not cluttered. The terminal content is the star; the UI around it is quiet and supportive.

### Color

- Background: deep charcoal/near-black (`#0a0a0a` - `#1a1a1a` range)
- Card backgrounds: slightly elevated (`#1e1e1e` - `#252525`)
- Column backgrounds: subtle differentiation (`#111111` - `#161616`)
- Accent color: user-configurable, default: muted blue-violet (`#7c6aef`)
- Status colors: green (`#34d399`), blue (`#60a5fa`), red (`#f87171`), gray (`#6b7280`)
- Text: off-white primary (`#e5e5e5`), muted secondary (`#a3a3a3`)

### Typography

- UI text: Inter or system font stack (clean, modern sans-serif)
- Terminal text: JetBrains Mono, Fira Code, or user's preferred monospace font
- Card titles: 13-14px, medium weight
- Card preview text: 11-12px, monospace, reduced opacity
- Column headers: 12px, uppercase, letter-spaced, muted color

### Spacing & Layout

- Cards have 8-12px internal padding, 8px gap between cards
- Columns have 16px padding, 12-16px gap between columns
- Generous whitespace — the board should breathe, not feel cramped
- Border radius: 8px on cards, 12px on columns
- Subtle borders (1px, very low opacity) rather than hard lines

### Motion

- Card drag: smooth follow with slight rotation (2-3 degrees) and elevated shadow
- Card drop: spring animation to settle into position
- View transitions (board ↔ focus): 200-300ms slide + fade
- Card status dot: gentle pulse animation for "active" state
- Hover effects: 150ms ease, subtle shadow/elevation increase
- No motion if user has `prefers-reduced-motion` enabled

### Cards in Board View

Cards should feel tactile — like physical sticky notes on a board. Subtle shadow to create depth. On hover, they lift slightly. When dragging, they tilt and cast a deeper shadow. The preview text inside should feel like peeking at a running terminal through a small window.

---

## Settings

Accessible via gear icon or `Cmd+,`.

### Appearance
- Theme: Dark / Light / System
- Accent color picker
- Terminal font family and size
- UI scale

### Terminal
- Default shell
- Default starting command
- Scrollback line limit (default: 10,000)
- Cursor style (block, underline, bar)

### Board
- Default columns (names and order for new boards)
- Auto-archive idle sessions (on/off, threshold)

### Shortcuts
- Rebindable keyboard shortcuts

---

## First-Run Experience

1. App opens with a clean board: three default columns ("Backlog", "Active", "Done")
2. A welcome card in the "Active" column with a brief interactive tutorial
3. Tutorial walks through: creating a session, moving cards, entering focus view
4. After tutorial, the welcome card can be dismissed/archived
5. No account creation, no sign-up, no telemetry opt-in — straight to work
