# Technology Evaluation (Archived)

> Decision: **Tauri v2 + TypeScript + xterm.js** — see requirements.md

The key tension: **terminal emulation quality** vs **UI polish** vs **cross-platform support**.

## Option A: Electron + TypeScript (xterm.js)

| Dimension | Rating |
|---|---|
| Terminal emulation | Excellent (xterm.js is battle-tested) |
| UI aesthetics | Excellent (full CSS/HTML, any design system) |
| Cross-platform | Excellent (Chromium everywhere) |
| Performance | Moderate (Electron overhead, but xterm.js is fast) |
| Memory | Poor (each window is a Chromium instance) |
| Native feel | Moderate (can feel "webby") |

**Examples**: VS Code, Hyper terminal

## Option B: Tauri + TypeScript (xterm.js) -- SELECTED

| Dimension | Rating |
|---|---|
| Terminal emulation | Excellent (same xterm.js) |
| UI aesthetics | Excellent (same web UI capabilities) |
| Cross-platform | Good (uses OS webview — some quirks on Linux) |
| Performance | Good (much lighter than Electron) |
| Memory | Good (native webview, no bundled Chromium) |
| Native feel | Good (smaller footprint, OS-native webview) |

## Option C: Rust + GPU-rendered (custom toolkit)

| Dimension | Rating |
|---|---|
| Terminal emulation | Good (alacritty's vte crate exists) |
| UI aesthetics | Moderate (GPU-rendered UI is fast but harder to style) |
| Cross-platform | Good (Rust compiles everywhere) |
| Performance | Excellent (native speed, GPU rendering) |
| Memory | Excellent |
| Native feel | Moderate (custom rendering, not OS-native widgets) |

**Examples**: Alacritty, Warp

## Option D: Swift (macOS) + platform-specific

Not viable for cross-platform without maintaining separate codebases.

## Why Tauri Won

**Over Electron:** 10-20x smaller binary, 5-10x less memory, same web UI flexibility, Rust backend for performance-critical ops.

**Over native/GPU:** Kanban drag-and-drop is solved in web libs, CSS animations are trivial, massive component ecosystem, xterm.js is the gold standard.

## Known Risk

PTY management uses Rust `portable-pty` (from wezterm project) instead of node-pty, with IPC to frontend xterm.js. Well-proven pattern but requires careful implementation.
