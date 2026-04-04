# Termaude - Design System

## Design DNA

Termaude's visual identity is a hybrid of two reference points:

- **From Warp**: the structured terminal (blocks, separated input area, card-based output), premium surface layering, generous spacing, and the principle that terminal content is a *document*, not a raw character grid.
- **From Zed**: the ruthless minimalism, content-maximizing layout, speed-as-design-element, near-zero chrome, and the idea that every non-content pixel must justify its existence.

**The synthesis**: Warp's structured richness, filtered through Zed's restraint. A kanban terminal that feels premium but never heavy. If something doesn't help you manage sessions or read terminal output, it shouldn't be on screen.

---

## Core Principles

### 1. Content is King, Chrome is Invisible

Borrowed from Zed: the terminal output and kanban cards should occupy maximum screen real estate. UI elements (headers, toolbars, status bars) should be as small and quiet as possible. No visible scrollbar gutters (appear on hover/scroll only). No persistent toolbars with icons. The command palette replaces most buttons.

### 2. Surfaces, Not Borders

Borrowed from both: differentiate UI regions through subtle background color shifts, not lines or borders. When a border is necessary, it should be 1px at very low opacity (~10-15%). Depth comes from luminance, not shadow — except for floating elements (modals, palette, dragged cards) which get a subtle shadow to indicate they're above the surface.

### 3. Structured Content

Borrowed from Warp: terminal output should feel organized, not like a raw stream. Card previews show the last few lines as digestible snippets. In focus view, consider adopting Warp's block model where each command+output is a visually grouped unit (future enhancement, not MVP).

### 4. Speed is a Design Element

Borrowed from Zed: every interaction should feel instant. Animations exist to communicate state changes, not to decorate. No animation should exceed 200ms. If a transition makes the app feel slower, cut it. Perceived performance matters as much as actual performance.

---

## Color System

### Dark Theme (Default & Primary)

**Surfaces** — a 4-tier luminance stack, no hue in the backgrounds:

| Layer | Use | Color | Notes |
|---|---|---|---|
| Base | Window background | `#0f0f0f` | Near-black, like Zed's depth |
| Surface 1 | Column backgrounds | `#151515` | Barely lifted |
| Surface 2 | Card backgrounds, input areas | `#1c1c1c` | Where content lives |
| Surface 3 | Hover states, active elements | `#252525` | Interactive feedback |
| Floating | Modals, palette, dragged cards | `#1c1c1c` | + subtle shadow (0 4px 24px rgba(0,0,0,0.5)) |

**Text:**

| Use | Color | Opacity |
|---|---|---|
| Primary text | `#e8e8e8` | 100% |
| Secondary text | `#888888` | — |
| Muted/disabled | `#555555` | — |
| Terminal text | Per terminal theme | xterm.js handles this |

**Accent** — a single accent color used sparingly for interactive and status elements:

| Use | Color |
|---|---|
| Accent (default) | `#7c6aef` | Muted blue-violet |
| Accent hover | `#8d7ef7` | Slightly lighter |
| Accent muted | `rgba(124, 106, 239, 0.15)` | For backgrounds/selection |

**Status indicators:**

| State | Color | Notes |
|---|---|---|
| Active (output flowing) | `#34d399` | Green, gentle pulse animation |
| Running (waiting input) | `#60a5fa` | Blue, steady |
| Idle | `#555555` | Gray, no animation |
| Error | `#f87171` | Red |
| Success (exited 0) | `#34d399` | Green, static checkmark |

### Color Rules

- Backgrounds are **achromatic** (pure grays, no blue/warm tint). This keeps terminal colors accurate and avoids fighting with syntax themes.
- Accent color appears on: active card border, selected states, buttons, links, focus rings. Nowhere else.
- Status colors appear only on status dots and their immediate context. They never bleed into surfaces.
- No gradients on surfaces. Flat colors only.

---

## Typography

### Font Stack

| Context | Font | Fallback |
|---|---|---|
| Terminal text | Zed Mono, JetBrains Mono | Fira Code, SF Mono, Menlo, monospace |
| UI text | Inter | system-ui, -apple-system, sans-serif |

Why these: Zed Mono (or JetBrains Mono) is optimized for code readability at small sizes with programming ligatures. Inter is the standard for clean UI text with excellent legibility at small sizes.

### Scale

| Element | Size | Weight | Font |
|---|---|---|---|
| Column header | 11px | 600 (semibold) | Inter |
| Card title | 13px | 500 (medium) | Inter |
| Card directory | 11px | 400 (regular) | Inter |
| Card preview text | 11px | 400 | Monospace |
| Card metadata | 10px | 400 | Inter |
| Focus view header | 13px | 500 | Inter |
| Status bar | 11px | 400 | Inter |
| Terminal text | 13px (user-configurable) | 400 | Monospace |
| Command palette input | 14px | 400 | Inter |
| Command palette results | 13px | 400 | Inter |

### Typography Rules

- Column headers: uppercase, `0.05em` letter-spacing, muted color. They label, they don't compete.
- Card titles are the loudest text on a card — medium weight, primary color.
- Card preview text is monospace and muted — it's a *peek*, not meant to be read in detail.
- UI text is always smaller than terminal text. The terminal is the content; UI is the frame.
- No bold in body text. Use weight differences (400 vs 500 vs 600) for hierarchy, not bold vs regular.

---

## Spacing

### Grid

Base unit: **4px**. All spacing values are multiples of 4.

| Context | Value |
|---|---|
| Card internal padding | 12px |
| Gap between cards (vertical) | 8px |
| Column internal padding | 12px |
| Gap between columns | 12px |
| Board edge padding | 16px |
| Focus view header height | 40px |
| Status bar height | 24px |

### Spacing Rules

