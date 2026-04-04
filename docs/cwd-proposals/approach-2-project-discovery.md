# Approach 2: Automatic Project Discovery

## The Idea

Termaude silently indexes your filesystem for project roots and presents them as a searchable list inline -- like Spotlight, but it only knows about your code. You type a session name, hit Tab, and your projects appear. No configuration. No typing paths. Just fuzzy-match the project you want.

The genius: Termaude already knows where your code lives before you ask.

---

## How Discovery Works

### What Counts as a "Project"

A directory is a project root if it contains any of these markers:

| Marker | Ecosystem |
|---|---|
| `.git/` | Any git repo |
| `package.json` | Node/JS |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml` | Python |
| `Gemfile` | Ruby |
| `*.xcodeproj/` | iOS/macOS |
| `build.gradle` | JVM |
| `flake.nix` | Nix |

The scan only looks for these markers at the top level of each directory. It does not read file contents -- just checks for existence. This keeps the scan fast.

### Scan Strategy

**First launch:** A background scan starts immediately after the app opens. It walks common project root directories in priority order:

1. `~/Developer`, `~/dev`, `~/projects`, `~/repos`, `~/src`, `~/code`, `~/Sites`, `~/sites`, `~/workspace` -- shallow scan (depth 2)
2. `~/` -- depth 2, skipping known non-project dirs (`Library`, `Applications`, `.Trash`, `node_modules`, `.cache`, `Pictures`, `Music`, `Downloads`, etc.)
3. `/opt/homebrew`, `/usr/local/src` -- depth 1 (catches system-level projects)

The scan is IO-bound, not CPU-bound. On a typical dev machine with ~50-200 projects, the initial scan completes in under 2 seconds. Results are cached to `~/.config/termaude/projects.json`.

**Subsequent launches:** Load cached results instantly. Background rescan runs 30 seconds after launch so the UI is never blocked. Any new projects appear silently.

**Filesystem watcher:** After the initial scan, watch the top-level project directories (the ~10 common roots) for new subdirectories. When a new directory appears, check for project markers. This catches `git clone` instantly.

### The Index

```json
{
  "version": 1,
  "scanned_at": "2026-04-03T14:22:00Z",
  "projects": [
    {
      "name": "termaude",
      "path": "/Users/alex/sites/termaude",
      "markers": [".git", "package.json"],
      "last_opened": "2026-04-03T12:00:00Z",
      "open_count": 14
    },
    {
      "name": "api-server",
      "path": "/Users/alex/work/api-server",
      "markers": [".git", "Cargo.toml"],
      "last_opened": null,
      "open_count": 0
    }
  ]
}
```

The `last_opened` and `open_count` fields are updated each time a project is selected. This powers the ranking: recently and frequently used projects float to the top.

---

## UX Flow

### Step 1: User Clicks "+ New Session"

The inline input appears, exactly as it does today. Nothing changes for the "just type a name" path -- type `auth-fix`, hit Enter, session starts in `~`. Zero friction added.

```
┌─ ACTIVE (2) ─────────────── ▾ ┐
│                                │
│  ┌────────────────────────┐    │
│  │  auth-fix            ●  │    │
│  └────────────────────────┘    │
│                                │
│  ┌────────────────────────┐    │
│  │  frontend            ●  │    │
│  └────────────────────────┘    │
│                                │
│  ┌──────────────────────────┐  │
│  │  _                       │  │  <-- cursor, empty input
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

### Step 2: User Types a Name, Then Hits Tab

Tab is the trigger. It means "I've named my session, now let me pick where." The input splits into two visual zones: the locked-in name on the left, and a project picker that appears below.

```
│  ┌──────────────────────────┐  │
│  │  auth-fix  Tab  _        │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  Recent                  │  │
│  │                          │  │
│  │  > termaude              │  │  <-- highlighted (most recent)
│  │    ~/sites/termaude      │  │
│  │                          │  │
│  │    api-server            │  │
│  │    ~/work/api-server     │  │
│  │                          │  │
│  │    dotfiles              │  │
│  │    ~/dotfiles            │  │
│  │                          │  │
│  │  5 more projects...      │  │
│  └──────────────────────────┘  │
```

The dropdown is compact. Each row shows the project name (bold/primary text) and the full path below it (muted, secondary). The list is sorted by recency, then frequency. On first use when there is no history, it sorts alphabetically.

### Step 3: User Filters by Typing

Typing in the picker filters the list with fuzzy matching. You never need more than 2-3 characters.

```
│  ┌──────────────────────────┐  │
│  │  auth-fix  Tab  ter_     │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │                          │  │
│  │  > termaude              │  │  <-- match
│  │    ~/sites/termaude      │  │
│  │                          │  │
│  │    terraform-infra       │  │  <-- match
│  │    ~/work/terraform-...  │  │
│  │                          │  │
│  └──────────────────────────┘  │
```

