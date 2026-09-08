# Implementation Plan: Example content from ars-rethorica

**Branch**: `feat/ars-rethorica-example` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/ars-rethorica-example-01M204RR/spec.md`

## Summary

Add a nested **Rhetoric showcase** inside the existing `example/` docsite by
converting Book I of the CC-BY-SA-4.0 `ars-rethorica` Markua manuscript into
doc-kitty pages, and ship **footnotes** as a first-class opt-in Markua feature so
the footnote-dense source renders correctly. The showcase lives under
`example/docs/rhetoric/` as a custom three-book section (ADR-0004 tolerated
path), converts the source's definition-list glossary into a native Contextive
glossary context, wires constructed reader personas through the audience surface,
and carries CC-BY-SA-4.0 attribution. The flagship convention-dogfood content is
untouched, and with the Markua preset off the build stays byte-identical.

The only pipeline code change is the footnote normaliser; everything else is
content authoring, a conversion transform, YAML/registry wiring, and gate
bookkeeping. No new runtime dependency is introduced (footnotes reuse the
already-present `remark-gfm` 4.0.1).

## Technical Context

**Language/Version**: TypeScript 5.x (ESM, `.js` import specifiers), Node ≥22, pnpm 11.22.0; content authored in Markdown + curated Markua subset.
**Primary Dependencies**: Astro + Starlight, `remark-directive` (single-owner, ADR-0030), `remark-gfm` 4.0.1 (**already present** — GFM footnotes reused, no new dep), unified/mdast/hast, Contextive glossary seam. Footnote feature adds a new in-repo pass only.
**Storage**: Repo-committed files — converted Markdown pages under `example/docs/rhetoric/`, `example/.contextive/definitions.yaml`, `example/docs/_meta/{sections.yaml,bibliography.yaml}`.
**Testing**: vitest (`src/tests/markua-footnotes.test.ts`, `fast` project); `assert:markua` fixture gate; Playwright+axe (`tests/a11y`, opt-in routes); `assert:artifacts`/`assert:no-broken-links`; `markdownlint-cli2` + Vale (doc-sanity).
**Target Platform**: Static Astro build to GitHub Pages under base `/doc-kitty`.
**Project Type**: single (monorepo: `@commondocs-kitty/toolkit` in `src/` + `example/` site).
**Performance Goals**: Byte-identical example build when Markua preset OFF (NFR-001); deterministic page/sitemap/feed ordering (NFR-006).
**Constraints**: Docsite/presentations only — no book/manuscript pipeline (C-001); CC-BY-SA-4.0 share-alike + dual attribution (C-002); Book I complete only, II/III landing-only (C-003); fixed Markua stretch split (C-004); orchestrator-owned commits, fresh subagents (C-005). Root-absolute content links only; new published page ⇒ +1 to both `assert-build-artifacts.mjs` count pins.
**Scale/Scope**: ~18–22 new pages (Intro, Preamble, 15 chapters, rhetoric hub + 3 book landings, license/about page, 1–3 personas), 1 new remark pass (`markua-footnotes.ts` + `.internal.ts`) with unit tests + assert:markua fixture + ADR, 1 new glossary context (~10 terms).

## Charter Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **DIRECTIVE_001 (Architectural Integrity)**: PASS — footnote pass follows the established `.ts` (remark-facing) / `.internal.ts` (pure, remark-free state machine) split; no cross-boundary leakage; content and pipeline concerns kept separate.
- **DIRECTIVE_003 / DIRECTIVE_010 (Decision & Spec Fidelity)**: PASS — footnote feature + degradation rules captured in a light ADR (FR-013); conversion decisions recorded in `research.md`.
- **DIRECTIVE_035 (Bulk-Edit)**: N/A — this mission creates new identifiers/pages; it does not rename an existing string across many files. `change_mode` stays default (no `occurrence_map.yaml`).
- **DIRECTIVE_051 (Supply-Chain Install Safety)**: PASS — **no dependency added/upgraded/removed** (footnotes reuse existing `remark-gfm`); no lifecycle-script surface change. Recorded in `research.md` as no-op.
- **ADR-0004 / ADR-0009**: Custom `rhetoric` section is the tolerated path (degrades, warns, never fails). No new frontmatter field is introduced (attribution uses body prose + `external_references` + bibliography, not a new `license` field) — avoids an ADR-0009 field-addition.

No unjustified violations. Complexity Tracking not required.

## Project Structure

### Documentation (this mission)

```
kitty-specs/ars-rethorica-example-01M204RR/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions + footnote spike + adversarial/supply-chain evidence
├── data-model.md        # Phase 1 — showcase entities
├── quickstart.md        # Phase 1 — build & verify recipe
├── contracts/           # Phase 1 — footnote-feature + conversion + frontmatter contracts
└── research-notes/       # source census (pre-collected)
```

### Source Code (repository root)

```
src/lib/remark/
├── markua-footnotes.ts            # NEW — thin remark plugin: rewrites Markua [^^N] → GFM footnotes
└── markua-footnotes.internal.ts   # NEW — pure normaliser (no remark/unified/Astro imports)
src/lib/config.ts                  # EDIT — register footnote pass inside markuaIntegration() remark array
src/tests/markua-footnotes.test.ts # NEW — end-to-end (unified+gfm) + pure-internal unit coverage
src/scripts/assert-markua-builds.mjs  # EDIT — extend gate with a footnote fixture assertion
src/scripts/assert-build-artifacts.mjs # EDIT — bump EXPECTED_INDEX_ENTRY_COUNT + EXPECTED_SITEMAP_URL_COUNT

