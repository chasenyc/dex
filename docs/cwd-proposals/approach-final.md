# Final Approach: Ghost Inference + Tab Override

## Summary

Combines the implicit intelligence of Approach 4 with the Tab-to-expand safety net of Approach 3. The user types a session name, sees a ghost line showing where Termaude thinks it should run, and presses Enter. When the inference is wrong, Tab opens an inline directory picker. The existing `name ~/path` power-user syntax still works as an escape hatch.

---

## The Spaces Problem

The current input parser uses "space followed by `~/` or `/`" to split name from path. This means:

- `auth fix` → name is "auth", "fix" is lost
- `my cool project` → name is "my", rest is lost
- `auth fix ~/sites/foo` → name is "auth", "fix ~/sites/foo" is ambiguous

**New rule: the name is the entire input.** The input field is *only* for the session name. The directory is never typed in the same field — it's either inferred (ghost text) or selected (Tab picker). This eliminates the parsing ambiguity entirely.

| Input | Name | CWD |
|---|---|---|
| `auth fix` | "auth fix" | inferred from ghost text |
| `my cool project` | "my cool project" | inferred from ghost text |
| `termaude` | "termaude" | `~/sites/termaude` (name matched a project) |
| `!my shell` | "my shell" | `~` (shell session) |

The `!` prefix for shell sessions still works — it's stripped from the front, everything after is the name.

**What about the power-user `name ~/path` syntax?** It goes away. It was a workaround for not having a directory picker. With ghost text + Tab picker, there's a better way. If someone types a path-looking string as a name (e.g., `~/sites/foo`), treat it as a name literally — the ghost text will show the inferred directory anyway. This avoids all ambiguity.

---

## UX Flow

### Step 1: Input appears

User clicks "+ New Session". Single-line input appears at the bottom of the column. Placeholder reads:

```
session name...
```

Clean. No hints about paths or Tab or shortcuts. Just a name field.

### Step 2: User types, ghost text appears

As the user types, a ghost line appears below the input showing the inferred working directory.

```
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
╎ termaude█                     ╎
╎ ~/sites/termaude               ╎  ← ghost text, #555, 11px
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

The ghost text updates in real-time as the user types. It reflects the current best inference.

**Inference sources (in priority order):**

1. **Exact project name match** — if "termaude" matches `~/sites/termaude` in the project index, show it. High confidence.
2. **Column consensus** — if 2+ sibling sessions in this column share a cwd, use it. High confidence.
3. **Recency** — the most recently used cwd across all sessions. Low confidence.
4. **Fallback** — `~`. Always works.

**Confidence display:**

- High confidence: ghost text in `#666` (readable but muted)
- Low confidence: ghost text in `#444` with trailing `?`
- No match: just `~`

```
╎ termaude█                     ╎
╎ ~/sites/termaude               ╎  ← high confidence, solid

╎ bugfix█                       ╎
╎ ~/sites/termaude ?             ╎  ← low confidence (column guess)

╎ scratch█                      ╎
╎ ~                              ╎  ← fallback, no context
```

### Step 3a: Enter — accept inference and create

User presses Enter. Session is created with the displayed ghost directory. Done. One input, one Enter.

If the ghost directory doesn't exist (stale index), flash the ghost text red briefly, and show `directory not found` in the ghost line. The input stays focused.

### Step 3b: Tab — open directory picker

User doesn't like the inferred directory. Presses Tab. The input transforms:

```
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
╎ termaude                      ╎  ← name locked in, becomes card title
╎ ┌──────────────────────────┐  ╎
╎ │ █                        │  ╎  ← directory search input
╎ └──────────────────────────┘  ╎
╎  ~/sites/termaude             ╎  ← currently inferred (highlighted)
╎  ~/sites/api-server           ╎
╎  ~/projects/mobile-app        ╎
╎  ~/work/platform              ╎
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

What happened:
- Name locks in as card title text (13px medium, primary color)
- A second input appears for directory search
- Below it, a list of directories: the inferred one first (highlighted), then recents, then all indexed projects
- The whole thing slides in with a 120ms ease-out — the card is "growing"

**Directory list sources:**
- The inferred directory (pre-highlighted)
- Recent directories from past sessions (frecency ranked)
- All indexed projects (alphabetical, below a divider)

**Typing in the directory input** fuzzy-filters the list. Typing `ter` narrows to `~/sites/termaude` and `~/work/terraform`. Arrow keys to navigate, Enter to select.

**Keyboard in directory picker:**

| Key | Action |
|---|---|
| Type | Fuzzy filter the list |
| Arrow Down/Up | Navigate list |
| Enter | Select highlighted directory, create session |
| Escape | Go back to name input (name preserved) |
| Backspace on empty | Go back to name input |

### Step 3c: Tab cycling (lightweight alternative)

For users who don't want the full picker, Tab also works as a simple cycle when the picker is NOT open. Each Tab press cycles the ghost text through alternatives:

```
╎ api█                          ╎
╎ ~/projects/api                 ╎  ← Tab 1: first match

╎ api█                          ╎
╎ ~/work/clients/api             ╎  ← Tab 2: second match

╎ api█                          ╎
╎ ~                              ╎  ← Tab 3: fallback