- **Generous but not wasteful.** Warp-level breathing room inside cards, Zed-level compactness in chrome.
- Cards should never feel cramped — the preview text needs room to breathe.
- Column headers are tight (compact height) so they don't eat vertical space.
- In focus view, the terminal extends edge-to-edge horizontally with minimal padding. Vertical: header at top, terminal fills the rest.

---

## Shapes & Borders

| Element | Border Radius |
|---|---|
| Cards | 8px |
| Columns | 8px |
| Command palette | 12px |
| Buttons | 6px |
| Input fields | 6px |
| Status dots | 50% (circle) |
| Modals | 12px |

### Border Rules

- **Default: no visible border.** Surface differentiation through color.
- Selected/focused card: 1px border in accent color (`#7c6aef`).
- Hover card: border at very low opacity (`rgba(255,255,255,0.06)`).
- Column separators: none. Columns are visually separated by the gap between them.
- Focus rings (keyboard nav): 2px accent color, 2px offset. Only visible on keyboard focus, not click.

---

## Motion

### Timing

| Interaction | Duration | Easing |
|---|---|---|
| Hover states | 100ms | ease-out |
| Card drag follow | 0ms (instant) | — |
| Card drop settle | 200ms | spring (slight overshoot) |
| View transition (board ↔ focus) | 180ms | ease-out |
| Command palette open/close | 120ms | ease-out |
| Status dot pulse | 2s loop | ease-in-out |
| Fade in (new cards, panels) | 150ms | ease-out |

### Motion Rules

- **Sub-200ms for everything the user initiated.** The app should never make you wait for an animation.
- Card drag: the card follows the cursor with zero delay. Apply a subtle scale-up (1.02) and elevated shadow while dragging. Very slight rotation (1-2 degrees) toward the drag direction for tactility.
- Card drop: spring animation to settle into position. Quick, with a tiny overshoot to feel physical.
- View transitions: the board slides/fades out as the terminal slides/fades in. No intermediate blank state.
- `prefers-reduced-motion`: respect it. Disable pulse animations, reduce transitions to instant.

---

## Component Specs

### Card (Board View)

```
┌─────────────────────────────┐  ← 8px radius, Surface 2 background
│                             │
│  auth-fix                ●  │  ← 13px medium Inter + status dot (8px circle)
│  ~/projects/auth            │  ← 11px regular Inter, secondary color
│                             │
│  > fixing token expiry...   │  ← 11px monospace, muted color
│  > reading src/auth.ts      │     max 2-3 lines, overflow hidden
│                             │
│  claude · 3m ago            │  ← 10px Inter, muted, bottom-aligned
│                             │
└─────────────────────────────┘
   12px padding all sides
   Total min-height: ~100px
   Width: fills column (fluid)
```

**States:**
- Default: Surface 2 background, no border
- Hover: Surface 3 background, faint border, slight shadow
- Selected: accent border (1px), accent background tint (`rgba(124,106,239,0.08)`)
- Dragging: scale 1.02, shadow `0 8px 32px rgba(0,0,0,0.4)`, slight rotation

### Column

```
┌─ ACTIVE (2) ─────────────── ▾ ┐  ← 11px semibold uppercase Inter, muted
│                                │     collapse toggle on right
│  ┌────────────────────────┐    │
│  │  card                  │    │  ← 8px gap between cards
│  └────────────────────────┘    │
│  ┌────────────────────────┐    │
│  │  card                  │    │
│  └────────────────────────┘    │
│                                │
│         + New Session          │  ← ghost button, muted, appears on hover
│                                │
└────────────────────────────────┘
  Surface 1 background, 8px radius
  12px padding, 12px gap from adjacent columns
  Width: min 260px, flexible
  Vertical: scrollable if cards overflow
```

### Focus View Header

```
┌──────────────────────────────────────────────────────────────┐
│  ← Board    auth-fix    Active                    ⌘K  ✕     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
  Height: 40px
  Surface 1 background
  "← Board" is a clickable text button (not an icon)
  Session name in primary text, column name in secondary/muted
  Right side: quick-switch shortcut hint, close button
  Bottom: 1px border at rgba(255,255,255,0.06) to separate from terminal
```

### Command Palette / Quick-Switch

```
┌────────────────────────────────────────┐  ← centered, 480px wide
│  ⌘K  Switch Session                    │     12px radius, Floating surface
│  ┌──────────────────────────────────┐  │     shadow: 0 16px 48px rgba(0,0,0,0.5)
│  │  search...                       │  │     backdrop: semi-transparent overlay
│  └──────────────────────────────────┘  │
│                                        │
│  ● auth-fix            Active          │  ← 13px Inter, status dot, column tag
│  ● frontend            Active          │     hover: Surface 3 background
│  ○ api-refactor        Backlog         │     selected: accent background tint
│  ✓ db-migration        Done            │
│                                        │
└────────────────────────────────────────┘
```

---

## Inspiration Summary

| Design Decision | Inspired By | Why |
|---|---|---|
| Achromatic surface layering | Zed | Keeps terminal colors accurate, feels native |
| Generous card spacing | Warp | Cards need room to show previews without feeling cramped |
| No visible borders by default | Zed | Cleaner, less visual noise |
| Content-first layout | Zed | Terminal output and cards dominate, chrome recedes |
| Status indicators on cards | Warp (block status) | Glanceable session health without reading output |
| Command palette as primary nav | Both | Keyboard-first, hides buttons from the UI |
| Sub-200ms animations | Zed | Speed as a design element, never feel sluggish |
| Structured card previews | Warp (blocks) | Terminal output as readable snippets, not raw noise |
| Monospace/sans-serif split | Both | Clear separation between "your content" and "app chrome" |
| Single accent color | Zed | Restrained palette, accent means something |