docs/adr/00NN-markua-footnotes.md  # NEW — ADR for footnote feature + degradation rules

example/docs/rhetoric/             # NEW showcase section (custom, ADR-0004)
├── index.md                       # rhetoric hub (kind: Hub)
├── about-and-license.md           # CC-BY-SA-4.0 attribution + provenance
├── introduction.md                # from Introduction.md
├── preamble.md                    # from BookOnePreamble.md (glossary extracted to Contextive)
├── book-one/
│   ├── index.md                   # Book I landing (kind: Hub)
│   └── chapter-01..15.md          # 15 converted chapters
├── book-two/index.md              # Book II landing-only
└── book-three/index.md            # Book III landing-only
example/docs/context/audience/     # NEW personas (kind: Persona)
example/.contextive/definitions.yaml   # EDIT — add `rhetoric` glossary context
example/docs/_meta/sections.yaml       # EDIT — register {id: rhetoric, ...}
example/docs/_meta/bibliography.yaml   # EDIT — Freese/Perseus source records
tests/a11y/routes.ts               # EDIT — opt in ~2 representative rhetoric routes to AXE_PAGES
```

**Structure Decision**: Single project. Pipeline change is isolated to two new
`src/lib/remark/` files plus a registration edit. Showcase content is a new
top-level `example/docs/rhetoric/` tree with three book subfolders that nest
automatically in the Starlight sidebar; only the top-level `rhetoric` section is
registered in `sections.yaml`.

## Implementation Concern Map

> Concerns are architectural areas, not work packages. `/spec-kitty.tasks`
> translates these into WPs (one IC may split into several WPs, or small ICs may
> merge).

### IC-01 — Footnote Markua feature (pipeline)

`markua-footnotes.ts` + `.internal.ts` normalising Markua `[^^N_M]` markers and
`[^^N_M]:` definitions to GFM footnotes rendered by the already-present
`remark-gfm`. Registered inside `markuaIntegration()` (gated by the `markua`
preset), deck-scoped (guardDeck or internal `isPresentationFile` — decided in
research), byte-identical when preset OFF. Includes unit tests, an
`assert:markua` fixture extension, and the ADR (FR-004, FR-013, NFR-001).
**Depends on the Phase-0 footnote spike** (does GFM already parse `[^^0_1]`?).

### IC-02 — Conversion transform

A deterministic transform (script + review) turning manuscript chapters into
doc-kitty pages: strip book directives (`{pagebreak}`/`{mainmatter}`/`{copyright}`),
map `{class: part}` files to section landings, degrade `[#t](#anchor)` to
root-absolute links with readable text, normalise callout aliases
(`class: info`→information, bare `icon: pencil`→mapped), keep `[^^N]` footnotes
and `{blurb, icon:}` callouts and `{#id}` anchors intact, and prepend doc-kitty
frontmatter. Output is vendored, committed pages (FR-001, FR-006, FR-007, FR-011).

### IC-03 — Showcase section & content

`example/docs/rhetoric/` tree, `sections.yaml` registration, the rhetoric hub +
Book I landing + Book II/III landing-only pages, and the converted Intro +
Preamble + 15 chapters with frontmatter, `glossary_context`, and inter-chapter
navigation via root-absolute links (FR-001, FR-002, FR-003).

### IC-04 — Native glossary

Add a `rhetoric` context to `example/.contextive/definitions.yaml` from the
source Preamble definition list (~10 terms with aliases/examples); set
`glossary_context: rhetoric` on rhetoric pages so terms autolink; the build
generates `example/docs/glossary/rhetoric/index.md` (FR-008).

### IC-05 — Personas & audience wiring

1–3 constructed `kind: Persona` pages in `example/docs/context/audience/`
(role/goals/responsibilities), referenced from rhetoric pages via `audience`
(FR-009).

### IC-06 — Attribution & licensing

`rhetoric/about-and-license.md` stating CC-BY-SA-4.0 + crediting Freese/Perseus
and the Dejongh revamp; `bibliography.yaml` records cited via `external_references`
from converted pages; a short in-body CC-BY-SA notice/link on showcase pages
(FR-010, C-002).

### IC-07 — Gates & integration

Bump both ratchet counts by the number of non-draft pages; add inline
`<!-- markdownlint-disable -->` to Markua-bearing pages; opt ~2 representative
rhetoric routes into `AXE_PAGES`; verify markdownlint + Vale + link-integrity +
full build; update the feature page `doc_status` and the roadmap MoSCoW row
(FR-012, NFR-002…006).
