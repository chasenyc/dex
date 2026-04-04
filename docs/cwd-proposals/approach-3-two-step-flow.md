# Approach 3: Two-Step Creation Flow

## The Insight

The best creation flows in developer tools (Linear, Notion, GitHub Issues) share a secret: they let you commit to creating the thing with almost zero effort, then progressively reveal options *after* you've already started. The psychological trick is that step one feels like the whole thing. Step two feels like an optional refinement, not a second hurdle.

Applied to Termaude: pressing Enter on a session name should feel like you're done. The directory picker that appears afterward should feel like a bonus — a chance to be precise — not a gate you have to pass through.

## The Core Idea

**Enter creates. Tab refines.**

Type a name, press Enter, session is created in `~`. Done.
Type a name, press Tab, a directory picker slides into view inline. Pick a directory, press Enter. Done.

Two steps, but the second step is entirely optional and skippable. The fast path is unchanged: type, Enter, go.

---

## Step-by-Step Flow

### Step 1: Name Input (identical to today)

The user clicks "+ New Session" at the bottom of a column. The inline input appears exactly as it does now.

```
┌─ ACTIVE (2) ─────────────────────┐
│                                    │
│  ┌────────────────────────────┐    │
│  │  auth-fix              ●   │    │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │  frontend              ●   │    │
│  └────────────────────────────┘    │
│                                    │
│  ┌────────────────────────────┐    │
│  │  auth-refactor             │    │
│  │  ▊                         │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

The placeholder text reads:

```
name ⏎ create  ⇥ set directory
```

This hint is the entire education model. It tells you both paths in seven words.

### Step 2a: Fast Path (Enter)

User types `auth-refactor` and presses Enter. Session is created immediately in `~`. Card appears. Input closes. Identical to today's behavior. Zero new friction.

### Step 2b: Directory Path (Tab)

User types `auth-refactor` and presses Tab. The input transforms:

```
┌─ ACTIVE (2) ─────────────────────┐
│                                    │
│  ┌────────────────────────────┐    │
│  │  auth-fix              ●   │    │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │  frontend              ●   │    │
│  └────────────────────────────┘    │
│                                    │
│  ┌────────────────────────────┐    │
│  │  auth-refactor             │    │
│  │  ~/▊                       │    │  ← directory input, pre-filled with ~/
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │    │
│  │  ~/sites/termaude          │    │  ← recent directories
│  │  ~/sites/api-server        │    │
│  │  ~/projects/mobile-app     │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

