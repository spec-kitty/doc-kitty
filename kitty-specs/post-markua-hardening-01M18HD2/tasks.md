# Tasks: Post-Markua Hardening

**Mission**: post-markua-hardening-01M18HD2 | **Branch**: `feat/post-markua-hardening` → merge target `main`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**: [contracts/invariant-contracts.md](./contracts/invariant-contracts.md)

5 work packages, 25 subtasks. All sizes 3–6 subtasks (ideal range). Every fix lands with a regression test that closes its class (post-plan-hardened).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Create `tests/a11y/helpers/colour.ts` (empty-tolerant nodeFill + toRgbTriple; sentinel ≠ real triple; convention note) | WP01 | |
| T002 | Unit-test `colour.ts` (`''`→sentinel, rgb→triple, sentinel≠triple) — race-proof mutation evidence | WP01 | [P] |
| T003 | Refactor `diagram.spec.ts`: import helper, toggle assertions → `toPass({10_000})`, keep token-inequality guard, pin `fillBefore` to a real triple, remove local throwing copies | WP01 | |
| T004 | Refactor `deck.interaction.spec.ts`: import shared toRgbTriple, delete duplicate | WP01 | |
| T005 | Verify: run toggle test 20× per colour mode (0 empty-colour aborts); grep asserts single colour-helper source | WP01 | |
| T006 | Create `src/lib/deck/is-presentation.ts` (isPresentationFile + isPresentationEntry, defensive optional-chain) | WP02 | |
| T007 | Create `src/lib/markua/deck-guard.ts` (guardDeck: no-op on Presentation, preserve name, expose `__inner`) | WP02 | |
| T008 | Wire `config.ts`: wrap remark array (:604) + rehype array (:606) with `.map(guardDeck)`; trim markuaIntegration FORWARD-RULE breadcrumb to point at the parity guard | WP02 | |
| T009 | Fold existing deck checks onto the predicate: `markua-figure.ts:237`, `glossary-autolink.ts:70` (file shape), `metadata.ts:428` (entry shape, fold-if-safe) — behaviour-preserving | WP02 | |
| T010 | `deck-guard.test.ts`: 5 passes no-op on a deck; C36f every :604/:606 member exposes `__inner`; deck-Markua inertness (`{…}`/`W>`/`{aside}` through guarded chain + deckSplit → slide structure equals marker-free deck, structure-adversarial) | WP02 | |
| T011 | Byte-identity: `diff -r` built corpus (baseline vs feat) — deck pages unchanged (NFR-002 falsifier) | WP02 | |
| T012 | Create `src/tests/helpers/remark-stack.ts` (enumerate build remark stages by `doc-kitty:` prefix; loosen SetupHook shim; see through `guardDeck.__inner`) | WP03 | |
| T013 | `glossary-substrate-parity.test.ts`: MIRRORED derived from `page-processor.ts` real plugins; keyed CONSCIOUS_EXCLUSIONS; red-on-unclassified; stage-count floor; each integration registers ≥1 plugin | WP03 | |
| T014 | Behavioural golden-tree: render a fixture through build substrate + re-derive substrate; assert identical mdast for the mirrored set (catches a WRONG exclusion) | WP03 | |
| T015 | Version-parity: assert resolved gfm/smartypants versions equal Astro's (or file a tracked follow-up if infeasible) — not a comment | WP03 | |
| T016 | Trim `page-processor.ts:45-54` breadcrumb to point at the parity guard; keep MIRRORED import path stable | WP03 | |
| T017 | Verify: add a dummy `doc-kitty` remark stage unmirrored → parity test reds naming it; revert | WP03 | |
| T018 | `markua-attributes.ts` `applyBlockFormsToChildren`: coalesce consecutive lone attribute paragraphs, merge entries+id (nearest-wins), attach to first non-attribute block, advance index | WP04 | |
| T019 | `markua-attributes.test.ts`: stacked-attr regression (`{width:"50%"}`+`{alt:"x"}` above one image → both land) | WP04 | |
| T020 | `markua-callouts.test.ts`: de-vacuum three-form test (distinct pre-normalise inputs or move to normalise layer); verify by breaking the fold | WP04 | |
| T021 | ADR-0025 + `docs/architecture/glossary.md`: re-derive parity enforcement note referencing the new guard | WP05 | [P] |
| T022 | `docs/architecture/markua.md` Limits + `slide-decks.md`: deck-scope decision (a) | WP05 | [P] |
| T023 | ADR-0030 Consequences amendment: (a) + pointer to the (b) follow-up issue | WP05 | [P] |
| T024 | `docs/architecture/research/markua-syntax-support.md:~311`: scope breadcrumb (present-tense "presentations" claim falsified by (a)) | WP05 | [P] |
| T025 | `validate:docs` green for the touched docs | WP05 | |

