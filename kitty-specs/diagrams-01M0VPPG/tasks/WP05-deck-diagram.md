---
work_package_id: WP05
title: Deck diagram (DeckLayout imports shared render; fence on active first slide)
dependencies:
- WP03
requirement_refs:
- FR-009
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/layouts/DeckLayout.astro
create_intent: []
execution_mode: code_change
owned_files:
- src/layouts/DeckLayout.astro
- example/docs/presentations/showcase-deck.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md),
[../contracts/render-token-and-assertions.md](../contracts/render-token-and-assertions.md),
`docs/adr/0023-diagram-render-and-metadata-seam.md`, and the M6 ADRs
`docs/adr/0012-slide-decks-static-reveal-from-markdown.md` +
`docs/adr/0022-reveal-integration-and-token-theme.md` (the out-of-frame deck shell).

## Objective

Make diagrams render **inside slide decks** (closes M6 C-008). `DeckLayout` is a standalone
HTML shell that bypasses Starlight, so the toolkit's page-level `injectScript` does not reach
it — `DeckLayout` must import the **same** shared render module (`initDiagrams`) via a
browser-only `<script>`, exactly like `reveal-init.client`. Add a mermaid fence to the
showcase deck's **active first slide** so there is a real deck diagram to render and scan
(WP06 does the scanning). Runs **parallel to WP04**.

**First-slide invariant is load-bearing**: reveal.js hides non-active slides
(`display:none`), and a hidden element can't size itself, so a diagram on a later slide can't
render its SVG. The demo diagram must be on the **active first slide**.

## Subtasks

### T017 — DeckLayout imports the shared render module
- In `src/layouts/DeckLayout.astro`, add a browser-only `<script>` that imports `initDiagrams`
  from `src/lib/diagram/diagram-render.client.ts` (the WP03 owner) and calls it — mirroring how
  the existing reveal init client is loaded. **Do not** add a second mermaid/render path.
- Tokens: the render owner reads `--dk-diagram-*` off `:root`; those ride `DeckLayout`'s
  **existing** base-token link — `DeckLayout.astro` already links `theme.css` (`baseTokenHref`),
  so once WP01 promotes the tokens they **are** in scope on the deck (no new deck token wiring).
- **Heads-up (squad F-C):** the `KNOWN DECK THEMING GAP` comment in `tests/a11y/mode.ts`
  (~L62-75) is **stale** — it predates `DeckLayout` linking `theme.css`. Do **not** let it steer
  the "themed, not default-grey" check; the tokens are genuinely reachable. (`mode.ts` is not
  owned here — flag it for WP06 / a follow-up to clean, don't edit it from this WP.)

### T018 — Diagram on the active first slide (`showcase-deck.md`)
- Add a `mermaid` fence with metadata (`%% title` + `%% description`) to the **first slide** of
  the existing `kind: Presentation` showcase deck (a guaranteed type). Keep the deck otherwise
  intact. This gives WP06 a real deck diagram to gate on.
- **No count change**: `showcase-deck` is an already-published route (already inside the 18) —
  adding a fence to it mints **no** new URL, so WP04 owns the sole count bump; do **not** touch
  `EXPECTED_*_COUNT` here.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **Depends on WP03**.
Runs **parallel to WP04**. Implement with `spec-kitty agent action implement WP05 --agent claude`.

## Definition of Done

- `DeckLayout` loads the shared `initDiagrams` via a browser-only `<script>`; no second render
  path (the NFR-007 single-owner invariant holds across shells).
- The showcase deck's first slide carries a themed, metadata-annotated mermaid fence.
- `ci-ok` green at **this** boundary via the **SSR guarantee**: the `<figure role="group">`
  wrap + `<figcaption>` are **server-rendered** (WP02 remark/rehype, registered in WP03), so the
  showcase deck — which is **already** an `AXE_PAGES` scan target — sees a valid accessible
  figure even before the client render (a pre-render raw `<pre class="mermaid">` carries no
  serious/critical axe finding). WP06 then **tightens** the deck's render-gate (it does not
  "add the deck" — the deck is already scanned). This WP does **not** own `tests/a11y/*`, so it
  cannot and need not co-land a render-wait.

## Risks / Reviewer guidance

- **First slide only** — verify the diagram is on the active first slide; a later-slide diagram
  renders blank (hidden-element sizing). This is the FR-009 pitfall.
- **Shared module** — confirm `DeckLayout` imports the *same* `diagram-render.client.ts`, not a
  copy; a second render path violates NFR-007 and would double-render.
- **Token reach** — the `--dk-diagram-*` tokens must be on `:root` in the deck shell (via the
  existing base link); verify the deck diagram is themed, not default-grey.
