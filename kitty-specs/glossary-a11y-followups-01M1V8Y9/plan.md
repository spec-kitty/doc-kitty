# Implementation Plan: Glossary a11y follow-up cluster (#77/#78/#79)

**Branch**: `feat/glossary-a11y-followups` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/glossary-a11y-followups-01M1V8Y9/spec.md`

## Summary

Three coupled slices on the glossary bounded context, delivered on
`feat/glossary-a11y-followups` and landing via a PR to `main`:

1. **#79 (refactor, IC-01)** — extract the two byte-identical link-node builders
   (`makeLinkNode` in `glossary-autolink.internal.ts`, `glossaryLinkNode` in
   `glossary-term.ts`) into one shared builder in `src/lib/glossary/link-node.ts`,
   beside `glossaryTermUrl`. Both call sites import it; the auto-linker wraps its
   `surface` string into `children` (the only per-caller delta).
2. **#77 (a11y, IC-02)** — add an `aria-label` = `"<visible text>, glossary term"`
   to the shared builder, so every glossary term anchor announces its term-ness to
   assistive technology in the server-rendered HTML (no-JS-safe). Attribute, not a
   text child, so it never enters the `textContent`-based links-used surface.
3. **#78 (coverage, IC-03)** — add e2e assertions in `tests/a11y/glossary.spec.ts`
   for `data-placement` (bottom for a high term, top for a viewport-flipped low
   term) and caret presence.

Implementation order is IC-01 → IC-02 → IC-03: the extracted builder is the single
home for the affordance attribute, so extracting first keeps the affordance a
one-line addition and lets the parity test cover both emitters for free.

## Technical Context

**Language/Version**: TypeScript 5.x (Node ≥ 20, ESM) on Astro 5 + Starlight
**Primary Dependencies**: existing only — `unified`/remark mdast pipeline,
`@playwright/test` (e2e), `vitest` (unit); **no new dependencies added or upgraded**
**Storage**: N/A (static docsite; glossary sourced from `.contextive/definitions.yaml`)
**Testing**: vitest unit (run serial, `fileParallelism:false`) + Playwright a11y/e2e
(`test:a11y`) + the repo's validate/assert gate scripts; parity guards
(`glossary-link-node-parity.test.ts`, `glossary-substrate-parity.test.ts`)
**Target Platform**: statically-built site (Linux CI build; browsers via Playwright)
**Project Type**: single (Astro toolkit package + `example/` demonstrator site)
**Performance Goals**: no runtime perf target; the affordance adds one static
attribute at build time — no new client code path, popover chunk footprint unchanged
**Constraints**: corpus delta is exactly the new `aria-label` (NFR-003); both parity
guards stay green (NFR-001/002); glossary-free builds stay byte-identical (NFR-002 of #64)
**Scale/Scope**: 3 source modules + 1 new file + 1 e2e spec + docs (architecture +
ADR/changelog); blast radius entirely inside the glossary bounded context

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/doctrine`, template set `software-dev-default`). Relevant
directives and how this plan satisfies them:

- **DISCIPLINED_REFACTORING** (IC-01): the extraction is behaviour-preserving — the
  cross-emitter parity test and full suite must stay green before and after; no
  behaviour change rides along with the move (the `aria-label` is a separate,
  explicitly-specified IC-02 change, not a silent refactor side-effect).
- **DIRECTIVE_041 (test coverage of behaviour)** (IC-03): #78 exists precisely
  because positioning behaviour has no automated guard — this plan adds it.
- **DIRECTIVE_001 / DIRECTIVE_024 (architectural integrity / locality of change)**:
  changes are confined to the glossary bounded context (C-003); the new builder
  sits beside its sibling (`glossaryTermUrl`) in `src/lib/glossary/`.
- **DIRECTIVE_003 / DIRECTIVE_010 (decision + spec fidelity)**: the affordance
  mechanism is recorded (decision `01M1V8ZYHJYYVGY438PB166WAX`, C-002) and the
  architecture doc + an ADR/changelog note will capture the a11y contract.
- **Supply-chain (DIRECTIVE_051)**: N/A — no dependency is added, upgraded, or
  removed. Silence here is compliance because there is no dependency decision.

No charter violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/glossary-a11y-followups-01M1V8Y9/
├── plan.md              # This file
├── spec.md              # Committed (f8b2f4e)
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
├── contracts/           # Phase 1 output (this command)
├── checklists/          # requirements.md (committed)
├── decisions/           # DM-01M1V8ZYHJYYVGY438PB166WAX (committed)
└── tasks/               # Phase 2 output (/spec-kitty.tasks — NOT this command)
```

### Source Code (repository root)

```
src/lib/glossary/
├── link-node.ts             # NEW — the ONE shared glossary link-node builder (IC-01/IC-02)
├── resolve.ts               # glossaryTermUrl (unchanged; builder sits beside it)
└── types.ts                 # SharedTermIndex etc. (unchanged)

