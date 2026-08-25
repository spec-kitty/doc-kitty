# Implementation Plan: Diagrams (Mermaid)

**Branch**: `feat/diagrams` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/diagrams-01M0VPPG/spec.md`

## Summary

M5 adds **client-side Mermaid diagrams** authored as `` ```mermaid `` fences. A build-time
**transform** (remark parse of a `%%` metadata block → inject `accTitle`/`accDescr`
accessibility statements → rehype-wrap in a `<figure>`) makes the client-rendered SVG name
itself and gives it a caption; a **single render owner** (a shared client module) draws each
diagram, reads the promoted `--dk-diagram-*` tokens into Mermaid's `themeVariables`, and
re-renders on a `[data-theme]` toggle — on doc pages **and** the M6 out-of-frame decks.
Packaging is an opt-in preset option; no build-time headless browser. The two seam decisions
are **ADR-0023** (render ownership + remark/rehype ordering + deck render-path + a11y
mechanism) and **ADR-0024** (token promotion to Default + brand `tokens.css`, orphan
retired), authored in this plan. The approach is research-backed (`research.md`), grounded
in the codebase, and hardened by a four-lens post-spec squad (`reviews/post-spec-squad.md`).

## Technical Context

**Language/Version**: TypeScript 5.x on Node ≥22 (ESM); Astro 5 / Starlight; remark/rehype (mdast/hast); Mermaid theming.
**Primary Dependencies**: `astro-mermaid@2.1.0` (fence transform, render-suppressed) + `mermaid@11.17.1` (self-hosted, bundled, `securityLevel:'strict'`, **no CDN**), pinned as a golden-file dependency. No other new dependency; no build-time headless browser.
**Storage**: N/A — static SSG; diagram content is `` ```mermaid `` fences in the `docs` collection and decks.
**Testing**: vitest (pure `%%` parse + `accTitle`/`accDescr` injection + figure emission + opt-in-off preset + `--dk-diagram-*` AA-contrast, all Astro-free); Playwright a11y lane (render-gate + direct accessible-name/figure assertion both modes, `[data-theme]` toggle re-render, network-capture footprint); build/chrome assertions (figure, injected statements, no-JS source+caption, pinned versions, count pins).
**Target Platform**: Static site, modern browsers; diagrams render client-side; no-JS degrades to diagram source + caption.
**Performance Goals**: The `mermaid` library chunk loads only on pages with a diagram (Playwright-verified).
**Constraints**: `ci-ok` green each WP boundary (C-007); `build-example` stays browser-free; exactly one render loop per `pre.mermaid`; WCAG 2.2 AA on diagram colours (vitest) + accessible name (direct); self-contained, no CDN.
**Scale/Scope**: One opt-in preset switch + a remark plugin + a rehype plugin + one shared client render module + the `--dk-diagram-*` promotion (5 call-sites) + a demonstrator page + a deck diagram + assertions. ~7 implementation concerns.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/charter/charter.md`, compact mode). Applicable doctrine + disposition:

- **Settled-design / seam-ADR discipline (C-001)** — every genuinely new seam is an ADR. Satisfied: ADR-0023 + ADR-0024 authored this phase (render ownership, remark/rehype ordering, deck render-path, token promotion + brand wiring). **PASS.**
- **Supply-chain install safety (DIRECTIVE_051)** — new deps (`astro-mermaid@2.1.0`, `mermaid@11.17.1`). Disposition recorded in `research.md` (registry authenticity, freshness, lifecycle-script discipline, Node LTS, peer-range + no-transitive-Playwright check). **PASS (advisory).**
- **Disciplined refactoring / locality** — largely additive; the shared edits (`config.ts` preset option, `theme.ts`/`theme.css`/`tokens.css` token promotion, the two assert scripts, `axe.spec.ts`/`routes.ts`, `DeckLayout.astro` client script) are localized and land atomically with what they protect (C-007). **PASS.**
- **Accessibility-by-construction** — the diagram a11y is delivered by the metadata → `accTitle`/`accDescr` mechanism and asserted **directly** (not via a rule that may not fire) + contrast by vitest. **PASS.**
- Not a bulk edit (`meta.json change_mode` unset; new identifiers, not a cross-file rename) — no `occurrence_map.yaml`. **N/A.**

No violations to justify.

## Project Structure

### Documentation (this mission)

