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

## Recommended Architecture for Termaude

### Option A: File-based State (Simplest)

Hook commands write the session state to a known file. Termaude watches the file.

```
~/.termaude/state/<session-uuid>.json
```

Contents:
```json
{
  "state": "waiting",
  "timestamp": 1717000000000,
  "event": "Stop",
  "sessionId": "uuid"
}
```

**Hook script** (`~/.termaude/hooks/state-reporter.sh`):
```bash
#!/bin/bash
# Read event JSON from stdin
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')

# Map event to state
case "$EVENT" in
  UserPromptSubmit) STATE="running" ;;
  PreToolUse) STATE="running" ;;
  Stop) STATE="waiting" ;;
  Notification) STATE="waiting" ;;  # refine by matcher
  StopFailure) STATE="error" ;;
  SessionEnd) STATE="ended" ;;
  *) STATE="unknown" ;;
esac

# Write state file
mkdir -p ~/.termaude/state
echo "{\"state\":\"$STATE\",\"timestamp\":$(date +%s%3N),\"event\":\"$EVENT\",\"sessionId\":\"$SESSION_ID\"}" \
  > ~/.termaude/state/"$SESSION_ID".json
```

**Termaude** polls or watches `~/.termaude/state/` for changes and updates card status.

### Option B: HTTP-based (More Responsive)

Termaude runs a tiny HTTP server on localhost. Hooks POST state changes to it.

```json
{
  "type": "http",
  "url": "http://127.0.0.1:7878/hook",
  "timeout": 5,
  "async": true
}
```

**Pros**: Instant updates, no file polling, Termaude gets the full event JSON.
**Cons**: Requires Termaude to run an HTTP server, port conflicts, hooks fail if Termaude isn't running.

### Option C: Hybrid (Recommended)

Use HTTP when Termaude is running, file-based as fallback:

```bash
#!/bin/bash
INPUT=$(cat)
# Try HTTP first (fast, real-time)
echo "$INPUT" | curl -s -X POST -d @- http://127.0.0.1:7878/hook 2>/dev/null && exit 0
# Fallback to file-based
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
# ... write to file as in Option A
```

## Safely Injecting Hooks

### The Problem

Termaude needs to add hooks to `~/.claude/settings.json` without:
- Destroying the user's existing hooks
- Duplicating hooks on repeated setup
- Leaving orphaned hooks when Termaude is uninstalled

### Identification Strategy

No `id` or `name` field exists on hooks. Identify Termaude hooks by the command path:

```json
{
  "type": "command",
  "command": "~/.termaude/hooks/state-reporter.sh",
  "timeout": 10,
  "async": true
}
```

Any hook whose `command` contains `termaude` or starts with `~/.termaude/` is ours.

### Injection Algorithm

```
1. Read ~/.claude/settings.json (create {} if missing)
2. Parse as JSON — abort on parse failure (don't touch corrupt files)
3. Backup to ~/.claude/settings.json.bak.{timestamp}
4. For each event we need (UserPromptSubmit, PreToolUse, Stop, Notification, StopFailure, SessionEnd):
   a. Get hooks[event] array (create if missing)
   b. Scan for existing Termaude entry (command contains "termaude")
   c. If found: update in place
   d. If not found: append new entry to the array
5. Atomic write: write to tempfile, rename over original
6. File lock during entire read-modify-write (fs2 crate on Rust side)
```

### Removal Algorithm

```
1. Read ~/.claude/settings.json
2. For each event type in hooks:
   a. Filter out entries where any hook command contains "termaude"
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

## What Termaude Hooks Would Look Like

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }],
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }],
    "Notification": [{
      "matcher": "idle_prompt|permission_prompt",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }],
    "StopFailure": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }],
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "~/.termaude/hooks/state-reporter.sh",
        "timeout": 5,
        "async": true
      }]
    }]
  }
}
```

All hooks use the same script. The script reads `hook_event_name` from stdin JSON to determine the state. All are `async: true` so they don't slow down Claude.

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

## Implementation Order

1. **Write the state-reporter.sh script** — pure bash, reads stdin JSON, writes state files
2. **Build hook injection in Rust** — safe read-modify-write with locking and backups
3. **Add a Tauri command** to inject/remove hooks (`setup_hooks` / `remove_hooks`)
4. **Watch state files from frontend** — Tauri file watcher or polling, update session store
5. **Update card UI** — new status colors, "working"/"waiting"/"permission" labels
6. **First-run UX** — on app launch, check if hooks are installed, prompt to set up
7. **HTTP server (v2)** — for instant state updates without polling

## Open Questions

- **Notification matcher**: Can `idle_prompt|permission_prompt` be a single matcher entry, or do we need two separate entries? The docs show regex-style matchers but examples are single values.
- **async behavior**: Do `async: true` hooks run in a fire-and-forget manner, or does Claude wait for them with a timeout? Need to verify this doesn't add latency to Claude's response loop.
- **Multiple Claude sessions**: If the user has 5 Claude sessions, all write to different state files (keyed by session UUID). Termaude must match Claude session UUIDs to its own session registry.
- **Hook setup timing**: If hooks are added while a Claude session is already running, does it pick them up? Or must the session be restarted?
