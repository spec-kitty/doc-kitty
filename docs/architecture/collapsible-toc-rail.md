---
title: Collapsible TOC rail
description: The desktop-only collapsible on-this-page TOC rail — what it does, why it is a client augmentation rather than a PageSidebar override, and the Starlight internals it depends on.
doc_status: active
updated: 2026-09-09
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
---

# Collapsible TOC rail

The **collapsible TOC rail** lets a desktop reader hide Starlight's
on-this-page ("right sidebar") outline and reclaim its width for the article,
then restore it. It is toolkit chrome — always present on TOC-bearing pages, not
an opt-in `DocKittyOptions` flag.

## What it does

- **Collapse / restore.** A fixed edge toggle beside the outline hides it and
  re-reveals it. The state lives in one attribute, `data-toc-collapsed`, on
  `<html>`.
- **Re-centre.** When collapsed, the article widens to the full content column;
  the reserved rail column shrinks to a 1px hairline (not zero) so the layout
  edge stays deterministic.
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

- **The four-carrier lock.** `src/lib/config.ts` locks the Starlight
  `components` map to exactly four carriers (`Head`, `PageTitle`,
  `MarkdownContent`, `Footer`) and applies that map *after* any consumer
  overrides, so a fifth carrier cannot be added
  ([ADR-0013](../adr/0013-m1-chrome-substrate-single-layer.md),
  [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md)).
- **The `dk:toc` theme slot is unwired.** The theme declares `dk:toc` /
  `dk:toc-mobile` slot names, but no carrier reads them (only `dk:head` is
  wired), so the theme slot cannot carry a TOC override either.

Adding a fifth carrier or wiring the dormant slot would break the documented
lock or add render plumbing for no user-visible gain. The client-augmentation
seam — the same `injectScript('page', …)` path the diagrams and glossary
features use — is the sanctioned equivalent and keeps the lock intact. See
[Starlight integration](./starlight-integration.md) and
[Theming and chrome](./theming.md).

## Upgrade tripwire

Because the rail styles Starlight's own DOM from outside it, it depends on
Starlight internals. These are verified against **`@astrojs/starlight@0.32.6`**;
a Starlight bump must re-verify this list. The **Playwright interaction gate is
the tripwire** — if a bump moves or renames any of these, that gate reds.

Depended-on Starlight internals (see `src/styles/toc-rail.css`):

- `.right-sidebar-container` — the reserved rail column (collapsed to a 1px
  hairline).
- `.right-sidebar` — the rail element (pointer-events disabled when collapsed).
- `.right-sidebar-panel` — the outline panel (`display: none` when collapsed, so
  its links leave the accessibility tree).
- `.main-pane` — the article column.
- the `[data-has-sidebar][data-has-toc] .main-pane` right-bias rule — the
  Starlight rule the recenter override must outrank; the override compounds
  `data-toc-collapsed` with these two `<html>` attributes to win the cascade.
- the **`72rem`** two-column breakpoint — where the toggle is revealed and the
  layout overrides apply.

## Scope note

This feature introduces **no convention, frontmatter, or `sections.yaml`
change** — it is chrome behavior only (FR-008).
