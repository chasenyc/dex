# Approach 1: Smart Recent Directories

## The Core Idea

The input field stays exactly as it is today -- a single inline text input at the bottom of each column. But when the user starts typing, a small dropdown appears *below* the input showing directory suggestions ranked by a frecency algorithm (frequency + recency). The user never has to type a full path. They type a few characters of a project name, arrow-down to select, and hit Enter. The directory is filled in. Total keystrokes for a returning user: `auth Tab Enter`.

The genius is that it learns silently. No configuration. No setup. It just gets better the longer you use it.

---

## UX Flow

### Happy Path (Returning User)

1. User clicks "+ New Session" in a column. The inline input appears (same as today).
2. User types `auth` (the name of their session).
3. As they type, a dropdown appears below the input showing matching directories:

```
┌──────────────────────────────────────────┐
│ auth-fix                                 │
├──────────────────────────────────────────┤
│  ~/sites/termaude          ★ 12 uses     │  ← frecency rank 1
│  ~/sites/api-server        ★ 8 uses      │
│  ~/projects/auth-lib       ★ 3 uses      │
└──────────────────────────────────────────┘
```

4. User presses `Tab` or `Down Arrow` to select `~/sites/termaude`, then `Enter`.
5. Session "auth-fix" is created in `~/sites/termaude`.

Total interaction: type name, glance at suggestion, Tab, Enter. Under 2 seconds.

### Happy Path (Power User Who Knows the Path)

1. User types `auth-fix ~/sites/termaude` and presses Enter.
2. Works exactly like today. The dropdown appears but they ignore it. No slowdown.

### Happy Path (Just a Name, No Directory)

1. User types `quick-test` and presses Enter.
2. The dropdown shows suggestions, but the user ignores it. Session is created in `~` (default). Same as today.

### First Use (No History)

1. User clicks "+ New Session". Types a name.
2. The dropdown appears but shows *seed data* instead of history:
   - Directories containing a `.git` folder (scanned on first launch from common locations: `~`, `~/Desktop`, `~/Documents`, `~/projects`, `~/sites`, `~/code`, `~/dev`, `~/repos`, `~/src`, `~/work`)
   - Sorted alphabetically, since there's no usage data yet
3. Even on first use, the user sees real project directories without configuring anything.

```
┌──────────────────────────────────────────┐
│ my-first-session                         │
├──────────────────────────────────────────┤
│  ~/sites/termaude          .git          │  ← seeded from git scan
│  ~/sites/api-server        .git          │
│  ~/projects/blog           .git          │
│  ~/projects/dotfiles       .git          │
└──────────────────────────────────────────┘
```

---

## Detailed Interaction Design

### The Dropdown

The dropdown is a floating panel that appears directly below the input field. It follows the design system: `Surface 2` background (`#1c1c1c`), 8px border radius, subtle shadow for floating elements (`0 4px 24px rgba(0,0,0,0.5)`). Max 5 items visible, scrollable if more.

```
  Column
  ┌────────────────────────────────────────┐
  │                                        │
  │  ┌────────────────────────────────┐    │
  │  │  card                          │    │
  │  └────────────────────────────────┘    │
  │                                        │
  │  ┌────────────────────────────────────┐│
  │  │ fix-auth-bug                       ││ ← input (editing)
  │  └────────────────────────────────────┘│
  │  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
  │  ╎ ~/sites/termaude       ★ 12    [⏎] ╎│ ← highlighted (first)
  │  ╎ ~/sites/api-server     ★ 8         ╎│
  │  ╎ ~/projects/auth-lib    ★ 3         ╎│
  │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  │                                        │
  └────────────────────────────────────────┘
```

### Matching Logic

The dropdown filters directories using fuzzy matching against the *directory name* (last path segment) and the *full path*. This means:

- Typing `term` matches `~/sites/termaude` (directory name match)
- Typing `sites` matches `~/sites/termaude` and `~/sites/api-server` (path segment match)
- Typing `auth` matches `~/projects/auth-lib` (directory name match)

The matching is against directory names, NOT against the session name the user is typing. The dropdown watches the full input and tries to match any word against known directories. This means if the user types `fix-bug ~/sit`, the `~/sit` portion fuzzy-matches against paths.

But here is the key insight: **the dropdown also matches when the user has only typed a session name with no path**. If someone types `auth`, the dropdown shows directories that have been used for sessions with "auth" in their name, plus directories whose names fuzzy-match "auth". This is the "smart" part -- it correlates session names with directories over time.

### Keyboard Interaction