```
kitty-specs/diagrams-01M0VPPG/
├── plan.md              # This file
├── research.md          # Phase 0 — mermaid integration, metadata design, supply-chain, adversarial evidence
├── data-model.md        # Phase 1 — diagram/metadata/figure/statements/tokens/render-owner entities
├── quickstart.md        # Phase 1 — how an author writes a diagram
├── contracts/           # Phase 1 — transform, render-owner, token-map, build-assertion contracts
├── reviews/post-spec-squad.md
└── tasks.md             # Phase 2 (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── config.ts                    # EDIT: opt-in `diagrams` option → prepend mermaid() before starlight(); register the remark+rehype transform
│   ├── remark/
│   │   ├── diagram-meta.ts          # NEW: remark plugin — parse %% block, inject accTitle/accDescr, stash caption on file.data
│   │   └── diagram-meta.internal.ts # NEW: pure parse/inject/placement helpers — vitest target
│   ├── rehype/
│   │   └── diagram-figure.ts        # NEW: rehype plugin — wrap <pre class=mermaid> in <figure>+<figcaption> from file.data
│   ├── diagram/
│   │   └── diagram-render.client.ts # NEW: the single render owner — token→themeVariables, render, [data-theme] re-render
│   └── theme.ts                     # EDIT: promote --dk-diagram-* into DEFAULT_BASE/DEFAULT_DARK + emitTokenSheet
├── styles/theme.css                 # EDIT: --dk-diagram-* :root + [data-theme=dark] (light + dark)
├── themes/spec-kitty/
│   ├── tokens.css                   # EDIT: brand --dk-diagram-* motif (flows via resolveTheme + deck base link)
│   └── assets/diagram-tokens.css    # DELETE: orphan retired (ADR-0024)
├── layouts/DeckLayout.astro         # EDIT: client <script> importing diagram-render.client (deck render path)
├── scripts/
│   ├── assert-build-artifacts.mjs   # EDIT: figure/injected-statements/no-JS/pinned-version assertions; count-pin re-pin
│   └── assert-chrome-artifacts.mjs  # EDIT: catalog/CSS-signature update for the promoted tokens
docs/
├── adr/0023-diagram-render-and-metadata-seam.md         # NEW (authored this phase)
├── adr/0024-diagram-token-promotion-and-brand-wiring.md # NEW (authored this phase)
├── plans/features/diagrams.md       # EDIT (docs of record)
└── architecture/diagrams.md         # NEW (docs of record): the diagrams surface
example/
├── astro.config.mjs                 # EDIT: enable `defineDocKittyIntegrations({ diagrams: true })` — FLIPPED IN THE TRANSFORM WP
└── docs/
    ├── architecture/diagram-demonstrator.md   # NEW: all-fields + title-absent diagrams
    └── presentations/showcase-deck.md         # EDIT: a mermaid fence on the ACTIVE FIRST slide
tests/
├── unit/ (src/tests/)               # NEW: diagram-meta + token-contrast + opt-in-off vitest
└── a11y/{routes.ts,axe.spec.ts}     # EDIT: demonstrator + deck render-gate + direct name/figure assertion; footprint network capture
```

**Structure Decision**: Single toolkit repo (`src/` = the package, `example/` = the demo
CI builds/asserts). New logic is pure helpers in `src/lib/remark|rehype|diagram` (unit-tested
Astro-free) + one Astro-free client module; edits to shared code (config preset, theme
promotion, assert scripts, a11y harness, DeckLayout) are localized. Mirrors the M6 pattern.

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs; the
> Layered-landing note in `spec.md` (the adopted 7-WP shape) guides the split. Critical
> path: plan ADRs → foundation → transform ‖ theme → doc demo/pins → doc a11y ‖ deck ‖ docs.

### IC-00 — Gating decision ADRs (done this phase)

- **Purpose**: Author the render/ordering/deck-script seam (ADR-0023) and the token
  promotion/brand-wiring seam (ADR-0024) before implementation (C-001).
- **Relevant requirements**: FR-015, C-001, C-006, NFR-007.
- **Affected surfaces**: `docs/adr/0023-*.md`, `docs/adr/0024-*.md` (authored in this plan).
- **Sequencing/depends-on**: none — precedes IC-01.

### IC-01 — Foundation: deps + opt-in preset + token promotion + spike

- **Purpose**: Pin the deps (verify peer range, no transitive Playwright), the opt-in
  `diagrams` preset option (`mermaid()` before Starlight, `securityLevel:'strict'`), the
  remark/rehype registration point, and the `--dk-diagram-*` promotion (Default catalog
  light+dark **and** brand `tokens.css`, orphan retired) with the catalog/CSS-signature
  assertion updated **and a token-contrast vitest** — all before anything renders. Also the
  astro-mermaid render-suppression spike (ADR-0023 D1). Example stays `diagrams: false`.
- **Relevant requirements**: FR-001, FR-006, FR-014 (strict), NFR-004, NFR-007; ADR-0024.
- **Affected surfaces**: `src/lib/config.ts`, `src/lib/theme.ts`, `src/styles/theme.css`,
  `src/themes/spec-kitty/tokens.css`, `src/themes/spec-kitty/assets/diagram-tokens.css`
  (delete), `src/scripts/assert-chrome-artifacts.mjs`, `package.json`, a token-contrast +
  opt-in-off vitest.
