# Data Model: Collapsible on-this-page TOC side rail

No server/runtime domain data. Entities are client UI state + build-time surfaces.

## E-01 — Collapse preference
- **Represents**: the reader's choice to hide/show the desktop outline.
- **State**: `localStorage['dk-toc-collapsed']` ∈ {'1','0', absent} mirrored to
  `document.documentElement` attribute `data-toc-collapsed` (present = collapsed).
- **Invariants**:
  - **INV-1 (pre-paint)**: on load with a collapsed preference, `data-toc-collapsed` is set
    BEFORE first paint (inline head script) — zero expanded frames (NFR-001).
  - **INV-2 (blocked-safe)**: reads/writes are try/catch; blocked storage → in-session state,
    never a thrown error (FR-005).
  - **INV-3 (single source)**: the attribute is the layout driver; localStorage is persistence
    only. Toggle updates both atomically.

## E-02 — Rail toggle control
- **Represents**: the edge-mounted button that flips E-01.
- **Shape**: native `<button type="button">`, circular ~2rem, chevron in/out; `sr-only`
  accessible name; `title` + `aria-expanded` reflect state; `position: fixed`, vertically
  centered, anchored to the TOC hairline.
- **Invariants**:
  - **INV-4 (a11y)**: reachable by Tab, visible accent focus ring, Enter/Space activate,
    `aria-expanded` === !collapsed (FR-007, SC-004).
  - **INV-5 (clickable when collapsed)**: `pointer-events` restored on the button even when
    the collapsed rail sets `pointer-events: none` (FR-002).
  - **INV-6 (idempotent)**: at most one button exists; re-running init is a no-op (FR-006).

## E-03 — Scoping signals
- **Represents**: where the feature is allowed to act.
- **Shape**: Starlight's `html[data-has-toc]` (SSR, unchanged) + the `min-width: 72rem`
  media query + a runtime `.right-sidebar` presence guard.
- **Invariants**:
  - **INV-7 (desktop + has-TOC only)**: no toggle / no collapsed chrome below 72rem or on
    no-TOC pages; mobile `mobile-starlight-toc` and left `nav.sidebar` are never targeted
    (NFR-003, SC-003).

## E-04 — Build surfaces
- `src/styles/toc-rail.css` in `GLOBAL_COMPONENT_SHEETS` (+ DeckLayout `?url` coupling);
  the pre-paint script string in the Starlight `head[]`; the client module via
  `injectScript('page', …)`. **INV-8**: no Starlight `components` carrier added (four-carrier
  lock intact); no new frontmatter/convention.