Fuzzy matching works on both the project name and the path. Typing `api` matches a project named `api-server` at `~/work/api-server`. Typing `work/api` also matches.

### Step 4: User Selects with Enter or Arrow Keys

- **Arrow keys** move the highlight.
- **Enter** confirms the selection. The session is created with the selected project as cwd.
- **Escape** dismisses the picker and returns to the plain input (the name is preserved).

After selection, the input briefly shows the resolved path, then the session is created:

```
│  ┌──────────────────────────┐  │
│  │  auth-fix  ~/sites/terma │  │  <-- confirmed, creating...
│  └──────────────────────────┘  │
```

### Alternative Entry: Just Type a Path

The existing path syntax (`auth-fix ~/sites/termaude`) still works. If the user types a `/` or `~` character after the session name, the project picker does not appear -- Termaude respects the explicit path. This is the escape hatch for directories that are not indexed projects.

### Alternative Entry: Skip the Name

Typing Tab with an empty name, or clicking a dedicated "Browse projects" affordance, opens the picker without a name. The session name is auto-derived from the project directory name, same as the current `~/sites/termaude` -> `termaude` behavior.

---

## Detailed Mockup: The Project Picker

```
┌──────────────────────────────────────┐
│  auth-fix  Tab  _                    │  <-- input field
├──────────────────────────────────────┤
│                                      │
│  RECENT                              │  <-- section header, 10px uppercase
│                                      │
│  > termaude                      JS  │  <-- row: name + ecosystem badge
│    ~/sites/termaude                  │      highlighted row has accent bg
│                                      │
│    api-server                  Rust  │
│    ~/work/api-server                 │
│                                      │
│    mobile-app                 Swift  │
│    ~/work/mobile-app                 │
│                                      │
│  ALL PROJECTS                        │  <-- section divider
│                                      │
│    blog                          JS  │
│    ~/sites/blog                      │
│                                      │
│    dotfiles                          │
│    ~/dotfiles                        │
│                                      │
│    infra                         Go  │
│    ~/work/infra                      │
│                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Tab: pick project  Esc: dismiss     │  <-- footer hint
│  Enter path manually: type ~/...     │
└──────────────────────────────────────┘
```

### Visual Treatment

- The picker is a dropdown panel attached directly below the input field.
- Background: Surface 2 (`#1c1c1c`) with the floating shadow from the design system.
- Highlighted row: accent background tint (`rgba(124, 106, 239, 0.08)`) with accent left border.
- Ecosystem badges are tiny, muted, pill-shaped labels (e.g., `JS`, `Rust`, `Go`, `Py`). They help distinguish projects with similar names.
- Max height: 320px (roughly 6-7 visible rows). Scrollable beyond that.
- The picker appears with a 120ms ease-out fade, matching the command palette timing.

---

## Keyboard Flow Summary

| Action | Keys | Result |
|---|---|---|
| Type name, hit Enter | `auth-fix` `Enter` | Session in `~` (unchanged behavior) |
| Type name, hit Tab | `auth-fix` `Tab` | Opens project picker |
| Filter projects | (type while picker is open) | Fuzzy filters the list |
| Navigate list | `Up` / `Down` | Move highlight |
| Select project | `Enter` | Create session with selected cwd |
| Dismiss picker | `Esc` | Close picker, keep name |
| Type path manually | `auth-fix ~/foo` `Enter` | Bypass picker entirely |

Total keystrokes for the common case: `auth` `Tab` `ter` `Enter` -- 10 keystrokes to create a session named "auth" in `~/sites/termaude`. Compare to the current `auth ~/sites/termaude` which is 22 keystrokes and requires you to remember the exact path.

---

## Edge Cases

### First Use (Empty Index)

On first launch, the background scan begins immediately. Two scenarios:

1. **Scan finishes before user hits Tab** (likely -- takes <2s): Projects appear normally.
2. **User hits Tab before scan completes**: Show a single-line loading state:

```
│  ┌──────────────────────────┐  │
│  │  Scanning for projects...│  │
│  │  ████████░░░░  45%       │  │
│  │                          │  │
│  │  Found so far:           │  │
│  │  > termaude              │  │
│  │    ~/sites/termaude      │  │
│  └──────────────────────────┘  │
```

Results stream in as they are discovered. The user can select from partial results without waiting. The progress bar is a thin accent-colored line at the top of the picker, not a spinner -- it communicates "working" without blocking interaction.

### Thousands of Repos (Power Users, Monorepo Mirrors)

The scan respects depth limits (max depth 2 from roots, depth 1 from `~`), which naturally caps discovery. But some users will have 500+ repos.

