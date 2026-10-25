---
title: Collapsible TOC rail
description: The desktop-only collapsible on-this-page TOC rail — what it does, why it is a client augmentation rather than a PageSidebar override, and the Starlight internals it depends on.
doc_status: active
updated: 2026-10-25T00:00:00Z
type: Architecture
kind: Explanation
authors:
  - human:stijn
tags: [toc, chrome, starlight, client-augmentation]
related:
  - architecture/starlight-integration
  - architecture/theming
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0044-header-carrier
  - adr/0045-frame-width-token
  - adr/0063-sidebar-carrier
  - adr/0064-default-frame-cap
  - architecture/research/layout-guards-and-decisions
---

# Collapsible TOC rail

The **collapsible TOC rail** lets a desktop reader hide Starlight's
on-this-page ("right sidebar") outline and reclaim its width for the article,
then restore it. It is toolkit chrome — always present on TOC-bearing pages, not
an opt-in `DocKittyOptions` flag.

## What it does

- **Collapse / restore.** A toggle button on the rail's edge hides the outline
  and shows it again. The state lives in one attribute, `data-toc-collapsed`, on
  `<html>`.
- **Where the toggle is.** The client script mounts the button as the **first
  child of `.right-sidebar-container`**, ahead of the rail, so in reading and
  focus order it comes immediately before the outline: one press of Tab from the
  toggle reaches the first outline link. Visually it is `position: fixed`:
  - *expanded*, it is **centred on the rail's inner edge**, half over the
    article's end padding and half over the rail's start padding;
  - *collapsed*, its end edge is **on the frame's end edge**, where the 1px rail
    line is.

  Both positions are built from the frame gutter and the rail width, so they
  hold at every desktop width, under a capped frame
  ([ADR-0045](../adr/0045-frame-width-token.md)), and mirrored on a right-to-left
  page.
- **What it announces.** The button has `aria-controls="dk-toc-panel"` (the
  script gives the outline panel that id), `aria-expanded` for the outline's
  state, and an `aria-label` with a matching `title` that change with the state.
  Its chevron is decorative.
