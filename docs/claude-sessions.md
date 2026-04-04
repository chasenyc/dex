# Claude Code Session Management

## Core Concept

Termaude is a Claude Code workspace manager. Every card on the board is a Claude Code session. The board is the persistent view — sessions live on even when the terminal is closed.

## Session Lifecycle

```
CREATE → RUNNING → CLOSED → RESUME → RUNNING → ...
```

1. **Create** — User types a name (e.g., "auth-fix") in the column input
   - Termaude generates a UUID
   - Stores `{ name: "auth-fix", uuid: "<generated>", column: "Active" }` in registry
   - Spawns: `claude --session-id <uuid> -n "auth-fix"`
   - Card appears on board with green "running" dot

2. **Running** — Terminal is live, user interacts with Claude
   - Card shows status dot (green pulse)
   - Double-click focuses the terminal

3. **Closed** — User closes the terminal or Claude exits
   - Card stays on the board (gray dot, "closed" status)
   - PTY is gone, but the registry entry persists
   - The UUID still maps to a resumable Claude session on disk

4. **Resume** — User double-clicks the closed card
   - Termaude spawns: `claude --resume <uuid>`
   - Card goes back to "running"
   - Same Claude conversation continues where it left off

## Input Parsing

The inline input at the bottom of each column accepts:

| Input | Name | CWD | Command |
|---|---|---|---|
| `auth-fix` | auth-fix | `~` | `claude --session-id <uuid> -n "auth-fix"` |
| `auth-fix ~/projects/app` | auth-fix | `~/projects/app` | `claude --session-id <uuid> -n "auth-fix"` |
| `~/projects/app` | app *(from path)* | `~/projects/app` | `claude --session-id <uuid> -n "app"` |
| `!` | shell | `~` | *(default shell, no claude)* |
| `!my-shell ~/work` | my-shell | `~/work` | *(default shell, no claude)* |

**Rules:**
- Default = Claude Code session
- `!` prefix = raw shell (escape hatch)
- If input contains a space followed by a `/` or `~`, the second part is the CWD
- If entire input is a path, name is derived from last path segment

**Future:** directory autocomplete and validation in the input

## Registry

A JSON file at `~/.termaude/sessions.json` (or within the app data dir):

```json
{
  "sessions": [
    {
      "id": "session-1717000000-abc12",
      "name": "auth-fix",
      "claudeSessionId": "550e8400-e29b-41d4-a716-446655440000",
      "column": "Active",
      "cwd": "~/projects/app",
      "status": "closed",
      "createdAt": 1717000000000,
      "lastActivity": 1717003600000
    }
  ],
  "columns": ["Backlog", "Active", "Done"]
}
```

## What Changes

| Before | After |
|---|---|
| Default session = shell | Default session = Claude Code |
| `#c` prefix for Claude | Every session is Claude (`!` for shell) |
| Session dies = gone | Session dies = card stays, resumable |
| No persistence | Registry persists sessions + columns to disk |
| Session ID = random string | Session ID links to Claude UUID |

## Commands Generated

| Action | Command |
|---|---|
| New session "auth-fix" | `claude --session-id <uuid> -n "auth-fix"` |
| Resume closed session | `claude --resume <uuid>` |
| New session (no name) | `claude --session-id <uuid>` |
| Raw shell (`!` prefix) | Default shell (no claude) |

## Session Cleanup

- Sessions in the "Done" column auto-archive after a configurable period (TBD)
- Manual archive/delete always available via right-click or keyboard shortcut
- Archived sessions can be restored from an archive view (future)
