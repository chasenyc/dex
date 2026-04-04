# Termaude

Terminal kanban manager. Tauri v2 (Rust backend) + React + TypeScript (frontend) + xterm.js.

## Commands
- `npm run dev` — start Vite dev server (frontend only)
- `npm run tauri dev` — start full Tauri app (frontend + backend)
- `npm run lint` — Biome check (TypeScript)
- `npm run lint:fix` — Biome auto-fix (TypeScript)
- `npm run lint:rust` — clippy + rustfmt check (Rust)
- `npm run test` — Vitest (TypeScript)
- `npm run test:rust` — cargo test (Rust)
- `npm run typecheck` — tsc --noEmit

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
- Biome handles formatting (2-space indent, double quotes, semicolons)

## Design
- Follow `docs/design-system.md` for all visual decisions (colors, spacing, typography, motion)
- Achromatic surfaces (pure grays), single accent color (#7c6aef), no gradients
- UI text: Inter; terminal text: JetBrains Mono / Zed Mono
- Sub-200ms animations, respect prefers-reduced-motion
- Content-first: terminal output and cards dominate, chrome recedes

## Testing
- Write tests for new logic; run the specific test, not the full suite
- Vitest for TypeScript, cargo test for Rust
- Test behavior, not implementation — no testing internal state

## Workflow
- Typecheck after code changes: `npm run typecheck`
- Lint before committing — pre-commit hook enforces this
- Commit messages: imperative mood, concise (e.g., "add session creation modal")