| Key | Action |
|---|---|
| Any character | Updates input, refreshes dropdown suggestions |
| `Tab` | Accepts the highlighted suggestion -- appends the path to the input |
| `Down Arrow` | Moves highlight down in dropdown |
| `Up Arrow` | Moves highlight up in dropdown |
| `Enter` (no selection) | Creates session with whatever is in the input (same as today) |
| `Enter` (with highlight) | Accepts highlighted suggestion and creates session |
| `Escape` | Closes dropdown first; second Escape closes the input |

**Critical detail:** `Tab` *appends* the directory to the input rather than replacing it. If the user has typed `auth-fix` and presses Tab on `~/sites/termaude`, the input becomes `auth-fix ~/sites/termaude`. This preserves the existing parse format and lets the user see exactly what will be submitted. They can then edit either part.

### When the Dropdown Appears

- The dropdown appears after the user has typed at least 1 character.
- If the input is empty, no dropdown (the user hasn't started yet).
- If there are no matching directories, the dropdown does not appear.
- The dropdown disappears when the input is submitted or dismissed.

### Visual Details

Each row in the dropdown shows:

```
  ~/sites/termaude          ★ 12
  ╰─ path (truncated)       ╰─ usage count (muted)
```

- Path text: 11px monospace, secondary color (`#888888`)
- Usage indicator: 10px Inter, muted (`#555555`). The star and count only appear for directories with history. Seeded directories show their source instead (e.g., `.git`).
- Highlighted row: `Surface 3` background (`#252525`), accent-colored left border (2px `#7c6aef`)
- Hover: `Surface 3` background

---

## The Frecency Algorithm

Directories are ranked by a frecency score that combines how often and how recently they were used.

```
score = frequency_points + recency_bonus

frequency_points = ln(use_count + 1) * 10

recency_bonus:
  used in last 1 hour    → 32
  used in last 6 hours   → 16
  used in last 1 day     → 8
  used in last 1 week    → 4
  used in last 1 month   → 2
  older                  → 0
```

This means:
- A directory you used 5 minutes ago will rank above one you used 50 times last month.
- But a directory you use daily will consistently outrank one you tried once yesterday.
- The logarithmic frequency curve prevents a single project from permanently dominating. Switching to a new project lets it climb the rankings quickly.

### Data Storage

A simple JSON file in the app's data directory:

```json
{
  "directories": {
    "~/sites/termaude": {
      "count": 12,
      "lastUsed": "2026-04-03T14:30:00Z",
      "sessionNames": ["auth-fix", "refactor", "tests", "ui-cleanup"]
    },
    "~/sites/api-server": {
      "count": 8,
      "lastUsed": "2026-04-02T09:15:00Z",
      "sessionNames": ["api-debug", "migration"]
    }
  },
  "seeded": true,
  "seedTimestamp": "2026-03-28T10:00:00Z"
}
```

The `sessionNames` array stores recent session names associated with each directory. This powers the "smart correlation" -- when a user types `api`, directories that have been used with "api"-related session names get a bonus in the ranking.

### Session Name Correlation Bonus

When filtering, if the typed text fuzzy-matches a previously used session name for a directory, that directory gets a +16 bonus to its score. This means:

- You type `auth`. You've previously created "auth-fix" and "auth-refactor" sessions in `~/sites/termaude`. That directory floats to the top even if its raw frecency is lower than another directory.
- This creates an associative memory: the app learns "when this user types 'auth', they usually mean this directory."

---

## Edge Cases

### First Launch (No History, No Git Repos)

If the scan finds zero `.git` directories in the common locations, the dropdown simply does not appear. The experience degrades to exactly what exists today. No empty states, no "configure your directories" prompts. Just the input.

### Monorepo with Many Sub-projects

A user working in a monorepo might have sessions in:
- `~/work/monorepo/packages/auth`
- `~/work/monorepo/packages/api`
- `~/work/monorepo/apps/web`
- `~/work/monorepo/apps/mobile`

The frecency algorithm handles this naturally -- each subdirectory is tracked independently. Typing `auth` matches the `auth` package. Typing `mono` matches all of them (parent path match). Typing `apps` narrows to the two app directories.

The initial git seed scan only finds the root `.git` folder, so on first use the user would see `~/work/monorepo` as a single entry. Once they manually specify a subdirectory for their first session, that subdirectory enters the history and appears in future suggestions. After a day of use, the dropdown knows all the subdirectories they actually work in.

**Enhancement for monorepos:** If a selected directory contains directories that themselves contain `package.json`, `Cargo.toml`, `go.mod`, or similar project markers, the seed scan could include those as separate entries. This is an optional enhancement, not required for MVP.

### Too Many Projects (50+ Directories)

The dropdown shows a maximum of 5 items. Frecency naturally surfaces the most relevant ones. Rarely-used directories sink to the bottom and eventually off-screen. The fuzzy search lets users filter to exactly what they need regardless of how many directories exist in history.

### Directory No Longer Exists

When a directory is selected from the dropdown, validate that it still exists before creating the session. If it does not:
- Show a brief inline error below the input: "Directory not found" in red (`#f87171`), 11px, fades after 3 seconds.
- Remove the directory from history automatically.
- Do not create the session.

### Typing a Full Path Manually

If the user types something that looks like a path (`~/...` or `/...`), the dropdown switches to *path completion* mode -- showing directories on disk that match the partially-typed path, like shell tab completion. This is a secondary behavior that coexists with the frecency dropdown.

```
┌──────────────────────────────────────────┐
│ fix-bug ~/si                             │
├──────────────────────────────────────────┤
│  ~/sites/                                │  ← filesystem completion
│  ~/sim-data/                             │
└──────────────────────────────────────────┘
```

Once they complete the path and create the session, that directory enters the frecency history for future use.

### Multiple Users / Shared Machine

Each user's frecency data is stored per-OS-user in the standard app data location (`~/Library/Application Support/termaude/` on macOS). No cross-contamination.

---

## How It Preserves the Fast Path

The critical constraint from the problem statement: "must not slow down the 'just type a name and go' happy path."

This approach preserves it completely:

1. **The dropdown is passive.** It appears but requires no interaction. If you type `quick-test` and hit Enter, the session is created in `~` exactly as it does today. The dropdown was there, but you never touched it.

2. **No mode switching.** There is no "directory picker" mode vs "name" mode. The input is always the same single-line text field. The dropdown is an enhancement layer, not a gate.

3. **No extra keystrokes for the default case.** Zero additional keystrokes if you don't need a directory. One additional keystroke (Tab) if you do.

4. **No popups, modals, or multi-step flows.** Everything happens inline, attached to the input the user is already focused on.

5. **Speed:** The dropdown renders from local data (a small JSON file). There is no async filesystem walk happening while you type. The initial seed scan happens once on first launch in the background.

---

## Pros

- **Zero configuration.** Works on first launch with git-repo seeding. Gets smarter with every session created.
- **Minimal UI addition.** A dropdown is the lightest possible affordance. It does not change the layout, add buttons, or require a new screen.
- **Learns user behavior.** The frecency algorithm combined with session-name correlation means the right directory surfaces faster over time. After a week of use, the first suggestion is almost always correct.
- **Preserves muscle memory.** Users who already type `name ~/path` keep doing exactly that. Power users are not disrupted.
- **Graceful degradation.** If the dropdown data is missing, corrupt, or empty, the input works exactly as it does today.
- **Validates before creating.** Catches typos and stale paths before they become broken sessions.
- **Discoverable without explanation.** A new user types a name, sees directories appear, and immediately understands what happened. No tutorial needed.

## Cons

- **Cold start problem.** The git-repo seed scan is imperfect. It only finds repos in common directories, might miss repos in unusual locations, and does not find non-git projects. The first few sessions may still require manual path entry.
- **Dropdown can feel noisy.** If you never need directories, the dropdown appearing on every keystroke could feel like clutter. Mitigation: the dropdown does not appear if there are zero matches, and it auto-hides when the input matches no known directories.
- **No visual browsing.** You cannot "explore" the filesystem from this UI. If you do not know the path at all and it is not in history, you have to type it or find it elsewhere. This approach optimizes for "I know where I work but don't want to type it every time" rather than "I need to find a new directory."
- **Monorepo first use is weak.** The seed scan finds the repo root but not subdirectories. The user has to manually specify subdirectories at least once before they enter the suggestion pool.
- **Frecency tuning.** The algorithm weights may need tuning based on real usage. The numbers above are starting points.

---

## Summary

The approach is: **keep the input exactly as it is, but make it autocomplete-aware.** A lightweight frecency-powered dropdown appears as the user types, showing directories they have used before (or, on first use, directories found by scanning for git repos). The user can ignore it entirely or accept a suggestion with a single Tab keystroke. The app learns from every session created, correlating session names with directories to make future suggestions increasingly accurate.

One input. One dropdown. Zero configuration. Gets smarter every day.
