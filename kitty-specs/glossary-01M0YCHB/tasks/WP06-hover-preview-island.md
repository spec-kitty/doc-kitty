---
work_package_id: WP06
title: Hover-preview island
dependencies:
- WP04
requirement_refs:
- FR-009
- NFR-001
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T022
- T023
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/lib/glossary/preview.client.ts
create_intent:
- src/lib/glossary/preview.client.ts
execution_mode: code_change
owned_files:
- src/lib/glossary/preview.client.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), `docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md`,
`docs/adr/0023-diagram-render-and-metadata-seam.md`, and — the exact footprint pattern to
mirror — `src/lib/diagram/diagram-render.client.ts` + the `diagramsIntegration`
`injectScript('page', …)` block in `src/lib/config.ts`.

## Objective

A **custom popover** definition preview on hover/focus — **not** the HTML `title` attribute
(`title` cannot meet WCAG 2.2 **1.4.13**). Reuse the **M5 footprint discipline** exactly: the
module is injected page-wide by WP08 via `injectScript('page')`, **early-returns** before
touching anything when the page has no `[data-glossary-term]` anchor (NFR-003 — a
glossary-free route loads no glossary JS), and pulls any heavier chunk only via a dynamic
`import()` inside that guard. The popover is built to 1.4.13 by **direct construction**
(NFR-001, asserted in WP09's a11y lane): **hoverable, Esc-dismissible, persistent** (no
auto-hide while hovered/focused), in **both** colour modes. Self-contained (no network,
NFR-006). Dormant until WP08 injects it.

## Dependency note (approved ≠ merged)

Merge the approved WP04 lane first so the anchor marker attributes exist to key on:
`git merge kitty/mission-glossary-01M0YCHB-lane-<wp04> --no-edit`. Scope review to this WP's
file.

## Subtasks

### T022 — Footprint-guarded island scaffold
- Create `src/lib/glossary/preview.client.ts` exporting `initGlossaryPreview(): void`
  (the shape WP08's `injectScript` calls, mirroring `initDiagrams`).
- **Guard first** (NFR-003): `const anchors = document.querySelectorAll('a[data-glossary-term]');
  if (anchors.length === 0) return;` — a glossary-free page does nothing.
- Any heavier work (e.g. a positioning helper) is behind a **dynamic `import()`** inside the
  guard, so a control route never requests the chunk (the footprint twin in WP09 asserts
  this).
- Do **not** rewrite the anchor's `href`/`target` — WP04 already set `target="_blank"
  rel="noopener"`; the island only **adds** the preview behaviour.
- **Files**: `src/lib/glossary/preview.client.ts` (~90 lines).
- **Validation**: manual + WP09's Playwright network-capture twin (glossary page requests the
  chunk; control route does not).

### T023 — Custom popover: hoverable, Esc, persistent, both modes
- On `mouseenter`/`focus` of a `[data-glossary-term]` anchor, show a popover whose content is
  the term's definition. Source the definition **self-contained** — from a `data-*` attribute
  the anchor carries or a small per-page inlined JSON the island reads (no network, NFR-006).
- **1.4.13 (NFR-001), by construction**:
  - **Hoverable** — the pointer can move from the anchor onto the popover without it
    disappearing (a small close-delay / shared hover region; the popover is not torn down on
    `mouseleave` of the anchor if the pointer entered the popover).
  - **Dismissible** — `Escape` dismisses it while it is open (keydown listener).
  - **Persistent** — no auto-hide timer while the trigger or popover is hovered/focused.
  - Styled with the `--dk-*` tokens so it reads correctly in **both** colour modes; ensure the
    popover text/background pair meets AA (WP09's axe scans the surrounding HTML; the direct
    1.4.13 assertions live in the a11y lane).
- Focus/keyboard: the anchor is a normal link (Tab-reachable); `focus` shows the popover too.
- **Files**: within `preview.client.ts`.
- **Validation**: WP09's a11y lane — direct hoverable/Esc/persistent assertions in both modes.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP04**
(merge the approved WP04 lane first). Runs in parallel with WP07. Implement with
`spec-kitty agent action implement WP06 --agent claude`.

## Definition of Done

- `preview.client.ts` early-returns on pages with no `[data-glossary-term]` and pulls any
  chunk only via dynamic import (footprint).
- The popover is hoverable, Esc-dismissible, persistent, and correct in both colour modes;
  it does not alter the anchor's link/target.
- Self-contained (no network). `ci-ok` green — not injected yet (WP08 injects it); corpus
  byte-identical.

## Risks / Reviewer guidance

- **Not `title`** — a `title`-attribute preview is an automatic finding (T-04/1.4.13). The
  popover must be a real element.
- **Footprint** — the early-return + dynamic-import guard is load-bearing for NFR-003;
  confirm no top-level side effects run on a glossary-free page.
- **1.4.13 persistence** — the most common miss is an auto-hide timer or teardown on the
  anchor's `mouseleave`; verify the pointer can cross the gap onto the popover.
- **Deck**: the island runs on any page with glossary links (including a deck with `:term`);
  it must not assume Starlight chrome exists.