- **Re-centre.** When collapsed, the reading pane takes the full width beside
  the sidebar and its column is centred in it; the reserved rail column shrinks
  to a 1px hairline (not zero) so the layout edge stays deterministic. This
  holds on a page with a sidebar and on a page with a rail but no sidebar.
  The second case has no real page in the example. It is guarded by
  `tests/a11y/no-sidebar-recentre.spec.ts`, a DOM-derived simulation that removes
  `data-has-sidebar` and the sidebar from a real page. The simulation was shown to
  match a real `StarlightPage` with `hasSidebar: false` at all ten measured points
  (#199).
- **Clear of the toggle.** Collapsed, the reading column ends at least 4px before
  the toggle at every width from 72rem (#217), under any frame cap (#220). From
  1152px to 1296px the centred column box used to run 7px under the toggle, and
  so did a wide viewport under a consumer's cap between 72rem and 84rem. The
  collapsed pane's end padding is now worked out from the width of the row the
  pane and rail share, not from the viewport, so it widens past the toggle
  wherever the column would otherwise reach it. The clearance holds whatever
  font the page falls back to.
- **Steady first paint.** The browser can paint before the whole page has been
  parsed. The rail is in its final place in that first paint too, expanded and
  collapsed (#223): it used to be drawn beside the sidebar and then jump across
  the page once the reading pane arrived.
- **No rail for a near-empty outline.** A page whose outline would hold only
  the page-title "Overview" entry (no `h2` or `h3`) renders with no rail and no
  toggle, and the reading column uses the space. The toolkit's route middleware
  drops that outline before the page is rendered.
- **Persistence.** The preference is stored in `localStorage`
  (`dk-toc-collapsed`, `'1'` = collapsed) and applied **before first paint** by a
  synchronous inline `<head>` script, so a returning reader with a collapsed
  preference sees zero expanded frames (NFR-001). Blocked storage (private mode,
  where `getItem` throws) falls back to the expanded default without erroring.
- **Desktop-only.** The toggle is hidden below the two-column breakpoint
  (`72rem`); the mobile TOC and the left docs sidebar are untouched.

## Why a client augmentation, not a PageSidebar override

The rail is a **client island** that augments Starlight's already-rendered
`.right-sidebar` DOM, plus a pre-paint head script and a token-driven CSS sheet.
It deliberately does **not** override Starlight's `PageSidebar` component, for
two structural reasons:

- **The carrier lock.** `src/lib/config.ts` locks the Starlight `components`
  map to exactly six carriers (`Head`, `PageTitle`, `MarkdownContent`,
  `Footer`, `Header`, `Sidebar`) and applies that map *after* any consumer
  overrides. A `PageSidebar` override would be a seventh, and a further carrier
  needs its own decision record
  ([ADR-0013](../adr/0013-m1-chrome-substrate-single-layer.md),
  [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md),
  [ADR-0044](../adr/0044-header-carrier.md),
  [ADR-0063](../adr/0063-sidebar-carrier.md)). The sixth carrier, `Sidebar`,
  renders Starlight's own sidebar unchanged and then the script that reveals the
  current entry, so the reveal runs before the sidebar is first painted (#203).
  It does not touch the rail.
- **The `dk:toc` theme slot is unwired.** The theme declares `dk:toc` /
  `dk:toc-mobile` slot names, but no carrier reads them, so the theme slot
  cannot carry a TOC override either.

Adding a carrier or wiring the dormant slot would add render plumbing for no
user-visible gain. The client-augmentation seam — the same
`injectScript('page', …)` path the diagrams and glossary features use — is the
sanctioned equivalent and keeps the lock intact. See
[Starlight integration](./starlight-integration.md) and
[Theming and chrome](./theming.md).

## Rail and no-rail pages: the column shift is accepted

A page with a rail and a page without one put the reading column at different
places, so the column moves when a reader goes from one to the other. This is
accepted and documented (#204). The values below are the column's start, in CSS
pixels, with the rail expanded:

| Viewport | Rail page | No-rail page | Shift |
| --- | --- | --- | --- |
| 1280 | 312 | 312 | 0 (the column width changes by 288) |
| 1440 | 312 | 384 | 72 |
| 1600 | 320 | 464 | 144 |
| 1920 | 480 | 624 | 144 |
| 2560 | 800 | 944 | 144 |

They were measured with a full-width frame. The 120rem default frame
([ADR-0064](../adr/0064-default-frame-cap.md)) leaves them unchanged: the frame
is the viewport up to 1920px, and at 2560px the frame and the column are both
centred, so the column starts at the same place.

Why the shift stays:

- **Stock Starlight shifts too.** It moves the column between pages with and
  without an outline.
- **Many pages have no rail.** 26 of the example's 68 framed pages have none,
  because a near-empty outline drops the rail (FR-011 of the
  `sidebar-frame-header-carrier` mission). They include every section index and
  every persona, so moving from an index to a child page crosses the boundary.
- **Reserving the rail was rejected.** A rail column on every page removes the
  shift, but it costs a page without a rail 30% of its reading width: 944px to
  656px at 1280px. It would also reverse FR-011.
- **Anchoring the column was not chosen.** Centring the column in the full pane,
  with the rail in the margin, removes the shift only once the frame is 117rem
  or wider, and it needs its own record.
- **The header search moves with the column.** The search now starts at the
  column's start on rail, no-rail and collapsed-rail pages (#216), so the column
  and the search move together.

## Upgrade tripwire

Because the rail styles Starlight's own DOM from outside it, it depends on
Starlight internals. These are verified against **`@astrojs/starlight@0.42.6`**;
a Starlight bump must re-verify this list. The **Playwright interaction gate is
the tripwire** — if a bump moves or renames any of these, that gate reds.

There are two gates. `tests/a11y/toc-rail.interaction.spec.ts` covers the
behaviour (collapse, restore, persistence, focus order, the toggle's name and
state). `tests/a11y/layout-geometry.spec.ts` measures where the rail, the toggle
and the reading column are at 1152, 1280, 1600, 1920 and 2560px, in both states,
under a capped frame and right-to-left, to 1px. It also checks the rail's place
on a page cut off before the reading pane (what a first paint during parsing
sees, #223), and that mounting the enhancement on a fully painted page shifts
nothing, with a positive control that proves a real shift is caught
(NFR-005, #222). Beside them, `tests/a11y/target-size.spec.ts` checks that every target in the header,
sidebar, rail and footer is at least 24 by 24px or meets the WCAG 2.5.8 spacing
exception (#202). The sidebar checks also run against the published, drafts-off
build in the same job (#200).

Depended-on Starlight internals (see `src/styles/toc-rail.css` for the collapsed
state and the toggle, and the frame section of `src/styles/dk-components.css`
for the expanded geometry):

- `.right-sidebar-container` — the reserved rail column. Expanded, it is pinned
  to the sidebar width (`--sl-sidebar-width`); collapsed, it is a 1px hairline.
  Starlight renders it **before** `.main-pane` and moves it to the end of the row
  with flex `order: 2`; the toolkit gives it an auto start margin so it sits at
  the row's end before the pane has been parsed (#223). If Starlight changes that
  source order or the flex row, re-check the #223 describe in
  `layout-geometry.spec.ts`.
  It is also the **toggle's mount point**: the script prepends the button to it.
  If Starlight renames or restructures this element the toggle is not mounted.
- `.right-sidebar` — the fixed rail element, a sibling of the button. Expanded,
  it is pinned to the sidebar width and has no inline inset: it sits at its
  static position, the start of its container. Collapsed, its pointer events are
  disabled, which is safe only because the button is not inside it.
- `.right-sidebar-panel` — the outline panel. The script gives it the id
  `dk-toc-panel`, the target of the button's `aria-controls`. It is
  `display: none` when collapsed, so its links leave the accessibility tree.
- `.main-pane` — the reading pane.
- **The recentre selectors.** Starlight right-biases the pane with
  `[data-has-sidebar][data-has-toc] .main-pane`. Two toolkit selectors state the
  collapsed geometry, both compounding `data-toc-collapsed` with the attributes
  Starlight puts on `<html>` so they outrank it and the expanded rule:
  - `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane`, for a
    page with a sidebar;
  - `html[data-toc-collapsed][data-has-toc]:not([data-has-sidebar]) .main-pane`,
    for a page with a rail and no sidebar.
- `data-has-sidebar` and `data-has-toc` on `<html>` — read by the selectors
  above and by the expanded-pane rule.
- the **`72rem`** two-column breakpoint — where the toggle is revealed and the
  rail and pane overrides apply — and the **`50rem`** breakpoint at which
  Starlight pins the sidebar, from which the frame gutter is non-zero.
- **Cascade layers.** Starlight 0.42 puts its styles in cascade layers, such as
  `@layer starlight.core`. The toolkit's rules are unlayered, so they win over
  Starlight's by layer order. Specificity decides only between toolkit rules.
- **The `Sidebar` component's props.** The `Sidebar` carrier passes Starlight's
  props through to Starlight's own `Sidebar`
  ([ADR-0063](../adr/0063-sidebar-carrier.md)). A bump that changes those props
  must be checked against the carrier.
- **`sl-sidebar-state-persist`**, the element in which Starlight's
  `SidebarPersister` wraps the sidebar tree. Its closing script restores the
  scroll position, and the reveal must run after it.

On the next Starlight bump, also **build the no-sidebar fixture page for real**:
a `StarlightPage` with `hasSidebar={false}` and a rail, kept out of the example's
sitemap. It checks that the DOM-derived simulation in
`tests/a11y/no-sidebar-recentre.spec.ts` still matches a real page (#199).

## Scope note

This feature introduces **no convention, frontmatter, or `sections.yaml`
change** — it is chrome behavior only (FR-008).
