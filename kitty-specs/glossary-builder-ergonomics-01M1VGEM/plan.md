# Implementation Plan: Glossary builder ergonomics (#83)

**Branch**: `feat/glossary-builder-ergonomics` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/glossary-builder-ergonomics-01M1VGEM/spec.md`

## Summary

One behaviour-preserving cleanup slice on the glossary bounded context,
delivered direct-to-feat on `feat/glossary-builder-ergonomics` and landing via
a PR to `main` (Closes #83):

1. **IC-01 — one subtree-text helper.** Export the existing `textOf` from
   `src/lib/glossary/link-node.ts` (renamed for clarity where useful) and delete
   the two duplicates: `textContent` in `glossary-autolink.internal.ts` and
   `textOf` in `glossary-term.ts`. All three call sites (aria-label
   composition, `collectLinksUsed` + `seedFromExistingLinks`, `:term`
   label/warning/suppress/fallback) import the one helper.
2. **IC-02 — assignable builder type.** Declare `GlossaryLinkNode` as a
   `type` alias (implicit string index signature) instead of an interface. A
   TypeScript probe (see [research.md](./research.md) D2) shows the missing
   index signature is the *only* blocker; the alias form was chosen over an
   explicit `[key: string]: unknown` on the interface after the squad showed
   the latter disables excess-property checking on the builder's return
   literal. Both call sites drop their `as unknown as` casts entirely.
3. **IC-03 — contract wording.** Update the #77/#79 contract
   (`kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`)
   so the assignability sentence names the mechanism and states no cast is
   needed (true as of #83).
4. **IC-04 — optional test nits.** Tighten the e2e caret-offset assertion to a
   `px` length that sits inside the positioning code's clamp band and tracks
   the anchor centre (a bare `≥ 8` is tautological under `Math.max`, per the
   squad), and correct the parity test's header docstring to describe the
   `toEqual` as a re-fork guard over the one shared builder.

Everything is behaviour-preserving: a fresh `example/dist` build is hashed
before (234 files, captured at branch start) and after, and must match
file-for-file (NFR-001 / SC-003).

## Technical Context

**Language/Version**: TypeScript 5.x (Node ≥ 20, ESM) on Astro 5 + Starlight
**Primary Dependencies**: existing only; **no dependency added, upgraded or
removed** (C-002; no `@types/mdast`)
**Storage**: N/A (static docsite)
**Testing**: vitest unit (serial, `fileParallelism:false`; run from `src/`
because the root `node_modules` is sparse) + Playwright a11y/e2e (`test:a11y`,
needs `--output` override locally) + the repo's validate/assert gate scripts;
parity guards (`glossary-link-node-parity.test.ts`,
`glossary-substrate-parity.test.ts`); `tsc --noEmit -p src/tsconfig.json`
diffed against a captured baseline of 30 pre-existing unrelated errors
(`astro check` OOMs locally; CI typechecks)
**Target Platform**: statically-built site (Linux CI; browsers via Playwright)
**Project Type**: single (Astro toolkit package + `example/` demonstrator site)
**Performance Goals**: none; pure build-time code motion
**Constraints**: byte-identical corpus (NFR-001); parity guards untouched
(NFR-003); no new tsc errors (NFR-004); glossary bounded context only (C-003)
**Scale/Scope**: 3 source modules, 2 test files, 1 contract document; ~60 lines
net removed

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/doctrine`, template set `software-dev-default`).

- **DISCIPLINED_REFACTORING** (all ICs): the entire mission is a refactor
  with an explicit byte-identical-output oracle (hashed `example/dist`) and the
  full gate suite as the safety net. No behaviour change rides along; the two
  optional test edits only tighten assertions/docstrings, never weaken them.
- **DIRECTIVE_001 / DIRECTIVE_024 (architectural integrity / locality)**: all
  edits sit inside the glossary bounded context; the sibling hand-rolled
  `MdastNode` interfaces in deck-split / diagram-meta are deliberately not
  touched (C-003).
- **DIRECTIVE_010 (documentation fidelity)**: IC-03 makes the prior mission's
  contract true rather than leaving a known-false sentence.
- **DIRECTIVE_041 (tests prove behaviour)**: IC-04 makes two guards say what
  they actually prove.
- **DIRECTIVE_051 (supply chain)**: N/A; no dependency decision is made.

No charter violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/glossary-builder-ergonomics-01M1VGEM/
├── plan.md              # This file
├── spec.md              # Committed (b6e858f)
├── research.md          # Phase 0: D1 helper home, D2 assignability probe, D3 caret bound
├── checklists/          # requirements.md
└── tasks/               # Phase 2 output (/spec-kitty.tasks)
```

No `data-model.md` / `contracts/` / `quickstart.md`: the mission introduces no
new data shape or interface. The one contract touched is the prior mission's
`shared-link-node.md` (IC-03), edited in place.

### Source Code (repository root)

```
src/lib/glossary/
└── link-node.ts             # textOf → EXPORTED helper (IC-01); GlossaryLinkNode becomes a type alias (IC-02)

