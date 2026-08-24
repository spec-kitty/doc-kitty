---
work_package_id: WP04
title: Published deck + overview + pins + build assertions (atomic)
dependencies:
- WP01
- WP02
- WP03
requirement_refs:
- FR-010
- FR-012
- FR-013
- FR-014
- FR-015
- FR-017
- FR-019
- FR-023
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T016
- T017
- T018
- T019
- T020
- T021
- T028
history:
- '2026-08-24: authored by /spec-kitty.tasks'
- '2026-08-24: post-tasks squad remediation (sidebar D5 owner, buildable print+CSS-signature+draft-Pagefind assertions, lint-config ownership, deckSlug parity)'
agent_profile: implementer-ivan
agent: claude
authoritative_surface: src/scripts/
create_intent:
- example/docs/presentations/README.md
- example/docs/presentations/showcase-deck.md
execution_mode: code_change
owned_files:
- example/docs/presentations/README.md
- example/docs/presentations/showcase-deck.md
- src/scripts/assert-build-artifacts.mjs
- src/scripts/assert-chrome-artifacts.mjs
- .markdownlint.jsonc
- .vale.ini
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md),
[../contracts/deck-route-and-build-assertions.md](../contracts/deck-route-and-build-assertions.md),
[../quickstart.md](../quickstart.md), and `docs/adr/0021-*.md` + `docs/adr/0022-*.md`.

## Objective

Land the **published** showcase deck **and** the presentations overview Hub — both
published pages that move the example page counts — under **one** recompute of the pinned
counts, suppress the deck's in-frame sidebar node (ADR-0021 D5), and add every
build/chrome assertion that discharges the routing and search risks. This is the atomic
group (squad P-02): all count-pin-affecting published pages land here. The `a11y` lane
stays green because the deck is **not yet** in `AXE_PAGES` (that is WP05).

## Subtasks

### T016 — Published showcase deck
- `example/docs/presentations/showcase-deck.md`: `kind: Presentation`, `type: Presentation`,
  **`doc_status: active`**, `title`/`description` (≤180), optional `hero_image`. Body
  exercises the whole pipeline: title-slide content, `##` horizontal slides, a `##` with
  `###` children (a stack), a body `---` headingless slide, a `Note:`, one
  `<!-- .slide: … -->`, and one `<!-- .element: class="fragment" -->`.

### T017 — Overview page (`kind: Hub`)
- `example/docs/presentations/README.md`: `kind: Hub`, `doc_status: active`, listing the
  **published** decks from `getCollection('docs')` filtered to `kind: Presentation` +
  published, each linking to the deck and its `?print-pdf` export. No hand-kept manifest.
  The overview **stays** in the sidebar (it is the in-frame entry point); only the decks are
  suppressed (T028).

### T028 — Suppress the deck's in-frame sidebar node (ADR-0021 D5)
- A published deck must **not** appear as an in-frame Starlight sidebar link that ejects the
  reader out-of-frame with no signal. Set `sidebar: { hidden: true }` in the **deck**
  frontmatter (Starlight passes this through the extended `docsSchema`); confirm it is
  honored in the built sidebar. If frontmatter passthrough does not suppress it, escalate to
  a `sidebar` config in `example/astro.config.mjs` (owned by WP01) as a hand-back, not a
  local edit here.
- Assertion (in `assert-chrome-artifacts.mjs`): the deck URL is **absent** from the rendered
  in-frame sidebar `<nav>` on a sampled doc page; the overview page **is** present.

### T018 — Recompute the count pins (atomic)
- In `src/scripts/assert-build-artifacts.mjs`, recompute `EXPECTED_INDEX_ENTRY_COUNT` (:64)
  and `EXPECTED_SITEMAP_URL_COUNT` (:67) for the **new published set** = prior + showcase
  deck + overview Hub (the WP01 draft deck is `draft` → excluded, contributes 0). Cross-check
  against `example/docs/` and update the derivation comment.

