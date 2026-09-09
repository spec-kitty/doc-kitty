# Mission Specification: Collapsible on-this-page TOC side rail

**Mission Branch**: `collapsible-toc-rail-01M23HNA`
**Created**: 2026-09-09
**Status**: Draft
**Input**: Add a collapsible desktop on-this-page outline (Starlight right rail / PageSidebar) so readers can hide the TOC and reclaim horizontal space; mobile unchanged; chrome-only (no convention change).

## Context

Starlight renders an "on this page" table of contents in a right-hand rail on wide
viewports (its two-column TOC breakpoint, ~`min-width: 72rem`) and a separate mobile
TOC below it. On text-dense pages the right rail permanently narrows the article. This
mission adds a **desktop-only** control to collapse that rail, reclaiming full article
width, with the choice remembered. It is a **Kitty Variation chrome enhancement** —
it wraps/overrides Starlight's `PageSidebar` component; it introduces **no** new
frontmatter fields and **no** convention/`sections.yaml` changes. Mobile keeps
Starlight's existing TOC; the left docs sidebar / section-nav is untouched.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collapse and restore the desktop outline (Priority: P1)

As a reader on a wide screen viewing a page that has an on-this-page outline, I want a
single control to hide the outline so the article uses the full column width, and to
bring it back — so I can read dense content without the permanent right-rail narrowing.

**Why this priority**: This is the feature's core value; without collapse/restore +
re-center there is nothing to persist or make accessible.

**Independent Test**: On a wide viewport on a page with a TOC, activate the edge toggle
and observe the outline hide, the main content widen and re-center, and the toggle
remain vertically centered on the right edge; activate again and observe the outline
and prior layout restored.

**Acceptance Scenarios**:

1. **Given** a wide viewport (≥ the two-column TOC breakpoint) on a page with a TOC and
   the outline shown, **When** the reader activates the toggle, **Then** the right
   column collapses to zero width, the TOC body is hidden, the main content widens to
   full width and **re-centers** (no residual right-bias), a thin hairline remains on
   the viewport's right edge, and the toggle stays clickable and vertically centered on
   that edge.
2. **Given** the outline is collapsed, **When** the reader activates the toggle again,
   **Then** the outline and the prior two-column layout are restored.
3. **Given** the outline is collapsed, **When** the reader looks at the control, **Then**
   the chevron points outward (expand affordance); when shown it points inward (collapse).

---

### User Story 2 - Preference persists without a flash (Priority: P2)

As a returning reader, I want my collapse choice remembered across reloads and
in-site navigation, and I never want to see the outline flash open before it collapses.

**Why this priority**: Persistence is what makes the control worth using repeatedly;
the no-flash requirement is what makes persistence feel correct rather than janky.

**Independent Test**: Collapse the outline, reload the page, and navigate to another doc
via an in-site link; the outline stays collapsed each time with no visible frame of the
expanded outline.

**Acceptance Scenarios**:

1. **Given** the reader has collapsed the outline, **When** they reload the page, **Then**
   the outline is already collapsed on first paint — no visible flash of the expanded TOC.
2. **Given** the reader has collapsed the outline, **When** they navigate to another page
   via a client-side (in-site) navigation, **Then** the outline is collapsed there too and
   the toggle works without needing a full reload.
3. **Given** browser storage is unavailable (private mode / blocked), **When** the reader
   uses the toggle, **Then** it still collapses/expands for the session without error (the
   preference simply does not persist).

---

### User Story 3 - Accessible, correctly scoped control (Priority: P3)

As a keyboard or assistive-technology user, I want the toggle to be reachable, labeled,
and state-communicating; and as any reader I expect it to appear only where it makes
sense (desktop, page has a TOC) and to leave mobile and the left sidebar alone.

**Why this priority**: Accessibility and correct scoping are required for the control to
ship responsibly, but they layer on top of the working collapse/restore behavior.