Mitigations:
- **Fuzzy search is the primary interface**, not scrolling. Even with 2000 projects, typing 2-3 characters narrows to <10 results.
- **Recency sorting** means the 5-10 projects you actually use are always at the top.
- The full list only shows the first 50 items. A muted footer says `+247 more -- type to filter`.
- The index file is a flat JSON array. At 2000 entries it is ~200KB -- trivial to load and search.

### External Drives / Non-Standard Locations

By default, only `~` and a few system paths are scanned. Users can add custom scan roots in settings:

```
Settings > Projects > Scan directories
  ~/sites          (built-in)
  ~/Developer      (built-in)
  /Volumes/Work    (custom)
  ~/company/repos  (custom)
```

The settings UI is a simple list with an "Add directory" button. Added directories are scanned on next background refresh.

### Nested Monorepos

A monorepo like `~/work/platform` might contain 30 sub-packages, each with their own `package.json`. The scanner uses a simple rule: **stop descending once you find a `.git/` directory.** The git root is the project. Individual packages inside a monorepo are not indexed as separate projects.

This is correct for the 90% case. If a user wants to start a session in `~/work/platform/packages/auth`, they can:

1. Select `platform` from the picker, then manually edit the path (future enhancement: sub-path completion within a selected project).
2. Type the path manually: `auth-fix ~/work/platform/packages/auth`.

A future enhancement could show expandable sub-entries for monorepos, but this is not necessary for the initial implementation.

### Project Name Collisions

Multiple projects might share the same name (e.g., two repos both called `api`). The picker disambiguates by always showing the full path on the second line. When filtering produces collisions, the path is the tiebreaker:

```
│  > api                               │
│    ~/work/company-a/api              │
│                                      │
│    api                               │
│    ~/work/company-b/api              │
```

### Directory No Longer Exists

The cached index may reference directories that have been deleted or moved. When a project is selected, Termaude validates the path exists before creating the session. If it does not exist:

- Show an inline error: `Directory not found. Rescan?`
- Offer to remove the stale entry and trigger a rescan.
- Never silently create a session in a non-existent directory.

---

## How the Fast Path is Preserved

This is critical. The project picker is **additive** -- it does not change the default behavior at all.

| Input | Behavior | Changed? |
|---|---|---|
| `auth-fix` `Enter` | Session named "auth-fix" in `~` | No |
| `auth-fix ~/path` `Enter` | Session in `~/path` | No |
| `~/path` `Enter` | Session named from path | No |
| `!shell` `Enter` | Raw shell session | No |
| `auth-fix` `Tab` | **New**: opens project picker | Added |

Tab is a dead key in the current input (it does nothing useful). Repurposing it for project discovery adds a new capability without touching existing flows. Users who never hit Tab will never see the picker.

---

## Pros

- **Zero configuration on first use.** It just works. No setup wizard, no "add your project directories" step.
- **Extremely fast common case.** Name + Tab + 2 chars + Enter. Under a second for an experienced user.
- **Learns your habits.** Recency and frequency sorting means the list gets better the more you use it.
- **No new UI paradigm.** It is a dropdown attached to an input field -- the same pattern as every autocomplete in every developer tool.
- **Discoverable but not intrusive.** The Tab hint can appear as ghost text in the input placeholder: `name Tab to pick project...`
- **Path validation built in.** Selecting from the picker guarantees the directory exists. Eliminates the typo problem entirely.

## Cons

- **Initial scan latency.** First launch has a 1-3 second window where the picker is empty or incomplete. Mitigated by streaming results.
- **Filesystem scanning feels "magic."** Some users may be uncomfortable with the app indexing their home directory. Mitigated by making scan roots visible and configurable in settings.
- **Monorepo sub-packages are not first-class.** Users who routinely work in subdirectories of a monorepo will still need to type paths for those cases.
- **Tab key overloading.** Some users may expect Tab to autocomplete the path (shell-style). The picker is a different mental model. Mitigated by the placeholder hint and by still supporting manual path typing.
- **Stale cache.** If a user clones a repo and immediately tries to create a session, the new repo may not be indexed yet (fs watcher mitigates this, but there is a race window).
- **Privacy-adjacent concern.** The projects index on disk reveals the user's project structure. It should not be synced or shared.

---

## Why This is the Right Approach

The core insight: developers don't think in paths. They think in project names. You don't say "I need to work in `/Users/alex/work/company/services/auth-service`." You say "I need to work in auth-service."

Every other tool that deals with project directories -- VS Code's recent projects, JetBrains' project list, `z`/`zoxide` in the shell -- has converged on the same solution: build an index, rank by usage, fuzzy search. Termaude should do the same, but with the advantage of being purpose-built for session creation rather than retrofitted.

The Tab trigger is the key design choice. It means the discovery layer is always one keystroke away but never in the way. It turns the input into a two-phase interaction -- name first, location second -- which matches how developers actually think about creating a work session.