What happened:
1. The name locks in (displayed above the new input, 13px medium weight, primary color -- it looks like it's already the card title)
2. A second input line appears directly below, pre-filled with `~/`
3. Below the input, a short list of recent/frequent directories appears
4. The whole thing animates in at ~120ms, feels like the card is *growing* to accommodate the directory field

The name text becoming the card title is key to the "one fluid motion" feeling. The user isn't filling out a form. They're watching a card come to life.

### Step 2b (continued): Picking a Directory

The user now has three options:

**Option A: Type a path directly.**
Start typing. The recent directories list filters in real time as a fuzzy match. Typing `term` filters to show `~/sites/termaude`. Arrow down to select it, or keep typing the full path. Tab-completes directory segments like a terminal.

```
│  auth-refactor             │
│  ~/sites/term▊             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ~/sites/termaude          │  ← highlighted
│                            │
```

**Option B: Arrow through recents.**
Without typing anything extra, arrow-down into the recent directories list. The input updates to show the selected path. Press Enter.

**Option C: Press Enter immediately.**
Accept the pre-filled `~/` and create the session in home. This is the "I accidentally pressed Tab" escape — still fast.

### Step 3: Creation

User presses Enter. The directory is validated (exists check). If valid, the card completes its formation:

```
┌────────────────────────────┐
│  auth-refactor          ○  │
│  ~/sites/termaude          │
│                            │
│  starting...               │
│                            │
└────────────────────────────┘
```

The input fields dissolve and the card settles into its final form. The transition should feel like the input *was* the card all along — it just finished loading.

If the directory doesn't exist, the input border flashes red briefly and the path text turns to the error color (`#f87171`). The input stays focused so the user can fix it. No modal, no toast, no separate error state. Just a color flash and the cursor stays where it was.

```
│  auth-refactor             │
│  ~/sites/termaudee         │  ← red border flash, red text
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ~/sites/termaude          │  ← suggestion still visible
│                            │
```

---

## The "Recents" List

The recent directories list is what makes this approach go from good to genius. It solves 90% of use cases because developers work in the same 3-8 directories repeatedly.

**Sources (in priority order):**
1. Directories used in existing Termaude sessions (most relevant, always fresh)
2. Directories from recent shell history (`cd` commands parsed from `.zsh_history` / `.bash_history`)
3. Git repositories found in common locations (`~/`, `~/sites`, `~/projects`, `~/code`, `~/dev`, `~/repos`)

**On first use**, when there are no Termaude sessions yet, the list is seeded from shell history and git repo discovery. This means even on day one, the user sees their actual project directories without any configuration.

**List behavior:**
- Maximum 5 items shown (keeps it tight, doesn't overwhelm)
- Most recently used at the top
- Fuzzy-filtered as the user types
- Each entry shows the path, nothing else — no icons, no metadata, no noise

---

## ASCII Mockup: Full Sequence

### 1. Idle state
```
│    + New Session            │
```

### 2. Click, input appears
```
│  ┌──────────────────────┐   │
│  │ ▊                    │   │
│  └──────────────────────┘   │
│  name ⏎ create  ⇥ directory │
```

### 3. User types "auth-refactor"
```
│  ┌──────────────────────┐   │
│  │ auth-refactor▊       │   │
│  └──────────────────────┘   │
│  name ⏎ create  ⇥ directory │
```

### 4a. Enter → session created instantly

### 4b. Tab → directory picker slides in
```
│  auth-refactor              │
│  ┌──────────────────────┐   │
│  │ ~/▊                  │   │
│  └──────────────────────┘   │
│  ~/sites/termaude           │
│  ~/sites/api-server         │
│  ~/projects/mobile-app      │
```

### 5. User selects or types directory, presses Enter
```
│  ┌────────────────────────┐ │
│  │  auth-refactor      ○  │ │
│  │  ~/sites/termaude      │ │
│  │                        │ │
│  │  starting...           │ │
│  └────────────────────────┘ │
```

---

## Keyboard Flow Summary

| Key | In Name Input | In Directory Input |
|---|---|---|
| `Enter` | Create session in `~` | Create session in selected directory |
| `Tab` | Lock name, open directory picker | Tab-complete path segment |
| `Escape` | Cancel everything, close input | Go back to name input (un-lock name) |
| `Arrow Down` | (nothing) | Move into recents list |
| `Arrow Up` | (nothing) | Move up in recents list |
| `Backspace` (on empty `~/`) | (n/a) | Go back to name input |

The Escape behavior in the directory input is important: it goes *back* to the name input, not all the way out. This lets you correct a name mistake without starting over. Pressing Escape again from the name input cancels the whole flow.

---

## Why This Feels Like One Motion

Three design choices prevent this from feeling like a clunky wizard:

1. **The name becomes the card title in place.** When you press Tab, the name doesn't move to a "Name:" label in a form. It stays exactly where it was and becomes the card title. The directory input appears *below* it, as if the card is growing. You're not filling out a form. You're building a card.

2. **The transition is 120ms.** The directory input slides in with the same timing as the command palette opening. It feels like a reveal, not a page change. There's no layout shift — the card grows downward, pushing nothing else.

3. **Pre-filled and pre-populated.** The input starts with `~/` and the recents are already visible. You're not staring at a blank field. You're choosing from options that are already there. For frequent directories, this means the total interaction is: type name, Tab, Arrow Down, Enter. Four keystrokes.

---

## Preserving Existing Power-User Syntax

The current `name ~/path` single-line syntax still works. If the user types `auth-refactor ~/sites/termaude` and presses Enter, it parses exactly as it does today and creates the session immediately. No Tab step needed. Power users who already know the path lose nothing.

This is critical: the two-step flow is an *addition*, not a replacement. The single-line format is the expert mode. The two-step flow is the approachable mode. Both coexist in the same input.

---

## Edge Cases

### First use (no history)
The recents list is seeded from shell history and git repo discovery. If somehow both are empty (fresh machine, no history), the directory input shows just the `~/` pre-fill with no suggestions below. The hint text below the input reads `type a path or paste one`. This is a graceful degradation, not a broken state.

### Cancellation mid-flow (in directory input)
Escape returns to name input with the name still filled in. The user can press Escape again to cancel entirely, or press Enter to create with `~`, or press Tab to re-enter directory selection. State is never lost until the user explicitly cancels from the name input.

### Blur during directory input
If the user clicks away while in the directory picker, the session is created with whatever directory is currently in the input (even if it's just `~/`). Same behavior as the current input's onBlur — commit rather than discard. This prevents losing work if you accidentally click elsewhere.

### Wanting to skip directory
Enter from name input skips it entirely. This is the default, happy path. There's no "skip" button because Enter *is* skip.

### Invalid directory
Red flash on the input border. Input stays focused. If the closest match in recents is similar (edit distance), it remains visible as a suggestion. The user can arrow down to select it or fix their typo. No blocking modals.

### Very long directory paths
The directory input is a single-line text field that scrolls horizontally, same as any path input. The recents list truncates from the left if needed: `...ojects/mobile-app/packages/core`.

### Shell sessions (! prefix)
The `!` prefix still works in the name input. Typing `!my-shell` and pressing Tab opens the directory picker for shell sessions too. Typing `!my-shell` and pressing Enter creates a shell session in `~`. No special handling needed.

---

## Pros

- **Zero friction added to the fast path.** Enter still creates instantly. The happy path is identical to today.
- **Discoverable.** The placeholder hint teaches the Tab flow passively. Users learn it when they're ready, not on day one.
- **No modals, no popups, no new panels.** Everything happens inline within the column, inside what feels like the card itself.
- **Recents list solves 90% of use cases.** Most developers cycle through a small set of directories. Showing them proactively eliminates typing entirely for repeat use.
- **Graceful on first use.** Shell history and git repo scanning mean the recents list is useful from day one with zero configuration.
- **Keyboard-native.** The entire flow is type, Tab, Arrow, Enter. No mouse required. Feels like terminal tab completion, which developers already have in muscle memory.
- **Consistent with the design system.** The card-growing animation, inline reveal, and minimal chrome all align with the Zed-inspired "content is king" principle.

## Cons

- **Tab key overloading.** Tab normally moves focus between elements. Overriding it in this input may surprise users who expect standard form navigation. Mitigation: this is a single input, not a form, so there's no "next field" to Tab to. The overload is contextually natural.
- **Recents list requires backend work.** Scanning shell history, discovering git repos, and tracking session directories needs Rust-side implementation. Not trivial, but not risky either.
- **Two-step flow is hidden.** Users who don't read the placeholder hint won't discover the Tab flow. They'll keep using Enter and defaulting to `~`, or typing full paths inline. Mitigation: this is fine. The Enter path works. The Tab flow is a progressive enhancement, not a requirement.
- **Directory validation adds latency.** Checking if a directory exists requires an async call to the backend before creation. Mitigation: validate on Enter, show inline error instantly. The check is a single `stat()` call — sub-millisecond on local filesystems.
- **Fuzzy matching complexity.** Filtering the recents list with fuzzy search adds UI complexity. Mitigation: use a simple substring match initially. Upgrade to fuzzy later if needed.

---

## Why This Approach Wins

The genius is in what it *doesn't* do. It doesn't add a modal. It doesn't add a sidebar file browser. It doesn't add a second input field that's always visible. It doesn't change the layout. It doesn't slow down the fast path by even one keystroke.

It takes the existing input and makes it *expand* when you ask it to. The card is being born right there in the column, growing from a single line into a full card with a directory. It feels organic, not mechanical.

And the recents list — seeded from your actual shell history — means that even on first use, Termaude already knows where your projects live. You don't configure it. You don't onboard. You just press Tab and your directories are there. That's the moment a developer says "this is genius."