src/lib/remark/
├── glossary-autolink.internal.ts  # delete textContent, import helper (IC-01); drop `as unknown as MdNode` (IC-02)
└── glossary-term.ts               # delete textOf, import helper (IC-01); drop `as unknown as MdastNode` (IC-02)

src/tests/
├── glossary-link-node-parity.test.ts   # header docstring only (IC-04); assertions unchanged
├── glossary-link-node.test.ts          # unchanged (rich-label + empty-surface edges stay green)
├── glossary-autolink.test.ts           # unchanged golden
├── glossary-term.test.ts               # unchanged golden
└── glossary-substrate-parity.test.ts   # unchanged; must stay green with no new exclusion

tests/a11y/
└── glossary.spec.ts         # caret-offset assertion tightened (IC-04); count-pins unchanged

kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/
└── shared-link-node.md      # assignability sentence corrected (IC-03)
```

**Structure Decision**: no new files. The helper stays in `link-node.ts`
(already imported by both remark modules, so consolidation adds no new import
edge); see research D1 for the alternative rejected.

## Complexity Tracking

*Empty — no charter violations.*

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — One exported subtree-text helper

- **Purpose**: remove the three-way duplication of the text concatenator so the
  accessible name, the links-used surface and the `:term` label are derived by
  one function.
- **Relevant requirements**: FR-001, FR-002, NFR-001, NFR-003, C-001, C-004
- **Affected surfaces**: `src/lib/glossary/link-node.ts` (export the helper;
  strict `typeof value === 'string'` on `text` leaves, recurse into `children`
  otherwise); `src/lib/remark/glossary-autolink.internal.ts` (delete
  `textContent`; `collectLinksUsed` and `seedFromExistingLinks` call the
  import); `src/lib/remark/glossary-term.ts` (delete `textOf`;
  `transformDirective` calls the import).
- **Sequencing/depends-on**: none (first).
- **Risks**: the three variants differ on paper only for non-mdast input
  (non-string `value`, `text` node with `children`); the consolidated helper
  must match all three for real input, which the byte-identical corpus and the
  count-pins prove. Keep the helper's parameter type minimal and structural
  (`LinkChild`), so both `MdNode` and `MdastNode` arguments are accepted
  without casts (they already are: both carry an open index signature).

### IC-02 — Builder return type assignable to both callers

- **Purpose**: re-enable the compile-time shape check at the two call sites by
  making `GlossaryLinkNode` structurally assignable to `MdNode` and
  `MdastNode`.
- **Relevant requirements**: FR-003, NFR-004, C-002
- **Affected surfaces**: `GlossaryLinkNode` in `link-node.ts` becomes a
  `type` alias; the two call sites return the builder result directly (no
  cast). Update the module docstring that currently claims the callers'
  interfaces are assignable "without a shared runtime dependency" so it
  names the implicit index signature as the mechanism (return direction
  only; the argument direction is plain structural width).
- **Sequencing/depends-on**: none (independent of IC-01; same files).
- **Risks**: none known; verified by a tsc probe before planning (research D2).
  Guard: `tsc --noEmit -p src/tsconfig.json` error count must not exceed the
  30-error baseline and must show no glossary/remark file.

### IC-03 — Contract wording

- **Purpose**: make the prior mission's contract true.
- **Relevant requirements**: FR-004, SC-005
- **Affected surfaces**:
  `kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`,
  the last bullet of "The one builder".
- **Sequencing/depends-on**: IC-02 (wording describes its mechanism).
- **Risks**: none.

### IC-04 — Optional test-honesty nits

- **Purpose**: make the caret-offset e2e assertion and the parity docstring
  say what they prove.
- **Relevant requirements**: FR-005, FR-006, NFR-002
- **Affected surfaces**: `tests/a11y/glossary.spec.ts` (`caretLeftProperty`
  assertions: match `/^\d+(\.\d+)?px$/`, then a one-`evaluate` geometry
  check: within `[8, width-8]` and within 1px of the anchor centre or the
  nearest clamp edge); the header docstring of
  `src/tests/glossary-link-node-parity.test.ts`.
- **Sequencing/depends-on**: none.
- **Risks**: the a11y suite must still pass in both colour modes; if the
  tighter bound flakes locally for environment reasons (root-owned
  `test-results/`, font-flaky visual baselines) rely on CI as the verifier and
  do not loosen the bound below the documented clamp.