**Independent Test**: Tab to the toggle, confirm it is focusable with a visible focus
ring, has an accessible name, exposes `aria-expanded` matching the state, and activates
with Enter and Space; shrink below the breakpoint and confirm no desktop toggle and an
unchanged mobile TOC.

**Acceptance Scenarios**:

1. **Given** the toggle is present, **When** a keyboard user Tabs to it, **Then** it
   receives a visible focus ring (theme accent), exposes an accessible name and a `title`
   / `aria-expanded` that reflect the current state ("Hide …" / "Show …"), and activates
   with both Enter and Space.
2. **Given** the viewport is below the two-column TOC breakpoint, or the page has no TOC,
   **When** the page renders, **Then** no desktop toggle is shown and Starlight's mobile
   TOC behaves exactly as before.
3. **Given** any state of this feature, **When** the reader uses the left docs sidebar /
   section-nav, **Then** its behavior is unchanged.

### Edge Cases

- Page has **no** headings/TOC → no desktop toggle, no collapsed-rail chrome.
- Viewport **below** the breakpoint → no desktop toggle; mobile TOC unchanged.
- **Blocked storage** (private mode) → toggle still works in-session; no thrown error.
- **Client-side navigation / View Transitions** → the toggle is re-bound on the page-load
  event **without double-binding** (no duplicate listeners / no doubled behavior).
- **Collapsed rail must not steal clicks** — the zero-width rail sets `pointer-events`
  off while the toggle button restores `pointer-events` so it stays clickable.
- **Long outlines** — when expanded, the TOC body scrolls (its scrollbar hidden
  visually) while the rail stays `overflow: visible` so the edge-mounted toggle is not
  clipped.
- The toggle is `position: fixed`, vertically centered, anchored to the hairline — it does
  **not** scroll with the TOC list, so expand/collapse never jumps it to the top.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Collapse/expand toggle | As a desktop reader, I want a single circular icon button on the TOC rail's left-edge hairline that collapses (chevron inward) and expands (chevron outward) the on-this-page outline. | High | Open |
| FR-002 | Collapsed layout + recenter | As a desktop reader, when collapsed I want the right column at zero width, the TOC body hidden, the main pane full-width and re-centered (no right-bias), a hairline kept on the viewport's right edge, and the toggle still clickable (collapsed rail does not steal clicks). | High | Open |
| FR-003 | Fixed, viewport-centered toggle | As a desktop reader, I want the toggle `position: fixed`, vertically centered in the viewport, anchored to the TOC hairline — not scrolled with the TOC list — so it never jumps to the top on toggle. | High | Open |
| FR-004 | Desktop + has-TOC scoping | As a reader, I want the toggle only on pages that have a TOC and only at the two-column TOC breakpoint; below it, and on mobile, Starlight's `MobileTableOfContents` behaves unchanged. | High | Open |
| FR-005 | Persist + pre-paint apply | As a returning reader, I want the collapse preference stored in `localStorage` and the collapsed attribute applied on `<html>` before first paint (no TOC flash), tolerating blocked storage. | High | Open |
| FR-006 | Re-bind on client nav | As a reader navigating in-site, I want the toggle re-bound on the page-load event (View Transitions / client nav) without double-binding. | High | Open |
| FR-007 | Accessible control | As a keyboard/AT user, I want the toggle focusable with a visible accent focus ring, an `sr-only` accessible name, `title`/`aria-expanded` reflecting state, and Enter/Space activation. | High | Open |
| FR-008 | Chrome behavior docs | As a toolkit maintainer, I want the collapsible-rail chrome behavior documented briefly in the toolkit architecture/authoring notes. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | No expanded-TOC flash | With a collapsed preference, the outline shows **zero** frames expanded on load — the collapsed state is applied to `<html>` before first paint (pre-paint inline script), verified by an automated check that the collapsed attribute is present at initial render. | Performance/UX | High | Open |
| NFR-002 | Token-driven styling | The toggle and collapsed-rail CSS use Starlight design tokens (`--sl-color-*`, `--sl-sidebar-*`, `--sl-nav-height`, …) with **zero** hard-coded brand/palette hex values. | Maintainability | High | Open |
| NFR-003 | No mobile / left-nav regression | The mobile TOC and the left docs sidebar / section-nav behavior are **unchanged** — no rule in this feature targets their components/selectors; verified by scoping every selector under `html[data-has-toc]` at the desktop breakpoint and by an unchanged mobile TOC in test. | Reliability | High | Open |
| NFR-004 | Automated coverage | Automated tests (unit or e2e) cover expand/collapse, persistence across reload **and** client-side navigation, and "main pane re-centers when collapsed" — all passing in CI. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Chrome-only, no convention change | Override/wrap Starlight's `PageSidebar` (or the Kitty equivalent slot). **No** new frontmatter fields, **no** `sections.yaml`/convention changes, no change to TOC heading extraction or depth. | Technical | High | Open |
| C-002 | Desktop-only at the TOC breakpoint | The control is desktop-only at the two-column TOC breakpoint (~`72rem`); mobile keeps Starlight's `MobileTableOfContents`. | Technical | High | Open |
| C-003 | Left sidebar untouched | Do not change the left docs sidebar / section-nav behavior; this is the right on-this-page rail only. | Technical | High | Open |
| C-004 | No hard-coded brand palette | Prefer Starlight tokens; no hard-coded brand palette in the toggle/rail styling. | Technical | Medium | Open |
| C-005 | Attribute-driven layout | Drive layout with a document-level attribute (e.g. `html[data-toc-collapsed]`) plus CSS scoped to `html[data-has-toc]` at the desktop breakpoint. | Technical | Medium | Open |

