# Termaude - MVP Plan

## MVP Definition

The minimum product that is actually useful: a kanban board where each card is a live terminal, and you can fluidly switch between the board and a full-screen terminal view. That's it. If that core loop doesn't feel great, nothing else matters.

### What's IN the MVP

1. **Board view** with draggable columns and cards
2. **Focus view** with full terminal emulation (xterm.js)
3. **Fluid transition** between board and focus (toggle shortcut + click)
4. **Card preview** showing last few lines of terminal output and status indicator
5. **Session creation** — name, working directory, starting command
6. **Session persistence** — layout survives app restart (column assignments, card order)
7. **Dark theme** — one polished dark theme, no light mode yet
8. **Keyboard shortcuts** — new session, toggle view, quick-switch overlay, next/prev session
9. **Quick-switch overlay** (`Cmd+K`) — fuzzy search to jump between sessions

### What's OUT of the MVP

- Light mode / custom themes
- Settings UI (hardcoded sensible defaults, config file for power users)
- Archive/restore (close = gone for now)
- Scrollback persistence across restarts
- Auto-archive
- First-run tutorial
- Session templates
- Split panes
- Notifications
- Local LLM / autocomplete
- Windows support (macOS + Linux first)

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         React + TypeScript + Tailwind        │
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Board   │  │  Focus    │  │  Quick   │  │
│  │  View    │  │  View     │  │  Switch  │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  │
│       │              │              │         │
│  ┌────┴──────────────┴──────────────┴─────┐  │
│  │         xterm.js instances             │  │
│  │   (one per session, reattach on focus) │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│              Tauri IPC                       │
├───────────────────┼──────────────────────────┤
│                   │                          │
│               Backend (Rust)                 │
│                                              │
│  ┌────────────┐  ┌────────────────────────┐  │
│  │  Session   │  │  PTY Manager           │  │
│  │  Store     │  │  (portable-pty)        │  │
│  │  (JSON)    │  │  spawn / read / write  │  │
│  └────────────┘  └────────────────────────┘  │
│                                              │
└─────────────────────────────────────────────┘
```

**Frontend** manages all UI state — which view is active, column/card layout, drag-and-drop. Each session has an xterm.js Terminal instance that stays alive in memory. When you switch to Focus View, the existing Terminal instance gets attached to the full-screen DOM element (no re-render, no flicker).

**Backend** owns the PTY processes. Each session maps to one PTY. The backend streams PTY output to the frontend over Tauri IPC, and forwards keystrokes from the frontend to the PTY. The session store is a JSON file on disk for layout persistence.

**Key data flow:**
1. User creates session → frontend sends `create_session` command via IPC
2. Backend spawns PTY process, returns session ID
3. Backend streams PTY output → frontend routes it to the correct xterm.js instance
4. User types in Focus View → frontend sends keystrokes via IPC → backend writes to PTY
5. Card previews read from the same xterm.js buffer (last N lines)

---

## Implementation Phases

### Phase 0: Project Scaffolding & Guardrails

The goal of Phase 0 is not just "get it running" — it's to set up the project so that Claude Code (and humans) produce clean, consistent, well-tested code from the first line forward. Every phase after this inherits the discipline established here.

#### 0a. Initialize the Project

- [x] Scaffold with `npm create tauri-app@latest termaude -- --template react-ts`
- [x] Set up Tailwind CSS
- [x] Add frontend deps: `xterm`, `@xterm/addon-fit`, `@dnd-kit/core`
- [x] Add Rust dep: `portable-pty` in `src-tauri/Cargo.toml`
- [x] Verify the app builds and opens a window on macOS

#### 0b. Linting & Formatting (Zero Tolerance from Day One)

**TypeScript — Biome** (replaces ESLint + Prettier, single tool, sub-second):
- [x] Install `@biomejs/biome`, run `npx biome init`
- [x] Configure `biome.json`: recommended rules, 2-space indent, enforce imports order
- [x] Add `package.json` scripts: `lint`, `lint:fix`, `format`

**Rust — clippy + rustfmt**:
- [x] Add `src-tauri/rustfmt.toml` (edition 2021, max_width 100)
- [x] Enable clippy pedantic warnings in `src-tauri/Cargo.toml` `[lints.clippy]`
- [x] Add script: `"lint:rust": "cd src-tauri && cargo fmt -- --check && cargo clippy -- -D warnings"`

#### 0c. Testing Infrastructure

**TypeScript — Vitest** (shares Vite config, zero extra bundler setup):
- [x] Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [x] Add test config to `vite.config.ts` (jsdom environment, global setup file)
- [x] Create `src/test/setup.ts` with testing-library matchers
- [x] Write one smoke test to prove the pipeline works
- [x] Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

**Rust — cargo test**:
- [ ] Write one smoke test using `tauri::test::mock_builder()`
- [x] Add script: `"test:rust": "cd src-tauri && cargo test"`

#### 0d. Pre-Commit Hooks (Enforce on Every Commit)

- [x] Install `husky` + `lint-staged`, run `npx husky init`
- [x] Configure `lint-staged` in `package.json`:
  ```json
  "lint-staged": {
    "src/**/*.{ts,tsx}": ["biome check --write --no-errors-on-unmatched"],
    "src-tauri/**/*.rs": ["sh -c 'cd src-tauri && cargo fmt -- --check && cargo clippy -- -D warnings'"]
  }
  ```
- [x] `.husky/pre-commit` runs `npx lint-staged`
- [x] Verify: a commit with a lint error should be rejected

#### 0e. CLAUDE.md (Project Rules for AI-Assisted Development)

Create a `CLAUDE.md` at the project root. This is what keeps Claude Code aligned with our architecture. Keep it under 60 lines — every line should prevent a real mistake.

```markdown
# Termaude