- **Sequencing/depends-on**: IC-00. Boundary: no diagram renders (example off), all lanes green.
- **Risks**: render-suppression spike outcome selects the fence-transform path; a wrong
  light token value caught by the contrast vitest here, not the a11y lane.

### IC-02 — Transform: remark parse/inject + rehype figure (+ flip example on)

- **Purpose**: The pure `%%` parse + `accTitle`/`accDescr` injection (name from
  title-or-description; at the type-declaration line, skipping init/frontmatter) + the rehype
  `<figure>` wrap, with the Astro-free vitest; **flip `example` `diagrams: true` here** so the
  pre-existing `overview.md` fence renders already-wrapped/named.
- **Relevant requirements**: FR-003, FR-004, FR-005, FR-008, FR-013; NFR-005; ADR-0023 D2/D3.
- **Affected surfaces**: `src/lib/remark/diagram-meta*.ts`, `src/lib/rehype/diagram-figure.ts`,
  `src/lib/config.ts` (register), `example/astro.config.mjs` (flip on), `src/tests/diagram-meta*.test.ts`.
- **Sequencing/depends-on**: IC-01.
- **Risks**: injection placement across diagram types — bound to flowchart/sequence/class +
  init-first/frontmatter-first vitest cases.

### IC-03 — Render owner: token→themeVariables + toggle re-render (doc surface)

- **Purpose**: The single shared client render module — read `--dk-diagram-*` into Mermaid
  `theme:'base'` `themeVariables`, render each `.mermaid`, re-render on `[data-theme]`;
  astro-mermaid `autoTheme` off.
- **Relevant requirements**: FR-002, FR-007, NFR-006, NFR-007; ADR-0023 D1.
- **Affected surfaces**: `src/lib/diagram/diagram-render.client.ts`, `src/lib/config.ts`.
- **Sequencing/depends-on**: IC-01. Runs ‖ IC-02.

### IC-04 — Doc demonstrator + build assertions + pins (unscanned)

- **Purpose**: Publish `architecture/diagram-demonstrator.md` (all-fields **and** a
  title-absent diagram), the build/chrome assertions (figure, injected statements, no-JS
  source+caption, pinned-version golden-file, no-external-request), and the count-pin re-pin —
  a11y still green (page not yet scanned).
- **Relevant requirements**: FR-008, FR-010, FR-012; SC-002/003; C-007.
- **Affected surfaces**: `example/docs/architecture/diagram-demonstrator.md`,
  `src/scripts/assert-build-artifacts.mjs`.
- **Sequencing/depends-on**: IC-02, IC-03.

### IC-05 — Doc a11y: render-gate + direct name/figure assertion + footprint

- **Purpose**: Add the demonstrator to `ROUTES`/`AXE_PAGES` **and** change the axe-harness
  flow (render-gate `figure svg[aria-labelledby]` + `pre.mermaid` no longer raw; **direct**
  accessible-name + figure assertion; axe both modes); the `[data-theme]` toggle re-render
  spec; the footprint via Playwright network capture.
- **Relevant requirements**: FR-011, FR-012 (footprint), NFR-001, NFR-006; SC-002/004.
- **Affected surfaces**: `tests/a11y/routes.ts`, `tests/a11y/axe.spec.ts`, a diagram
  interaction/footprint spec.
- **Sequencing/depends-on**: IC-04.

### IC-06 — Deck diagram (separable)

- **Purpose**: `DeckLayout` imports the shared render module via a client `<script>`; a
  mermaid fence on the showcase deck's **active first slide**; deck smoke test; **update the
  showcase-deck axe entry's render-wait** atomically (the fence otherwise reds the
  already-scanned deck route).
- **Relevant requirements**: FR-009, NFR-001; SC-005; ADR-0023 D4.
- **Affected surfaces**: `src/layouts/DeckLayout.astro`, `example/docs/presentations/showcase-deck.md`,
  `tests/a11y/routes.ts`/`axe.spec.ts` (deck render-wait).
- **Sequencing/depends-on**: IC-02, IC-03, M6 DeckLayout. Runs ‖ IC-04/IC-05; a deck failure
  does not block the doc core.

### IC-07 — Docs of record

- **Purpose**: `docs/plans/features/diagrams.md` (client-side v1 + #13 deferrals) + a new
  `docs/architecture/diagrams.md` (the ADRs already authored in plan).
- **Relevant requirements**: FR-015 (docs half).
- **Affected surfaces**: `docs/plans/features/diagrams.md`, `docs/architecture/diagrams.md`.
- **Sequencing/depends-on**: IC-00 (ADRs). Runs ‖.
