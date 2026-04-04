# Claude Code Hooks Integration

## Goal

Detect Claude Code session state in real-time so Termaude can show accurate status on board cards:
- **Working** — Claude is actively generating, making tool calls
- **Waiting for input** — idle at the prompt, waiting for user
- **Permission prompt** — waiting for user to approve a tool
- **Done** — session ended / process exited

## Available Hook Lifecycle Events (26 total)

| Event | When it fires | Matcher support |
|---|---|---|
| `SessionStart` | Session begins, resumes, clears, compacts | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | Session terminates | `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `UserPromptSubmit` | User submits a prompt (before Claude processes) | None |
| `PreToolUse` | Before a tool call executes (can block/rewrite) | Tool name regex: `Bash`, `Edit\|Write`, `mcp__.*` |
| `PostToolUse` | After a tool call succeeds | Tool name |
| `PostToolUseFailure` | After a tool call fails | Tool name |
| `PermissionRequest` | Permission dialog appears | Tool name |
| `PermissionDenied` | Auto-mode classifier denies a tool | Tool name |
| `Notification` | Claude sends a notification | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `Stop` | Claude finishes responding (every turn) | None |
| `StopFailure` | Turn ends due to API error | `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown` |
| `SubagentStart` | Subagent spawns | Agent type |
| `SubagentStop` | Subagent finishes | Agent type |
| `TaskCreated` | Task created via TaskCreate tool | None |
| `TaskCompleted` | Task marked completed | None |
| `TeammateIdle` | Agent-team teammate about to idle | None |
| `InstructionsLoaded` | CLAUDE.md or rules file loaded | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `ConfigChange` | Config file changes during session | `user_settings`, `project_settings`, etc. |
| `CwdChanged` | Claude changes working directory | None |
| `FileChanged` | Watched file changes on disk | Filename basename |
| `PreCompact` | Before context compaction | `manual`, `auto` |
| `PostCompact` | After compaction completes | `manual`, `auto` |
| `Elicitation` | MCP server requests user input | MCP server name |
| `ElicitationResult` | User responds to MCP elicitation | MCP server name |
| `WorktreeCreate` | Worktree created | None |
| `WorktreeRemove` | Worktree removed | None |

## Events That Map to Termaude States

| Termaude State | Card Display | Hook Events |
|---|---|---|
| **Running/Working** | Green pulse dot | `UserPromptSubmit` (user sent prompt → Claude is working), `PreToolUse` (tool call started) |
| **Waiting for input** | Blue steady dot | `Notification` matcher `idle_prompt` (Claude finished, waiting for user), `Stop` (Claude finished a turn) |
| **Permission prompt** | Yellow/amber dot | `Notification` matcher `permission_prompt`, `PermissionRequest` |
| **Error** | Red dot | `StopFailure`, `PostToolUseFailure` |
| **Session ended** | Gray dot | `SessionEnd` (terminal event), PTY exit (process died) |

### State Machine

```
SessionStart → RUNNING
UserPromptSubmit → RUNNING (user sent input, Claude working)
PreToolUse → RUNNING (actively calling tools)
Stop → WAITING (Claude finished, user's turn)
Notification(idle_prompt) → WAITING (explicit idle signal)
Notification(permission_prompt) → PERMISSION
PermissionRequest → PERMISSION
StopFailure → ERROR
SessionEnd → ENDED
PTY exit → ENDED
```

## Hook Configuration Format

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "optional regex",
        "hooks": [
          {
            "type": "command",
            "command": "shell command here",
            "timeout": 10,
            "async": true,
            "statusMessage": "optional spinner text"
          }
        ]
      }
    ]
  }
}
```

### Handler Types

| Type | Description | Use case |
|---|---|---|
| `command` | Runs shell command, receives JSON on stdin | Write state to file/socket |
| `http` | POSTs event JSON to a URL | Termaude could run a local HTTP server |
| `prompt` | Single-turn LLM call | Not useful for state detection |
| `agent` | Multi-turn subagent | Not useful for state detection |

### Stdin JSON (what hooks receive)

Every hook receives at minimum:
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/working/directory",
  "hook_event_name": "Stop",
  "permission_mode": "default"
}
```

Tool events add: `tool_name`, `tool_input`, `tool_use_id`, `tool_response` (PostToolUse only).
Stop adds: `stop_hook_active` (boolean — critical to check to prevent infinite loops).

### Exit Code Behavior

| Code | Effect |
|---|---|
| 0 | Proceed. Stdout parsed for JSON. |
| 2 | Block action. Stderr fed to Claude. |
| Other | Proceed. Non-blocking error logged. |

### Environment Variables Available

| Variable | Scope | Description |
|---|---|---|
| `CLAUDE_PROJECT_DIR` | All hooks | Project root directory |
| `CLAUDE_FILE_PATH` | PostToolUse (Edit/Write) | Path of edited file |
| `CLAUDE_ENV_FILE` | SessionStart, CwdChanged, FileChanged | Path for persisting env vars |
| `CLAUDE_CODE_REMOTE` | All hooks | `"true"` in remote environments |

Note: `session_id` comes via stdin JSON, NOT an environment variable.

## Settings File Merge Behavior

**Hooks merge additively across all settings files.** They do NOT override. All matching hooks from all sources run in parallel. This is critical — our hooks won't prevent user hooks from running.

Resolution order (all run, not just highest priority):
1. Built-in hooks (internal)
2. `~/.claude/settings.json` (user/global)
3. Plugin hooks
4. `.claude/settings.json` (project)
5. `.claude/settings.local.json` (project-local)
6. Managed policy settings
7. Skill/agent frontmatter

## Architecture Decision: HTTP (Direct)

Termaude runs a lightweight HTTP server on `127.0.0.1:7878`. Hooks use the `http` handler type to POST events directly — no shell script, no state files, no polling.

**Why HTTP over file-based:**
- **Instant** — sub-millisecond delivery, no filesystem latency or polling interval
- **No script to deploy** — the `http` hook type is built into Claude Code, no bash/jq dependency
- **No state files to manage** — Termaude receives events in-process, updates the store directly
- **Simpler injection** — hooks in settings.json are just a URL, easy to identify and update

**Tradeoff:** If Termaude isn't running, hooks fail silently (`async: true` so Claude doesn't care). When Termaude starts, cards show "closed" until the next hook fires. This is acceptable — the user is looking at the board, which means Termaude is running.

### Hook Identification

Since we use `http` type with a specific URL, identification is easy: any hook with `url` containing `127.0.0.1:7878` is ours. No command-path matching needed.

## Safely Injecting Hooks

### The Problem

Termaude needs to add hooks to `~/.claude/settings.json` without:
- Destroying the user's existing hooks
- Duplicating hooks on repeated setup
- Leaving orphaned hooks when Termaude is uninstalled

### Identification Strategy

Identify Termaude hooks by `url` field containing `127.0.0.1:7878`:

```json
{
  "type": "http",
  "url": "http://127.0.0.1:7878/hook",
  "timeout": 5
}
```

Any hook with `type: "http"` and `url` containing `127.0.0.1:7878` is ours.

### Injection Algorithm

```
1. Read ~/.claude/settings.json (create {} if missing)
2. Parse as JSON — abort on parse failure (don't touch corrupt files)
3. Backup to ~/.claude/settings.json.bak.{timestamp}
4. For each event we need (UserPromptSubmit, PreToolUse, Stop, Notification x2, StopFailure, SessionEnd, SessionStart):
   a. Get hooks[event] array (create if missing)
   b. Scan for existing Termaude entry (hook url contains "127.0.0.1:7878")
   c. If found: update in place
   d. If not found: append new entry to the array
5. Atomic write: write to tempfile, rename over original
6. File lock during entire read-modify-write (fs2 crate on Rust side)
```

### Removal Algorithm

```
1. Read ~/.claude/settings.json
2. For each event type in hooks:
   a. Filter out entries where any hook url contains "127.0.0.1:7878"
   b. Remove empty arrays
3. Atomic write
```

### Safety Guarantees

- **File locking** during read-modify-write (`fs2::FileExt::lock_exclusive`)
- **Atomic rename** from tempfile (prevents partial writes)
- **Timestamped backups** before every write
- **Parse validation** before and after modification
- **Never touch files that fail JSON parse** — surface error to user
- **Idempotent** — running setup twice produces identical result

### Settings Hot Reload

Evidence is mixed on whether Claude Code watches the settings file during a running session. To be safe: hooks should be injected before the Claude session starts, or the user should be advised to restart their session after hook setup.

## What Termaude Hooks Look Like in settings.json

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "Notification": [{
      "matcher": "idle_prompt",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "Notification": [{
      "matcher": "permission_prompt",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "StopFailure": [{
      "matcher": "",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }],
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "http",
        "url": "http://127.0.0.1:7878/hook",
        "timeout": 5
      }]
    }]
  }
}
```

Note: Notification has two separate entries (idle_prompt and permission_prompt) since we need to distinguish them. All hooks use the same URL — Termaude's HTTP server parses `hook_event_name` from the POST body to determine the state.

No `async` field needed for `http` type — HTTP hooks are non-blocking by default. The full event JSON (including `session_id`, `hook_event_name`, tool info, etc.) is POSTed as the request body.

## Product Feature: What This Enables

### Card Status (Real-Time)

Cards on the board update in real-time without opening the terminal:

```
┌───────────────────────────┐
│  auth-fix              ●  │  ← green pulse: Claude is working
│  ~/sites/termaude         │
│                           │
│  > Reading src/auth.ts    │  ← preview shows current activity
│  > Analyzing patterns...  │
│                           │
│  working · 12s ago        │
└───────────────────────────┘

┌───────────────────────────┐
│  frontend              ●  │  ← blue: waiting for your input
│  ~/sites/web              │
│                           │
│  > Done. What's next?     │
│                           │
│  waiting · 2m ago         │
└───────────────────────────┘

┌───────────────────────────┐
│  api-migration         ●  │  ← amber: needs permission
│  ~/sites/api              │
│                           │
│  > Allow Edit to          │
│  > src/db/schema.ts?      │
│                           │
│  permission · just now    │
└───────────────────────────┘
```

### Notification Priority

Sessions needing attention (permission prompt, error) could:
- Sort to the top of their column
- Show a badge/count on the column header
- Trigger a system notification (macOS Notification Center)

### Summary Stats

The title bar could show: `3 running · 1 waiting · 1 needs permission`

## Command Palette: Install/Uninstall Hooks

The quick-switch overlay (`Cmd+K`) doubles as a command palette. When the input starts with `>`, it switches from session search to command mode (same pattern as VS Code).

### UX Flow

```
┌────────────────────────────────────────┐
│  ⌘K  Commands                          │
├────────────────────────────────────────┤
│  > install                             │
│                                        │
│  > Install Claude Hooks                │  ← highlighted
│    Set up session state tracking        │
│                                        │
│  > Uninstall Claude Hooks              │
│    Remove Termaude hooks from Claude    │
│                                        │
│  > Rescan Projects                     │
│    Refresh the project directory index  │
│                                        │
└────────────────────────────────────────┘
```

**Typing `>` in quick-switch** switches to command mode. Commands are fuzzy-filtered as you type. Enter executes the highlighted command.

### Available Commands

| Command | Action |
|---|---|
| Install Claude Hooks | Injects Termaude hooks into `~/.claude/settings.json`. Creates `~/.termaude/hooks/state-reporter.sh`. Shows confirmation with what was added. |
| Uninstall Claude Hooks | Removes all Termaude hooks from `~/.claude/settings.json`. Cleans up `~/.termaude/hooks/`. Shows confirmation. |
| Rescan Projects | Re-runs the project directory index scan. |

### Install Flow (Detail)

1. User types `>install` in `Cmd+K`, selects "Install Claude Hooks"
2. Termaude checks if hooks are already installed (scans settings.json for commands containing `termaude`)
3. If already installed: show "Hooks already installed ✓" inline, no action
4. If not installed:
   a. Create `~/.termaude/hooks/state-reporter.sh` (the hook script)
   b. Backup `~/.claude/settings.json` to `~/.claude/settings.json.bak.{timestamp}`
   c. Read, parse, merge hooks, atomic write
   d. Show confirmation: "Hooks installed ✓ — restart running Claude sessions to activate"
5. Palette closes after confirmation

### Uninstall Flow (Detail)

1. User types `>uninstall`, selects "Uninstall Claude Hooks"
2. Termaude scans settings.json for its hooks
3. If no hooks found: show "No hooks to remove" inline
4. If found:
   a. Backup settings.json
   b. Remove all hook entries with commands containing `termaude`
   c. Clean up empty arrays/objects in the hooks config
   d. Atomic write
   e. Remove `~/.termaude/hooks/` directory
   f. Show confirmation: "Hooks removed ✓"

### Status Indicator

The title bar shows hook status so the user always knows:

```
Termaude · hooks active        ← green, hooks installed and state files updating
Termaude · hooks not installed ← muted, no hooks detected
```

On first launch, if hooks aren't installed, show a subtle one-time prompt at the top of the board:

```
┌──────────────────────────────────────────────────────────────┐
│  Install Claude hooks for real-time session status?          │
│  Cards will show working/waiting/permission states.          │
│                                                              │
│  [Install]  [Dismiss]                      ⌘K > install     │
└──────────────────────────────────────────────────────────────┘
```

Dismissing remembers the choice (stored in app settings). The user can always install later via `Cmd+K > install`.

## Implementation Order

1. **Start HTTP server in Rust backend** — listen on `127.0.0.1:7878`, parse POST body, emit events to frontend
2. **Build hook injection in Rust** — safe read-modify-write of `~/.claude/settings.json` with locking and backups
3. **Add Tauri commands** — `install_hooks`, `uninstall_hooks`, `check_hooks_status`
4. **Map hook events to session state** — receive events from HTTP server, match `session_id` to Termaude sessions, update store
5. **Extend quick-switch** — `>` prefix switches to command mode, wire up install/uninstall/rescan
6. **Update card UI** — new status states (working, waiting, permission), new colors, labels
7. **First-run prompt** — check hook status on launch, show install banner if missing
8. **Title bar status** — show "hooks active" / "hooks not installed"

## Decisions Made

- **Notification matcher**: Two separate entries (idle_prompt and permission_prompt) for safety
- **HTTP hooks**: `http` type hooks are non-blocking by default, 5s timeout is sufficient
- **Session UUID matching**: Claude receives `--session-id <uuid>` from Termaude, hook events include that same UUID in `session_id` field — direct match to Termaude's `claudeSessionId`
- **Hook setup timing**: Advise user to restart running Claude sessions after hook install. New sessions pick them up automatically.
- **Architecture**: Direct HTTP, no shell scripts, no state files. Termaude's Rust backend is the hook server.
