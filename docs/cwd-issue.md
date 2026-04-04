# CWD Input Problem

## Product Context

Termaude is a kanban-style Claude Code session manager. Each card on the board is a Claude Code session tied to a UUID. Users create sessions from an inline text input at the bottom of each column.

## Current UX

The input field accepts a single line of text with this format:

```
<name> [~/path/to/directory]
```

Examples:
- `auth-fix` → creates a Claude session named "auth-fix" in `~`
- `auth-fix ~/sites/termaude` → creates a Claude session named "auth-fix" in `~/sites/termaude`
- `~/sites/termaude` → derives the name "termaude" from the path, uses it as cwd
- `!my-shell` → raw shell session (escape hatch, not Claude)

The path portion is optional. If omitted, the session starts in `~`. The `~` is expanded to the user's home directory on the Rust side.

## The Problem

Typing a full directory path is unrealistic for daily use. You have to remember exact paths, type them correctly, and there's no feedback if the directory doesn't exist. A typo silently drops you in the wrong place or fails. This is the biggest friction point in session creation right now.

## Constraints

- Must not slow down the "just type a name and go" happy path
- Should work without configuration on first use
- Needs to handle both absolute paths and `~` expansion
- Should validate the directory exists before creating the session
