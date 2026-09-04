# Implementation Plan: Diagram markup + component-CSS delivery fixes

**Branch**: `fix/diagram-component-css` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/diagram-component-css-01M1PA3J/spec.md`

## Summary

Fix malformed Mermaid figure markup (#59) at its remark origin, write the missing figure/caption stylesheet (#60), and deliver global component CSS (callouts + diagrams) to branded docs and out-of-frame decks (#68) via a standalone stylesheet that survives brand slot-0 replacement — then close the mutation-dead zone with build-artifact + computed-style gates. Approach is grounded by a completed research pass + 4-lens as-is squad (see [research.md](./research.md)); this plan does not re-open those decisions.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 24 (Astro 5.18.2 toolkit); ESM `.mjs`/`.ts`
**Primary Dependencies**: Astro 5.18.2, `@astrojs/starlight` 0.32.6, `mdast-util-to-hast` 13.2.1, `mermaid` 11.17.1, vitest, Playwright
**Storage**: N/A (static site generation)
**Testing**: vitest unit (`src/tests/**`, `tests/**`), Playwright a11y lane (`tests/a11y/**`), Node build-artifact asserts (`src/scripts/assert-*.mjs`, `pnpm assert:artifacts`)
**Target Platform**: Static HTML (in-frame Starlight docs + out-of-frame reveal decks), rendered in modern browsers; theme-aware light/dark
**Project Type**: single (toolkit package `src/` + example consumer `example/`)
**Performance Goals**: no build-time or runtime regression; diagrams render client-side (one `mermaid.run`, INV-SINGLE-OWNER)
**Constraints**: fix at the remark seam (retype node off `code`), standalone component sheet as its own `customCss` entry + `DeckLayout` link, caption uses general text tokens, keep `pre:not(.mermaid)` + code-block `tabindex`, no build-time SVG (#13 deferred), do not re-enable #31 geometry asserts, dated changelog fragment
**Scale/Scope**: toolkit change touching ~4-6 source files + example content (a deck fixture) + gates; 6 diagrams / 3 pages affected today

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`software-dev-default`, no extra paradigms). Relevant directives honored:
- **DIRECTIVE_024 (locality/blast-radius)** — fix at the single origin seam (`config.ts` remark), smallest change; the other 5 `hName` projection sites are correct and untouched.
- **DIRECTIVE_043/040 (close the class by construction)** — retyping the node makes a double-wrapped figure impossible for every consumer, not a downstream patch; backed by a build-artifact gate.
- **DIRECTIVE_001 (separation of concerns)** — remark emits a clean element, rehype owns the figure, CSS owns presentation; a short ADR makes the seam explicit.
- **DIRECTIVE_041 / USE_MUTATION_TESTING** — new gates are mutation-true (verified red on each re-introduced defect).
No violations to justify. No new dependency added/upgraded/removed → supply-chain section N/A (silence justified: zero dependency delta).

## Project Structure

### Documentation (this mission)

```
kitty-specs/diagram-component-css-01M1PA3J/
├── plan.md              # This file
├── research.md          # Phase 0 — squad-grounded decisions
├── data-model.md        # Phase 1 — DOM/CSS-delivery contracts
├── quickstart.md        # Phase 1 — how to verify locally
└── tasks.md             # Phase 2 (/spec-kitty.tasks)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── config.ts                     # #59 fix seam (mermaidFenceTransform) + customCss wiring (#68)
│   └── rehype/diagram-figure.ts      # figure builder (UNCHANGED unless fallback)
├── styles/
│   ├── theme.css                     # remove global component rules from here (#68) …
│   ├── dk-components.css  (NEW)       # … relocate .dk-callout* + add .dk-diagram* here (#60/#68)
│   └── dk-reveal-theme.css           # keep pre:not(.mermaid) guard
├── layouts/DeckLayout.astro          # link dk-components.css for decks (#68); keep tabindex loop
└── scripts/assert-build-artifacts.mjs # new no-<pre>-wraps-figure + CSS-delivery asserts (#59/#60/#68)

example/
└── docs/presentations/               # add a published deck fixture with a Mermaid diagram (FR-004)

tests/
├── a11y/diagram.spec.ts              # computed-style caption check on docs + deck (#60)
└── (unit) src/tests/diagram-*.test.ts # pipeline-level unit exercising real remark→hast→rehype (#59)

docs/
├── adr/                              # short ADR: remark→rehype→CSS figure ownership seam
└── changelog/2026-09-04-*.md         # dated fragment (repo convention)
```

**Structure Decision**: Single toolkit package (`src/`) with an example consumer (`example/`); the fix lives in the toolkit, verified against the branded example build. Exact new-sheet filename (`dk-components.css` vs `dk-diagram.css` + move callouts) is finalized in tasks — the invariant is *one standalone sheet, own customCss entry + DeckLayout link*.

## Complexity Tracking

No Charter Check violations. N/A.

## Implementation Concern Map

> Concerns are not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Diagram markup correctness (#59)

- **Purpose**: Emit a single well-formed `<pre class="mermaid">` so the figure is never nested in a stray `<pre>`.
- **Relevant requirements**: FR-001, NFR-001, NFR-003, C-001
- **Affected surfaces**: `src/lib/config.ts` (`mermaidFenceTransform`, ~:403-421); `src/lib/rehype/diagram-figure.ts` (unchanged; fallback unwrap only if a downstream remark consumer breaks on the retyped node); `src/lib/diagram/diagram-render.client.ts` (verify `pre.mermaid` selector still matches)
- **Sequencing/depends-on**: none (foundational)
- **Risks**: a downstream remark plugin keying on `type==='code'` for the mermaid node — `diagramMeta` runs BEFORE the retype (order pinned), so it is unaffected; confirm no other consumer. accTitle/accDescr live in `node.value` (untouched).

### IC-02 — Component CSS delivery under branding (#60 + #68)

- **Purpose**: Author the figure/caption stylesheet and deliver global component CSS (callouts + diagrams) to branded docs pages AND out-of-frame decks.
- **Relevant requirements**: FR-002, FR-003, NFR-002, NFR-004, C-002, C-003
- **Affected surfaces**: NEW standalone component sheet (relocate `.dk-callout*` out of `src/styles/theme.css` + add `.dk-diagram*`); `src/lib/config.ts` customCss wiring (add as its OWN entry so it survives the slot-0 replacement at ~:670-671); `src/layouts/DeckLayout.astro` (explicit `<link>`); `src/tests/theme-merge.test.ts` (update the default-path `customCss` shape invariant deliberately, NFR-004)
- **Sequencing/depends-on**: IC-01 (caption rules assume the figure is out of the `<pre>`)
- **Risks**: breaking the no-theme byte-contract silently — update the invariant test as part of the change; keep caption on general text tokens, not `--dk-diagram-*`.

### IC-03 — Verification, fixture & docs (#59/#60/#68, FR-004/FR-005)

- **Purpose**: Close the mutation-dead zone and exercise the deck diagram path.
- **Relevant requirements**: FR-004, FR-005, SC-001..005
- **Affected surfaces**: `src/scripts/assert-build-artifacts.mjs` (no-`<pre>`-wraps-`figure.dk-diagram` across all 3 diagram pages + branded-page ships `.dk-callout`/`.dk-diagram` rules); a pipeline-level unit running the real `remark→hast→rehype` chain; `tests/a11y/diagram.spec.ts` (caption computed-style not-monospace/white-space-normal on docs AND deck); NEW `example/docs/presentations/*` deck fixture with a Mermaid diagram; short ADR + dated changelog fragment
- **Sequencing/depends-on**: IC-01, IC-02
- **Risks**: false-green (rule bundled ≠ applied) — pair CSS-presence assert with the computed-style check on both shells; do NOT re-enable #31 geometry asserts; `architecture/overview` (currently untested) must be in the assert set.