src/lib/remark/
├── glossary-autolink.internal.ts  # makeLinkNode → delegates to shared builder (IC-01)
└── glossary-term.ts               # glossaryLinkNode → delegates to shared builder (IC-01)

src/styles/
└── dk-components.css        # .dk-glossary-link block (unchanged; visual cue stays)

src/tests/
├── glossary-link-node-parity.test.ts   # cross-emitter parity (must stay green; extend to assert aria-label)
├── glossary-substrate-parity.test.ts   # re-derive parity (must stay green)
├── glossary-autolink.test.ts           # per-builder golden (update for aria-label)
└── glossary-term.test.ts               # per-builder golden (update for aria-label)

tests/a11y/
└── glossary.spec.ts         # e2e — ADD placement/caret assertions (IC-03); count-pins unchanged

docs/
├── architecture/glossary.md # update the "Hover preview footprint" section for the a11y affordance
├── adr/                     # short ADR or changelog note for the aria-label a11y contract
└── ...                      # CHANGELOG / adr-index kept valid (validate:adr-index gate)
```

**Structure Decision**: Single-project Astro toolkit. The new builder lives in
`src/lib/glossary/` (the glossary bounded context's home for pure, framework-free
logic), imported by the two remark plugins in `src/lib/remark/`. No new top-level
directory; no cross-context edits.

## Complexity Tracking

*No charter violations — section intentionally empty.*

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Extract the shared glossary link-node builder

- **Purpose**: Collapse the two byte-identical builders into one authored shape so
  they cannot drift; make room for IC-02's attribute in a single place.
- **Relevant requirements**: FR-003, NFR-001, C-001, C-004
- **Affected surfaces**: NEW `src/lib/glossary/link-node.ts`;
  `src/lib/remark/glossary-autolink.internal.ts` (`makeLinkNode` call site wraps
  `surface`→`children`); `src/lib/remark/glossary-term.ts` (`glossaryLinkNode` call
  site); keeps href via `glossaryTermUrl` (resolve.ts, unchanged).
- **Sequencing/depends-on**: none (first).
- **Risks**: the auto-linker passes `surface: string`, `:term` passes
  `children: MdastNode[]` — the shared signature takes `children` and the
  auto-linker wraps its surface (`[{type:'text',value:surface}]`); the two hand-rolled
  `MdastNode`/`MdNode` structural interfaces differ, so the shared builder needs a
  minimal shared node type (or a structural type both files can satisfy) without
  pulling in `@types/mdast`. Parity test is the safety net.

### IC-02 — AT-perceivable term affordance (aria-label)

- **Purpose**: Make the term/link distinction perceivable to assistive tech, SSR,
  no-JS — the flagged #77 gap and the mission's only behaviour change.
- **Relevant requirements**: FR-001, FR-002, FR-005, NFR-003, NFR-005, C-002
- **Affected surfaces**: the shared builder (`link-node.ts`) — compose
  `aria-label = "<concatenated children text>, glossary term"` into `hProperties`;
  extend `glossary-link-node-parity.test.ts` and the two per-builder golden tests
  to pin the new attribute; update `docs/architecture/glossary.md` footprint section
  + an ADR/changelog note.
- **Sequencing/depends-on**: IC-01 (needs the single builder to exist).
- **Risks**: (a) the concatenated-children text must equal the visible surface so
  the accessible name stays in sync (NFR-005) and the used-list surface is
  untouched (FR-005) — reuse the same text-concatenation the builders/collector
  already use; (b) must NOT add a counted `text` child (would rot the links-used
  count-pins); (c) rich `:term` labels must degrade to plain text in the label.

### IC-03 — Popover placement + caret e2e guard

- **Purpose**: Give the caret / `data-placement` / viewport-flip positioning an
  automated regression guard (#78, DIRECTIVE_041).
- **Relevant requirements**: FR-004, SC-002
- **Affected surfaces**: `tests/a11y/glossary.spec.ts` only — add assertions for
  `data-placement="bottom"` (high term), `data-placement="top"` (flipped low term),
  and caret presence (the `::before`/`::after` render + the
  `--dk-glossary-caret-left` custom property being set).
- **Sequencing/depends-on**: none (independent of IC-01/IC-02; can run in parallel).
- **Risks**: forcing a reliable upward flip requires a term positioned low in the
  viewport (scroll a low term into view / size the viewport) so `spaceBelow <
  popoverHeight`; the caret is drawn by CSS pseudo-elements (not queryable as a
  node) — assert the observable proxies (`data-placement` + the caret custom
  property / computed pseudo-element) rather than a non-existent caret element.