╎ api█                          ╎
╎ ~/projects/api                 ╎  ← Tab 4: wraps around
```

**How to distinguish Tab-cycle from Tab-open-picker?**

- **First Tab press** always cycles the ghost text to the next candidate
- **Second Tab press within 500ms** opens the full picker (double-tap to expand)
- Or: **Tab cycles**, **Shift+Tab opens the picker**

Either pattern works. The important thing is that a quick single Tab is the lightweight correction, and the picker is available but not forced.

*Recommendation: single Tab cycles, Cmd+Tab or down-arrow opens the picker. Keep it simple.*

Actually, simplest version: **Tab always opens the picker.** The ghost text already shows the inference. If it's wrong, you need the picker to find the right one — cycling through unknowns blindly isn't great UX. One behavior for Tab, no timing logic.

---

## The Project Index

Built and maintained on the Rust side. Scans on first launch, refreshes periodically.

### What gets indexed

Any directory containing a project marker:

| Marker | Ecosystem |
|---|---|
| `.git/` | Any git repo |
| `package.json` | Node/JS |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml` | Python |

### Scan locations (default)

```
~/              depth 1
~/sites/        depth 2
~/projects/     depth 2
~/code/         depth 2
~/repos/        depth 2
~/dev/          depth 2
~/work/         depth 2
~/Developer/    depth 2
~/src/          depth 2
~/Desktop/      depth 1
```

Skips: `node_modules`, `.cache`, `Library`, `Applications`, `.Trash`

### Timing

- First launch: background scan, streams results, completes in <2 seconds
- Subsequent launches: load cached index instantly, background rescan 30s after launch
- While running: rescan every 10 minutes
- Manual refresh available in settings

### Storage

```json
{
  "version": 1,
  "scannedAt": "2026-04-03T14:22:00Z",
  "projects": [
    { "name": "termaude", "path": "/Users/alex/sites/termaude" },
    { "name": "api-server", "path": "/Users/alex/work/api-server" }
  ]
}
```

Separate from the session registry. Small file (~50KB for 500 projects).

---

## Recency/Frequency Tracking

Stored alongside the session registry. Every time a session is created, the cwd is recorded with a timestamp.

```json
{
  "cwdHistory": [
    { "path": "~/sites/termaude", "count": 14, "lastUsed": "2026-04-03T12:00:00Z" },
    { "path": "~/work/api-server", "count": 8, "lastUsed": "2026-04-02T09:15:00Z" }
  ]
}
```

Used for:
- Ranking the picker list (frecency)
- Breaking ties when multiple projects match a name
- Powering the "recents" section in the picker

---

## Full Keyboard Flow Summary

| Input State | Enter | Tab | Escape |
|---|---|---|---|
| Name input (ghost visible) | Create session with ghost cwd | Open directory picker | Cancel, close input |
| Directory picker open | Select highlighted, create session | (no-op) | Back to name input |

---

## Edge Cases

### First use (no history, no index yet)

Ghost text shows `~` for everything. The picker shows whatever the background scan has found so far (streamed in). Within 2 seconds the full index is available. Worst case: user creates a session in `~` and the next session benefits from the now-complete index.

### Name with spaces

`my cool project` is the name. Ghost text infers directory as usual. No parsing issues because the name IS the entire input — there's no delimiter to confuse.

### Shell sessions

`!my debug shell` → type is "shell", name is "my debug shell". Ghost text shows `~` (no inference for shell sessions, or same inference logic applies). Tab opens picker if they want a specific directory.

### Monorepo subdirectories

The index finds `~/work/platform` (the git root). The user wants `~/work/platform/packages/auth`. The ghost text shows `~/work/platform`. They press Tab, type `auth` in the picker, and... it's not there because the index only has the git root.

**Solution:** When a project is selected in the picker, if it contains subdirectories with project markers, show a second-level list inline. Or: just let them type the subpath in the picker input and validate it exists. The picker input doubles as a path input when the text starts with `~/` or `/`.

### Wrong inference, user doesn't notice

The ghost text is visible but muted. A fast-typing user might press Enter without reading it. They end up in the wrong directory.

**Mitigation:** The card on the board shows the cwd. They see it immediately. Right-click → "Change directory" (future) or delete and recreate (available now).

**Stronger mitigation (future):** On first Enter, briefly flash the card's cwd in a slightly brighter color for 1 second, drawing the eye.

### Directory deleted since last index

Ghost text shows the stale path. User presses Enter. Backend validates — directory doesn't exist. Ghost text flashes red: `not found`. Session is not created. Index is updated to remove the stale entry. User presses Tab to pick a different directory.

---

## Pros

- **Zero-keystroke directory selection in the common case.** Type name, Enter. The inference handles it.
- **Spaces in names work naturally.** No parsing ambiguity. The input is just a name.
- **Ghost text is visible before committing.** The user always sees where they'll land. No surprises.
- **Tab picker is the safety net.** When inference is wrong, one keystroke gets you to a searchable list.
- **No new UI concepts on the fast path.** Just a muted line of text below the input. Barely there.
- **Self-improving.** Gets better with every session created. Column context is particularly powerful for users who organize by project.
- **Preserves simplicity.** The input looks like a simple name field. The complexity is hidden.

## Cons

- **Inference can be wrong.** Column context or name matching may guess incorrectly. Mitigated by ghost text visibility.
- **Project index requires filesystem scanning.** Adds Rust-side complexity. Must be fast and non-intrusive.
- **Power-user `name ~/path` syntax is removed.** Users who learned it must adapt to the Tab picker. Mitigated by the picker being faster for most cases.
- **Ghost text adds visual noise.** Users who never care about cwd see `~` below every input. Very muted, but present.
- **Cold start is weak.** First few sessions have no recency data or column context. Name matching helps if the project exists.

---

## Implementation Order

1. **Remove path parsing from input** — name is the entire input, support spaces
2. **Add ghost text UI** — muted line below input, starts as `~`
3. **Build project index** — Rust-side filesystem scan, cache to disk
4. **Wire inference** — name matching against index, column consensus, recency
5. **Build Tab picker** — inline directory search with recents and indexed projects
6. **Add frecency tracking** — record cwd usage, rank picker results
7. **Polish** — validation, error states, animations, confidence indicators
