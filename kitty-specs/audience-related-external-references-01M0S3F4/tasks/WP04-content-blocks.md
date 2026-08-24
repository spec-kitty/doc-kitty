---
work_package_id: WP04
title: 'Content blocks: rendering seam + three blocks'
dependencies:
- WP01
- WP02
- WP03
requirement_refs:
- C-002
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-009
- FR-017
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts for this mission were generated on feat/audience-related-external-references. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/audience-related-external-references unless the human explicitly redirects the landing branch.
subtasks:
- T020
- T021
- T022
- T023
- T024
- T025
- T026
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/slots/Audience.astro
- src/components/slots/Related.astro
- src/components/slots/ExternalReferences.astro
execution_mode: code_change
owned_files:
- src/components/MarkdownContent.astro
- src/components/slots/Audience.astro
- src/components/slots/Related.astro
- src/components/slots/ExternalReferences.astro
- src/themes/spec-kitty/components/molecules/RelatedCard.astro
- src/themes/spec-kitty/components/molecules/ReferenceItem.astro
- src/themes/spec-kitty/tokens.css
- src/themes/spec-kitty/components/brand-components.css
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md) (US1–US3 + NFR-001/003),
`docs/adr/0017-m3-content-block-rendering-seam.md`, and
[../contracts/catalog-and-citation.contract.md](../contracts/catalog-and-citation.contract.md).

## Objective

Wire the three `dk:` content blocks **carrier-body** (ADR-0017) from the WP01
resolvers. These blocks must clear the a11y axe lane (the demonstrator + assertions
land in WP06). No transport change: `resolveLayout` stays synchronous; slot bodies
take no props; the Starlight `components` map stays the four carriers.

## Subtasks

### T020 — Carrier wiring (ADR-0017)
In `src/components/MarkdownContent.astro`: for `dk:audience`, `dk:related`,
`dk:external-references`, **retire the no-props theme-override passthrough**
(`{Slot && <Slot/>}`) and render the doc-kitty default body from resolved data. Keep
the named `<slot>` for authored MDX. Do **not** pass props through `slotComponents`
(ADR-0015-incompatible). Other `dk:` slots unchanged.

### T021 — `Audience.astro`
`<section class="dk-panel dk-panel--audience" aria-labelledby=...>` with the eyebrow
"Who is this for" heading and a `<ul>/<li>` of entries. Each entry: `resolveProfile`
→ link (persona title) if present, else the humanized slug as text; then the entry's
`guidance_text`. On a null profile, emit the **build warning** on a defined,
observable channel (a printed build-log line, e.g. `console.warn` at build) — not a
failure (FR-002). Not a `<nav>`.

### T022 — `Related.astro` + `RelatedCard` props
`<nav aria-label="Related pages">` + `<ul>/<li>` of `RelatedCard`s fed
`resolveRelated` output. Card-wide `<a>`, accessible name = **resolved target title**
(never a bare slug); show target `kind` + `note` (else `description`). A dangling ref
must have already thrown at resolve (FR-004) — do not swallow. Give `RelatedCard`
real props (it was props-only scaffolding in M2). Declared-direction only.

### T023 — Stale-target status marker [P]
When a resolved related target's `doc_status ∈ {deprecated, superseded}`, render the
**stale-target status marker** — a text label reusing the MetadataBand status
vocabulary/classes. Text label, never colour-only.

### T024 — `ExternalReferences.astro`
`<nav aria-label="External references">` + `<ul>/<li>` via `ReferenceItem` fed
`resolveCitation` output. Inline `{url,title,note}` renders directly; catalog
`{type,id}` renders from the resolved catalog record (title + author/year/container
muted). External links: `rel="noopener noreferrer"` + hidden "(opens in a new tab)".

### T025 — `ReferenceItem` accessible name = title [P]
Fix `ReferenceItem.astro`: the card-wide link's leading/accessible text is the human
**title** (inline title or resolved record title); the mono **citation key** (catalog
citations only) becomes a secondary affordance, never the leading/sole accessible
name (FR-009 / post-spec finding R2).

### T026 — `--dk-color-tint-lilac` AA token [P]
Add a real `--dk-color-tint-lilac` token + an AA-verified paired foreground for the
external-references tint (currently a neutral placeholder). Define it in
`tokens.css`; update `brand-components.css` `.dk-panel--external-references` to use
it. WP06 adds it to the enumerated `REQUIRED_DK_TOKENS` and the axe scan.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
Worktree per `lanes.json`; changes merge back into the mission branch.

## Definition of Done

- The three blocks render carrier-body from resolved data; no double-render; the
  named `<slot>` retained; no props on slot bodies; map unchanged.
- Audience soft-resolves + warns; related resolves + stale-marks + fails on dangling;
  external refs render inline + catalog-resolved with title-first accessible name.
- `--dk-color-tint-lilac` defined with an AA pair.
- All three blocks sit inside `data-pagefind-body`; no raw `<nav>` dropped by
  Pagefind (use the `role="navigation"` workaround if needed) (NFR-003).
- `pnpm typecheck/lint/test`, `build-example`, and `a11y` green (the WP06 demonstrator
  hardens the axe coverage, but this WP must not regress existing routes).

## Risks & reviewer guidance

- **No props through slots** — reviewer confirm ADR-0017 carrier-body path; reject any
  `slotComponents` prop threading.
- **Accessible names** — related links named by title, references named by title (not
  key). This is the exact fakeable-DoD the post-spec squad flagged; verify against the
  rendered `<a>`.
- **Dangling still fatal** — confirm the render path does not swallow a resolve error.
