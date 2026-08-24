---
work_package_id: WP01
title: 'Foundation: deck route, layout, reveal, theme, guardrails'
dependencies: []
requirement_refs:
- FR-004
- FR-005
- FR-006
- FR-009
- FR-013
- FR-022
- FR-023
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- '2026-08-24: authored by /spec-kitty.tasks'
- '2026-08-24: post-tasks squad remediation (URL-parity helper, CSS-isolation mechanism, AA hard gate, BA-8 test, draft Pagefind, astro.config owner)'
agent_profile: frontend-freddy
agent: claude
authoritative_surface: src/layouts/
create_intent:
- src/layouts/DeckLayout.astro
- src/lib/deck/reveal-init.client.ts
- src/lib/deck/deck-slug.ts
- src/styles/dk-reveal-theme.css
- example/src/pages/presentations/[...slug].astro
- example/docs/presentations/draft-preview.md
execution_mode: code_change
owned_files:
- src/layouts/DeckLayout.astro
- src/lib/deck/reveal-init.client.ts
- src/lib/deck/deck-slug.ts
- src/styles/dk-reveal-theme.css
- example/src/pages/presentations/[...slug].astro
- example/src/content.config.ts
- example/astro.config.mjs
- example/docs/presentations/draft-preview.md
- src/scripts/validate-frontmatter.mjs
- package.json
- pnpm-lock.yaml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../contracts/deck-route-and-build-assertions.md](../contracts/deck-route-and-build-assertions.md),
and the two gating ADRs `docs/adr/0021-deck-routing-seam-out-of-frame-override.md` +
`docs/adr/0022-reveal-integration-and-token-theme.md`.

## Objective

Stand up the deck **substrate**: the out-of-frame route, the `DeckLayout` shell with
browser-only reveal init, the pinned reveal dependency, the `--dk-*`→`--r-*` theme
sheet, the off-section-`Presentation` validator error, and one **draft** demonstrator
deck that forces the route to render so SSR-safety and the route-override are verified at
this boundary. **No published deck lands here** — so `build-example` counts are
unchanged and the `a11y` lane stays green (the deck is not yet in `AXE_PAGES`).

This WP is the hardest seam. Follow ADR-0021 (path-scoped route override; the deck wins
`/presentations/*` by specificity, Starlight is shadowed not excluded) and ADR-0022
(reveal 6.0.1, core+Notes, **browser-only** init on a `prerender=true` route — a
top-level `import Reveal` in `.astro` crashes `astro build`).

## Subtasks

### T001 — Add reveal.js@6.0.1 (self-hosted, no `@types`)
- `pnpm add reveal.js@6.0.1` (exact pin). Do **not** add `@types/reveal.js` (v6 bundles
  types) — remove it if present.
- Verify via the lockfile diff that only `reveal.js` is added and that it carries **no**
  `preinstall`/`install`/`postinstall` lifecycle script (keep the deny-by-default posture;
  research.md supply-chain note). No CDN anywhere.