### Key Entities

- **TOC collapse preference**: a boolean the reader controls — persisted in `localStorage`
  and mirrored as a document-level attribute on `<html>` (`data-toc-collapsed`).
- **PageSidebar override**: the component that wraps Starlight's `PageSidebar` so the
  desktop `TableOfContents` sits inside a collapsible panel while mobile stays default.
- **Rail toggle control**: the edge-mounted, fixed, accessible button that flips the
  preference.
- **Has-TOC signal**: a document-level attribute (`data-has-toc`) that scopes all
  feature CSS so nothing applies on pages without an outline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a viewport at/above the two-column TOC breakpoint on a page with a TOC,
  activating the toggle hides the outline and the main content widens to full width and
  re-centers, with the toggle remaining vertically centered on the right edge; activating
  again restores the outline and prior layout.
- **SC-002**: The collapse preference is retained across a full reload **and** a
  client-side navigation, with **no** visible frame of the expanded outline when the
  preference is collapsed.
- **SC-003**: Below the breakpoint or on a page with no TOC, no desktop toggle appears and
  the mobile TOC behaves exactly as before; the left docs sidebar is unchanged.
- **SC-004**: The toggle is reachable by Tab with a visible accent focus ring, exposes
  `aria-expanded` matching the state, and activates with both Enter and Space.
- **SC-005**: Automated tests cover expand/collapse, persistence (reload + client-side
  navigation), and main-pane re-center-on-collapse, and pass in CI.

## Assumptions

- The two-column TOC breakpoint follows Starlight's own (~`min-width: 72rem`); the exact
  value is read from / aligned to Starlight rather than reinvented.
- "Has a TOC" means Starlight rendered an on-this-page outline for the page (headings
  present and TOC not disabled by frontmatter).
- Persistence is per-browser via `localStorage`; it is not synced across devices.
- The example docsite is the venue for the e2e/unit coverage (its existing Playwright/
  a11y harness), consistent with how chrome is tested in this repo.
- No dependency is added; the toggle is vanilla client JS + CSS over Starlight tokens.

## Out of Scope

- Collapsing the **left** docs sidebar / section-nav.
- Changing TOC heading extraction or depth.
- Any theme redesign beyond the toggle + collapsed-rail layout described here.
- New frontmatter fields or convention/`sections.yaml` changes.
- Cross-device sync of the preference.
