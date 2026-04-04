# Approach 4: Implicit Context and Zero-Config Intelligence

## The Thesis

The best directory picker is no directory picker at all.

Most of the time, a developer creating a session named `auth-fix` already has context that tells us exactly where it should run. They have a project open, they are working in a repo, the session name itself contains clues. Instead of asking the user to type a path, Termaude should observe what it already knows and place the session in the right directory automatically -- then get out of the way.

The user types a name. The session starts in the right place. No path input, no file picker, no second step. When they glance at the card and see the correct `~/sites/termaude` beneath the title, the reaction should be: "How did it know?"

---

## The Intelligence Stack

Inference runs through a prioritized cascade. The first signal with high confidence wins. If nothing matches, fall back to `~` (the current behavior, which is already fine for throwaway sessions).

### Signal 1: Column Memory (highest confidence)

If a column already has sessions in it, those sessions share a context. A column called "Termaude" with three cards all running in `~/sites/termaude` tells us everything. A new session added to that column should default to the same directory.

**Rule:** If 2+ sessions in the target column share the same cwd, use that cwd for the new session.

### Signal 2: Name-to-Directory Matching

The session name itself is the strongest hint the user gives us. Termaude maintains a lightweight directory index -- a cached scan of project roots (any directory containing `.git`, `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc.) within a configurable search scope (default: `~/` one level, `~/sites/` and `~/projects/` two levels deep).

| User types | Matched directory | How |
|---|---|---|
| `termaude` | `~/sites/termaude` | Exact directory name match |
| `auth-fix` | `~/sites/termaude` | No direct match -- falls to next signal |
| `my-api` | `~/projects/my-api` | Exact directory name match |
| `api` | `~/projects/api` | Exact match preferred over substring |

**Rule:** If the session name exactly matches a project directory name, use it. Substring and fuzzy matches are not used automatically -- they are reserved for the confirmation hint (see below).

### Signal 3: Recency and Frequency

Termaude tracks which directories you have used in past sessions. If you have created 12 sessions in `~/sites/termaude` this week and 2 in `~/projects/api`, the former has a higher weight. Combined with a partial name match, recency can tip the balance.

**Rule:** If Signal 2 finds multiple exact matches (e.g., `api/` exists under both `~/sites/` and `~/projects/`), the most recently and frequently used one wins.

### Signal 4: Clipboard and Environment

When the user clicks "+ New Session," Termaude silently checks:
- The system clipboard for a file path or directory path
- The `PWD` of the most recently focused terminal session on the board

This is a weak signal -- it is never used automatically. But it can be surfaced as a suggestion (see the confirmation hint below).

### Signal 5: Fall back to `~`

If nothing matches with confidence, the session starts in `~`. This is the current behavior and it is fine. Not every session needs a specific directory.

---

## UX Flow: What the User Sees

### Happy Path (90% of sessions)

**Step 1:** User clicks "+ New Session" at the bottom of a column. The inline input appears, exactly as it does today.

```
 ┌─ ACTIVE (2) ─────────────── ┐
 │                              │
 │  ┌────────────────────────┐  │
 │  │  auth-fix            ● │  │
 │  │  ~/sites/termaude      │  │
 │  └────────────────────────┘  │
 │  ┌────────────────────────┐  │
 │  │  frontend            ● │  │
 │  │  ~/sites/termaude      │  │
 │  └────────────────────────┘  │
 │                              │
 │  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │
 │  ╎ my-api█               ╎  │
 │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
 └──────────────────────────────┘
```

**Step 2:** As the user types, a ghost line appears below the input showing where Termaude will place the session. This is not a dropdown, not a modal, not a separate field. It is a single muted line of text that appears inline.

```
 │  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │
 │  ╎ my-api█               ╎  │
 │  ╎ ~/projects/my-api      ╎  │  ← ghost text, muted (#555)
 │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
```

This ghost line updates in real-time as the user types. It shows the inferred directory. If no match is found, it shows `~`.

**Step 3:** The user presses Enter. Done. The session starts in `~/projects/my-api`. No second input, no confirmation dialog.

### When Inference Picks Up the Column Context

If both existing sessions in the "Active" column are in `~/sites/termaude`, and the user types a name that does not match any project directory:

```
 │  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │
 │  ╎ refactor-auth█        ╎  │
 │  ╎ ~/sites/termaude       ╎  │  ← inferred from column context
 │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
```

The name `refactor-auth` did not match any directory, but the column context was strong enough. The ghost text shows where it will go.

### When Nothing Matches

```
 │  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │
 │  ╎ scratch█              ╎  │
 │  ╎ ~                      ╎  │  ← fallback, no context available
 │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
```

The user sees `~` and knows they will land in home. If they want somewhere specific, the existing manual override still works: type `scratch ~/sites/termaude` and the ghost text updates accordingly.

---

## Override Mechanism: Tab to Cycle

If the inference is wrong, the user does not need to clear the input and type a path. Instead:

**Tab** cycles through alternative inferred directories. The ghost text updates with each press.

```
 │  ╎ api█                  ╎  │
 │  ╎ ~/projects/api         ╎  │  ← first guess (most recent)
```
Press Tab:
```
 │  ╎ api█                  ╎  │
 │  ╎ ~/work/clients/api     ╎  │  ← second candidate
```
Press Tab again:
```
 │  ╎ api█                  ╎  │
 │  ╎ ~                      ╎  │  ← fallback
```
Press Tab again:
```
 │  ╎ api█                  ╎  │
 │  ╎ ~/projects/api         ╎  │  ← wraps around
```

The Tab key is natural here because the input only accepts a single token (the session name). There is no "next field" to tab to, so the key is free.

**Manual override** still works exactly as before: typing a space and a path takes full control. When a manual path is present, inference is suppressed and the ghost text just reflects what the user typed.

```
 │  ╎ api ~/work/other█     ╎  │
 │  ╎ ~/work/other           ╎  │  ← manual, no inference
```

---

## The Directory Index

On first launch (and periodically after), Termaude builds a lightweight index of project directories. This runs in the background and takes less than a second for typical machines.

### Default scan locations

```
~/           (depth 1 -- direct children only)
~/sites/     (depth 2)
~/projects/  (depth 2)
~/code/      (depth 2)
~/repos/     (depth 2)
~/dev/       (depth 2)
~/work/      (depth 2)
~/src/       (depth 2)
~/.config/   (depth 1 -- for dotfile repos)
```

Only directories containing a project marker are indexed: `.git`, `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `Makefile`, `.project`, `pom.xml`.

### User configuration

Users can add or remove scan paths in settings:

```json
{
  "directoryIndex": {
    "paths": [
      { "path": "~/sites", "depth": 2 },
      { "path": "~/company/repos", "depth": 3 }
    ],
    "exclude": ["node_modules", ".cache", "vendor"]
  }
}
```

### Index persistence

The index is a flat JSON file cached on disk. It refreshes on app launch, when the user opens the settings panel, and every 10 minutes while the app is running. A manual "refresh index" button exists in settings but is almost never needed.

---

## Detailed Signal Resolution

When the user types `api` into the input and presses Enter, the resolution runs in this order:

```
1. Manual path present?          → "api ~/foo" → use ~/foo           DONE
2. Exact name match in index?    → ~/projects/api exists?
   a. Single match?              → use it                            DONE
   b. Multiple matches?          → pick by recency/frequency         DONE
3. Column consensus?             → 2+ siblings share cwd?
   a. Yes?                       → use that cwd                      DONE
4. Most recent session cwd?      → user's last active session
   a. Same "project family"?     → use it (weak, only if recent)     DONE
5. Nothing?                      → use ~                             DONE
```

The entire cascade runs in under 1ms. It is lookup, not search.

---

## Confidence Indicator

The ghost text uses two visual states to communicate confidence:

**High confidence** (exact name match, or column consensus):
```
 │  ╎ termaude█             ╎  │
 │  ╎ ~/sites/termaude       ╎  │  ← solid muted text (#888)
```

**Low confidence** (recency-based guess, clipboard signal):
```
 │  ╎ bugfix█               ╎  │
 │  ╎ ~/sites/termaude ?     ╎  │  ← dimmer (#555) with trailing ?
```

The `?` is a subtle visual cue that says "I'm guessing -- Tab to change, or just press Enter if this looks right." It disappears when the user presses Tab to cycle (confirming they have seen the options) or when they type a manual path.

---

## Edge Cases

### Ambiguous names

**Problem:** The user types `api` and there are directories at `~/sites/api`, `~/work/api`, and `~/projects/api`.

**Resolution:** Recency wins. The most recently used directory in Termaude sessions is shown first. Tab cycles through the others. If the user has never used any of them, alphabetical order by full path is used.

### Wrong inference

**Problem:** The user types `auth-fix`, column context points to `~/sites/termaude`, but they actually wanted `~/sites/other-project`.

**Resolution:** They see the ghost text before pressing Enter. Three options:
1. Press Tab to cycle through alternatives
2. Type a space and the correct path: `auth-fix ~/sites/other-project`
3. Press Enter anyway and change the cwd later from the card's context menu (right-click > Change directory)

The key insight: the ghost text makes the inference *visible before it takes effect*. The user always knows where the session will start.

### New project not yet indexed

**Problem:** The user just cloned a repo and it is not in the index yet.

**Resolution:**
- They can type the path manually (existing behavior still works)
- Or they can press a keyboard shortcut (Cmd+Shift+R) to refresh the index, which takes under a second
- The next automatic refresh (within 10 minutes) will pick it up
- Creating a session with a manual path automatically adds that directory to the index

### Name matches a directory the user did not intend

**Problem:** The user types `test` meaning a scratch session, but Termaude matches `~/projects/test`.

**Resolution:** The ghost text shows the match. The user sees it, presses Tab until they reach `~`, and presses Enter. Alternatively, they just type `test ~` to force home directory.

### Empty column (no context)

**Problem:** A brand-new column with no sessions has no column consensus to draw from.

**Resolution:** Column memory is skipped. The cascade continues to name matching and recency.

### Column has sessions in different directories

**Problem:** The "Active" column has sessions in 3 different directories.

**Resolution:** No consensus exists (the 2+ same-cwd threshold is not met). Column memory is skipped.

---

## Pros

- **Zero friction for the common case.** The user types a name and presses Enter. That is it. The path never needs to be typed for projects Termaude already knows about.
- **No new UI elements.** No file picker, no dropdown, no modal, no second input field. Just a ghost line of text below the existing input.
- **Progressive disclosure.** The Tab-to-cycle mechanism is discoverable but not in the way. Power users find it; casual users can just type paths manually.
- **Self-improving.** The more you use Termaude, the better the inference gets. Recency and frequency data accumulate naturally.
- **Column context is the killer feature.** Developers naturally organize columns by project or work area. This turns that spatial organization into automatic context, which feels like magic.
- **Always visible, never surprising.** The ghost text means the user is never surprised by where a session starts. They see the inference before confirming it.
- **Preserves the existing UX.** Manual path entry still works exactly as before. This is purely additive.

## Cons

- **Initial cold start.** On first launch with no session history, the index relies purely on directory scanning. Name matching works, but column context and recency are empty.
- **Index maintenance.** The background scan needs to be fast and non-intrusive. Machines with deeply nested or unusual directory structures may need configuration.
- **Tab key overload.** Using Tab to cycle could conflict with users who expect Tab to autocomplete. Mitigated by the fact that the input is a name field, not a path field -- there is nothing to autocomplete.
- **Ghost text could feel noisy.** For users who never care about the directory, seeing `~` flash below every input is unnecessary visual weight. Mitigated by making it extremely muted and only showing it while the input is focused.
- **Wrong defaults are silent failures.** If the user does not read the ghost text and presses Enter quickly, they may end up in the wrong directory. Mitigated by the card itself showing the cwd, and by the right-click "Change directory" escape hatch.

---

## Why This Approach is Different

Every other approach to this problem adds a step: a file picker, a dropdown, a fuzzy finder, a two-field form. They all make session creation slower in exchange for precision.

This approach removes a step. The path input effectively does not exist for most sessions. The intelligence runs silently, the result is shown as a ghost line, and the user presses Enter. When it is right (and it will be right most of the time, especially after a few sessions), the experience is indistinguishable from magic. When it is wrong, the correction mechanism (Tab or manual path) is faster than any picker could be.

The closest analogy is how a good IDE infers your run configuration from context. You do not pick a test runner and a config file and an environment every time. You click "Run" and it figures it out. Termaude should do the same for working directories.