### T002 — Out-of-frame deck route + `deckSlug` parity helper
- Create `src/lib/deck/deck-slug.ts` exporting `deckSlug(entry)` and `deckRouteParams(entry)`:
  the deck's canonical URL **must** equal what the generators emit — `absolute(site,
  `/${entry.slug}/`)` (see `src/lib/routes/llms-txt.ts:51` and `routeFor` /
  `slugFromEntryId` in `src/lib/metadata.ts`). Because the route file is
  `presentations/[...slug].astro`, `[...slug]` captures the path **after** `presentations/`,
  while `entry.slug` **already includes** the `presentations/` prefix — so
  `deckRouteParams(entry) = { slug: entry.slug.replace(/^presentations\//, '') }` and the
  built path reconstructs to `/${entry.slug}/`. (Feeding raw `entry.slug` yields
  `/presentations/presentations/<x>/` and fails BA-3.) The WP04 URL-parity assertion imports
  this same helper — one source of truth.
- Create `example/src/pages/presentations/[...slug].astro`: `export const prerender = true`,
  `getStaticPaths()` over `getCollection('docs')` filtered to `data.kind === 'Presentation'`,
  `params` from `deckRouteParams(entry)`, `props: { entry }`. Render `<DeckLayout entry={entry} />`.
- By path specificity this shadows Starlight's catch-all under `/presentations/*` only.
  **Prevent a duplicate-route build error**: exclude `presentations/` entries from
  Starlight's own routing surface so only this route emits `/presentations/*` — do this in
  `example/src/content.config.ts` / the Starlight config (the exclusion mechanism named in
  ADR-0021 D3). T007 is the go/no-go gate that proves this holds.

### T003 — `DeckLayout.astro` shell + CSS-isolation mechanism + Pagefind attrs
- Emit `.reveal > .slides` wrapping the transformed slide `<section>`s (the transform ships
  in WP02; until then render the entry body — enough to smoke the route). Real `<button>`
  navigation controls with accessible labels ("Previous slide" / "Next slide"), not `<div>`s.
- **Pagefind**: put `data-pagefind-body` on `.slides` **only for published decks**; for a
  `doc_status: draft` deck, put `data-pagefind-ignore` on the deck root (so the draft's
  emitted HTML is not indexed — RT-05). The Notes `<aside>` gets `data-pagefind-ignore` in WP02.
- **reveal-CSS isolation — pin the mechanism (not just "import here")**: import reveal's
  **core** CSS and `dk-reveal-theme.css` so Vite keeps them in the deck route's own chunk.
  Route-import alone does **not** guarantee non-hoisting; use an isolation form that Vite
  will not promote into a shared chunk (e.g. import the stylesheet `?url` and emit a
  `<link>` in the deck `<head>`, or inline via `?inline`). If a shared-chunk still forms,
  the owned fallback is a `build.rollupOptions`/`cssCodeSplit` directive in
  `example/astro.config.mjs` (owned by this WP). WP04 BA-4 asserts the result.
- Load reveal via a client `<script>` that dynamically imports `reveal-init.client.ts`.
  **Never** `import Reveal` at the top level of this `.astro` file.

### T004 — `reveal-init.client.ts` (browser-only)
- `import Reveal from 'reveal.js'; import RevealNotes from 'reveal.js/plugin/notes';`
  init `new Reveal(el, { plugins:[RevealNotes], hash:true }).initialize()`.
- Reduced motion: when `matchMedia('(prefers-reduced-motion: reduce)').matches`, pass
  `transition:'none'` (+ the CSS `@media` in the theme) so the interaction test sees computed
  `transition-duration: 0s`.
- Print: if `location.search.includes('print-pdf')`, `import('reveal.js/print/pdf.css')`
  (bundled, query-gated — verify the exact export path against `6.0.1`'s `exports`). This is
  the FR-013 gate; WP04 asserts the bundled asset is emitted + referenced here (not an HTML
  `<link>` check — the query-gated import produces no distinct static artifact).

### T005 — `dk-reveal-theme.css` + AA **hard gate**
- Map reveal's `--r-*` onto `var(--dk-*)` under `.reveal` (background, main/heading color,
  main/heading font, link color, sizes; deck width via the existing `--dk-width-deck`, which
  is present at `src/styles/theme.css:87` — a no-op verify). `@media (prefers-reduced-motion:
  reduce)` disables transitions.
- **Hard gate**: this WP is **not done** unless the deck bg/text `--dk-*` pair meets WCAG 2.2
  AA in **both** light and dark. Verify the contrast here (compute the ratio against the
  token values). If a token must change, that is a WP01 edit (`theme.css` — recorded in
  history), never a downstream WP05 patch. WP05 must never have to fix contrast.

### T006 — Validator: off-section `Presentation` = hard error (+ proof)
- In `src/scripts/validate-frontmatter.mjs`, add: a page with `kind: Presentation` whose
  path is **not** under `presentations/` is a **blocking error** (FR-022) — protecting the
  path+kind invariant the route override depends on. Optionally add a `presentations`
  `expectedType` case (:143).
- **Prove it (BA-8)**: add a unit test (vitest, exercising the validator's exported check on
  an in-memory/temp fixture) asserting a `kind: Presentation` path outside `presentations/`
  returns a blocking error and one inside does not. A committed misfiled fixture can't exist
  (it would red the build), so the guard needs a unit test, not a corpus fixture.

### T007 — Draft demonstrator deck (smoke + FR-023 fixture) — **routing go/no-go gate**
- Create `example/docs/presentations/draft-preview.md`: `kind: Presentation`, `type:
  Presentation`, **`doc_status: draft`**, title, a couple of `##`/`###` slides. Draft → it
  renders a route (smoke-testing T002/T003) but is excluded from every generator and does
  **not** move the counts; per T003 its HTML carries `data-pagefind-ignore` (not indexed).
- Run `astro build` and assert `/presentations/draft-preview/` emits `.reveal > .slides`
  out-of-frame (no Starlight article shell). **This is the go/no-go gate for the whole
  routing seam (ADR-0021 D3)**: a duplicate-route build error here is a **mission-level design
  signal**, not a local WP bug — escalate, do not patch around it.

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Execution
worktrees are allocated per computed lane from `lanes.json`; implement with
`spec-kitty agent action implement WP01 --agent claude`.

## Definition of Done

- `reveal.js@6.0.1` pinned, no `@types/reveal.js`, no CDN, no install scripts.
- The route renders the draft deck out-of-frame (`.reveal>.slides`, not the Starlight
  shell); no duplicate-route error; reveal CSS/JS absent from doc pages.
- `deckSlug`/`deckRouteParams` helper exists and the draft deck's URL reconstructs to
  `/${entry.slug}/`.
- `DeckLayout` has `data-pagefind-body` on `.slides` (published) / `data-pagefind-ignore`
  (draft) and real `<button>` controls; reveal initialized only from the browser-only import.
- Off-section `Presentation` fails validation, **with a passing unit test proving it**.
- Deck bg/text token pair is AA in both modes (hard gate).
- All four `ci-ok` lanes green; `build-example` counts unchanged; a11y unscanned.

## Risks / Reviewer guidance

- **SSR crash** if reveal is imported top-level in `.astro` — verify import is only in the
  client `<script>`/`reveal-init.client.ts`.
- **Duplicate route**: T007's `astro build` is the gate — a `/presentations/*` duplicate-route
  error means the exclusion (T002) is wrong; treat as mission-level.
- **CSS hoisting**: reviewer should confirm the isolation mechanism (T003) actually keeps
  reveal's core sheet off doc pages (WP04 BA-4 is the formal check).
