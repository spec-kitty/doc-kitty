---
title: Collapsible TOC rail
description: The desktop-only collapsible on-this-page TOC rail — what it does, why it is a client augmentation rather than a PageSidebar override, and the Starlight internals it depends on.
doc_status: active
updated: 2026-10-13
type: Architecture
kind: Explanation
authors:
  - stijn@sddevelopment.be
tags: [toc, chrome, starlight, client-augmentation]
related:
  - architecture/starlight-integration
  - architecture/theming
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0044-header-carrier
  - adr/0045-frame-width-token
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
  holds on a page with a sidebar and on a page with a rail but no sidebar;
  the second case has no real page in the example and is verified by simulation
  only (see ADR-0045).
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
  map to exactly five carriers (`Head`, `PageTitle`, `MarkdownContent`,
  `Footer`, `Header`) and applies that map *after* any consumer overrides. A
  `PageSidebar` override would be a sixth, and a further carrier needs its own
  decision record
  ([ADR-0013](../adr/0013-m1-chrome-substrate-single-layer.md),
  [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md),
  [ADR-0044](../adr/0044-header-carrier.md)).
- **The `dk:toc` theme slot is unwired.** The theme declares `dk:toc` /
  `dk:toc-mobile` slot names, but no carrier reads them, so the theme slot
  cannot carry a TOC override either.

Adding a carrier or wiring the dormant slot would add render plumbing for no
user-visible gain. The client-augmentation seam — the same
`injectScript('page', …)` path the diagrams and glossary features use — is the
sanctioned equivalent and keeps the lock intact. See
[Starlight integration](./starlight-integration.md) and
[Theming and chrome](./theming.md).

## Upgrade tripwire

Because the rail styles Starlight's own DOM from outside it, it depends on
Starlight internals. These are verified against **`@astrojs/starlight@0.32.6`**;
a Starlight bump must re-verify this list. The **Playwright interaction gate is
the tripwire** — if a bump moves or renames any of these, that gate reds.

There are two gates. `tests/a11y/toc-rail.interaction.spec.ts` covers the
behaviour (collapse, restore, persistence, focus order, the toggle's name and
state). `tests/a11y/layout-geometry.spec.ts` measures where the rail, the toggle
and the reading column are at 1152, 1280, 1600, 1920 and 2560px, in both states,
under a capped frame and right-to-left, to 1px.

Depended-on Starlight internals (see `src/styles/toc-rail.css` for the collapsed
state and the toggle, and the frame section of `src/styles/dk-components.css`
for the expanded geometry):

- `.right-sidebar-container` — the reserved rail column. Expanded, it is pinned
  to the sidebar width (`--sl-sidebar-width`); collapsed, it is a 1px hairline.
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

## Scope note

This feature introduces **no convention, frontmatter, or `sections.yaml`
change** — it is chrome behavior only (FR-008).