---

## WP01 — a11y colour-read flake (test-only) · Priority P1 (MVP)

- **Goal**: The deck-diagram theme-toggle colour-equality read survives the async re-render flush and never aborts on an empty-colour parse — without weakening the invariant.
- **Independent test**: run `diagram.spec.ts` theme-toggle test 20× per colour mode → 0 `Cannot parse colour ''`.
- **Subtasks**: T001, T002, T003, T004, T005
- **Requirements**: FR-001, FR-002, NFR-001, NFR-003
- **Dependencies**: none
- **Risks**: `toPass` must retry the whole callback; `fillBefore` must resolve to a real triple (else the "genuinely changed" guard degrades); keep DISTINCT from #31. ~300 lines.

## WP02 — deck-scope symmetry (one predicate + registration-site wrap) · Priority P2

- **Goal**: All five Markua passes no-op on Presentation pages as a property of registration-array membership; fold scattered deck checks onto one predicate.
- **Independent test**: `deck-guard.test.ts` — 5 passes no-op on a deck; every array member exposes `__inner`; deck-Markua inertness by slide-structure.
- **Subtasks**: T006, T007, T008, T009, T010, T011
- **Requirements**: FR-005, FR-006, NFR-002
- **Dependencies**: none (coordinates with WP03 on config-array identity — WP03 depends on this)
- **Risks**: `deckSplit` and `remarkDirective` NOT wrapped (out of scope); two frontmatter shapes; behaviour-preserving fold; grep baseline = 4 runtime guards. ~420 lines.

## WP03 — re-derive parity drift guard · Priority P2

- **Goal**: Fail the suite when a build remark stage is neither mirrored nor a keyed conscious exclusion; catch a WRONG exclusion behaviourally.
- **Independent test**: negative check — an unmirrored `doc-kitty` remark stage reds the parity test.
- **Subtasks**: T012, T013, T014, T015, T016, T017
- **Requirements**: FR-003, FR-004
- **Dependencies**: WP02 (needs `guardDeck.__inner` to see through wraps; C-006)
- **Risks**: false-green holes (prefix names, stage-count floor, SetupHook shim); MIRRORED derived not hand-listed; version-parity is closed, not documented-away. ~420 lines.

## WP04 — Markua minor edges · Priority P3

- **Goal**: Close the stacked-attribute-paragraph loss and the vacuous callouts test.
- **Independent test**: stacked-attr regression + non-vacuous three-form test.
- **Subtasks**: T018, T019, T020
- **Requirements**: FR-007, FR-008
- **Dependencies**: none
- **Risks**: coalesce must advance the child index correctly. ~220 lines.

## WP05 — living-documentation sync · Priority P3

- **Goal**: Update every architecture doc whose claim these fixes change; trim the in-code parity breadcrumb’s twin.
- **Independent test**: `validate:docs` green; each named doc reflects the shipped guard/decision.
- **Subtasks**: T021, T022, T023, T024, T025
- **Requirements**: FR-009, FR-010
- **Dependencies**: WP02, WP03 (docs describe the shipped guards)
- **Risks**: Common Docs governance (DIRECTIVE_042) lifecycle frontmatter; amend ADRs, do not create a new one. ~250 lines.

---

## Execution notes

- **Parallel lanes**: WP01, WP02, WP04 are independent → parallelisable. WP03 follows WP02. WP05 follows WP02+WP03.
- **MVP**: WP01 (stops the live CI pain on its own).
- Progress is event-sourced — record subtask completion with `spec-kitty agent tasks mark-status Txxx --status done`, not by editing this file.