Terminal kanban manager. Tauri v2 (Rust backend) + React + TypeScript (frontend) + xterm.js.

## Commands
- `npm run lint` — Biome check (TypeScript)
- `npm run test` — Vitest (TypeScript)
- `npm run lint:rust` — clippy + rustfmt check (Rust)
- `npm run test:rust` — cargo test (Rust)
- `npm run dev` — start Tauri dev server

## Architecture
- Frontend: `src/` — React components, hooks, state management
- Backend: `src-tauri/src/` — Rust PTY management, session store, Tauri commands
- IPC boundary: frontend never touches PTY directly, always goes through Tauri commands
- State: React state for UI, Rust owns session/PTY lifecycle, JSON file for persistence

## Code Style
- TypeScript strict mode, no `any` without justification in a comment
- Functional React components with hooks only, no class components
- Rust: no unwrap() in production code, use proper error handling with thiserror
- Small, focused files — one component per file, one Tauri command per function

## Testing
- Write tests for new logic; run the specific test, not the full suite
- Vitest for TypeScript, cargo test for Rust
- Test behavior, not implementation — no testing internal state

## Design
- Follow `docs/design-system.md` for all visual decisions (colors, spacing, typography, motion)
- Achromatic surfaces (pure grays), single accent color (#7c6aef), no gradients
- UI text: Inter; terminal text: JetBrains Mono / Zed Mono
- Sub-200ms animations, respect prefers-reduced-motion
- Content-first: terminal output and cards dominate, chrome recedes

## Workflow
- Typecheck after code changes: `npx tsc --noEmit`
- Lint before committing — pre-commit hook will enforce this
- Commit messages: imperative mood, concise (e.g., "add session creation modal")
```

#### 0f. .claude/ Project Settings

Create `.claude/settings.json` to configure permissions and hooks for Claude Code sessions working on this project:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run lint:fix)",
      "Bash(npm run test)",
      "Bash(npm run test:*)",
      "Bash(npm run dev)",
      "Bash(npm run build)",
      "Bash(npx tsc --noEmit)",
      "Bash(cd src-tauri && cargo *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx biome check --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

This auto-formats every file Claude edits and pre-approves safe commands so development flows without constant permission prompts.

#### 0g. Git Init & First Commit

- [x] `git init`, create `.gitignore` (node_modules, target, dist, .env*)
- [x] Add `.claude/settings.local.json` to `.gitignore`
- [x] Initial commit with scaffolding, linting, tests, CLAUDE.md, and settings
- [ ] Verify: clone fresh, `npm install`, `npm run lint`, `npm run test` all pass

#### 0h. Proof of Life

- [x] Wire up one Tauri command that spawns a PTY and streams output
- [x] Render output in a single xterm.js instance in the frontend
- [x] Type a keystroke → it reaches the PTY → output appears on screen
- [x] **Milestone: a window with one working terminal, backed by enforced linting and tests**

### Phase 1: Single Terminal, Full Screen
- [x] Full-screen terminal view with xterm.js
- [x] Proper terminal resize handling
- [ ] Copy/paste support
- [ ] Basic Tauri window chrome (title bar, close/minimize/maximize)
- [x] Terminal font configuration (hardcoded to JetBrains Mono or system monospace)
- **Milestone: a usable single-session terminal app** *(mostly complete)*

### Phase 2: Multiple Sessions
- [x] Backend supports multiple simultaneous PTY sessions *(PtyManager already uses HashMap of sessions)*
- [ ] Frontend manages multiple xterm.js instances
- [ ] Sessions stay alive when not focused (background PTY keeps running)
- [ ] IPC multiplexing — route output to correct session
- [ ] Quick-switch overlay (`Cmd+K`) to jump between sessions
- **Milestone: multiple terminals you can switch between**

### Phase 3: Board View
- [ ] Kanban board layout with columns
- [ ] Card component showing session name, directory, status indicator
- [ ] Card preview — render last 2-3 lines from xterm.js buffer
- [ ] Drag-and-drop cards between columns (dnd-kit)
- [ ] Drag-and-drop column reordering
- [ ] Add/remove/rename columns
- [ ] Create new session from board
- **Milestone: the board exists and cards reflect real sessions**

### Phase 4: View Transitions
- [ ] Toggle shortcut between board and focus view
- [ ] Click card to enter focus view
- [ ] Smooth transition animation (slide/fade, 200-300ms)
- [ ] xterm.js instance reattachment (no flicker on view switch)
- [ ] Status indicators update live on cards (idle, running, error, done)
- [ ] "← Board" button in focus view header
- **Milestone: the core loop feels good — board, focus, switch, repeat**

### Phase 5: Polish & Persistence
- [ ] Session layout persistence (save columns + card positions to JSON)
- [ ] Restore layout on app restart (sessions show as disconnected)
- [ ] Restart session from disconnected state
- [ ] Keyboard shortcuts (new session, next/prev, close, toggle view)
- [ ] Visual polish pass — shadows, hover states, animations, spacing
- [ ] Card status dot animations (pulse for active)
- [ ] Edge cases — session process dies, resize during drag, rapid switching
- **Milestone: MVP complete — daily-drivable**

---

## Open Questions

- **Toggle shortcut**: What key combo for board ↔ focus toggle? Needs to not conflict with terminal apps. Candidates: `` Ctrl+` ``, `Cmd+\`, `Cmd+Shift+Space`, or a custom chord.
- **Card preview rendering**: Do we render a tiny xterm.js canvas per card, or just extract text from the buffer and render as plain styled text? Canvas is more accurate but heavier. Text is lighter but loses formatting.
- **Session limit**: Should we cap simultaneous sessions? 20+ PTY processes could get heavy. Probably just let it ride and see.
- **Linux webview**: Tauri v2 uses WebKitGTK on Linux, which can lag behind Chromium. Need to test xterm.js rendering quality early.