### T019 — Build assertions
- Extend `assert-build-artifacts.mjs`:
  - **BA-2 route-uniqueness** — exactly one HTML at `/presentations/showcase-deck/`
    containing `.reveal > .slides`, **not** the Starlight article shell.
  - **BA-3 URL parity** — import `deckSlug`/`deckRouteParams` (WP01's `src/lib/deck/deck-slug.ts`)
    and assert the deck URL emitted by `llms.txt` and the agent API equals
    `absolute(site, `/${entry.slug}/`)` **and** the deck route's emitted path — one oracle,
    no reverse-engineering.
  - **BA-6 RSS-absent** — the deck URL is not in the RSS feed.
  - **BA-7 draft-absent + no-pin-move** — the WP01 draft deck is absent from sitemap/RSS/
    llms/agent **and** from the Pagefind index (its HTML carries page-level
    `data-pagefind-ignore` per WP01 T003), and did not move the counts.
  - **FR-013 print** — assert Vite emitted reveal's **print** stylesheet as a bundled hashed
    asset in `dist` (by its content signature) **and** that `reveal-init.client.ts`'s built
    chunk references it under the `print-pdf` branch. (There is **no** distinct `?print-pdf`
    HTML artifact — SSG emits one query-independent page — so this is an asset/bundle check,
    not an HTML `<link>` check.)

### T020 — Chrome assertions
- Extend `src/scripts/assert-chrome-artifacts.mjs` (a zero-dependency **static string search**
  over `example/dist`):
  - **BA-4 reveal-CSS non-leak** — find the emitted stylesheet asset containing reveal 6's
    core viewport sentinel (e.g. the `.reveal-viewport` rule / `html.reveal-full-page ...
    overflow:hidden` viewport-hijack block — pin the exact literal in the assertion), and the
    token-map sheet; assert their hrefs appear on the deck page and on **no** non-deck page,
    and that neither is pulled in via a shared chunk a doc page links.
  - **BA-5 Pagefind** — the showcase deck slug is in the Pagefind index (a unique slide phrase
    resolves to the deck URL) and the speaker-note `<aside>` text is **not** a result.

### T021 — doc-sanity on the deck (scoped lint exceptions)
- Ensure the showcase deck passes `validate:example`, `check-links`, markdownlint, and Vale.
  Deck syntax may trip rules: **MD035** (repeated `---`), any Vale rule flagging `Note:` lines
  or `<!-- .slide -->`/`<!-- .element -->` comments. Prefer **path-scoped** exceptions — a
  `[presentations/**]` block in `.vale.ini` and a markdownlint override glob for
  `presentations/**` — over inline disables, and **record the exact rule IDs** disabled (and
  why) in the WP history. `description ≤ 180`, required `kind`, resolvable `related`/citations.

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Depends on
WP01+WP02+WP03. Implement with `spec-kitty agent action implement WP04 --agent claude`.

## Definition of Done

- The published deck renders through the whole pipeline; the overview lists it; the deck is
  **absent** from the in-frame sidebar (overview present).
- Count pins recomputed + cross-checked in this one step; `build-example` green.
- BA-2..BA-7 (incl. draft-Pagefind), the print asset/bundle check, reveal-CSS non-leak (by
  pinned sentinel), and Pagefind assertions all pass, using the shared `deckSlug` oracle.
- Deck passes doc-sanity with recorded, path-scoped exceptions. `a11y` still green.

## Risks / Reviewer guidance

- **Double-pin hazard**: verify the overview Hub and the deck are counted in the **same**
  recompute; no later WP may add a count-moving published page.
- **URL parity**: the prefix-doubling trap (`entry.slug` already has `presentations/`) is the
  real hazard — confirm BA-3 uses the shared `deckSlug` helper, not an ad-hoc slug.
- **Pagefind/CSS handoff**: `data-pagefind-body` on `.slides` (WP01), note aside
  `data-pagefind-ignore` (WP02), draft `data-pagefind-ignore` (WP01) — this WP **asserts**,
  it must not re-add them; a missing one is a hand-back to the owning WP.
