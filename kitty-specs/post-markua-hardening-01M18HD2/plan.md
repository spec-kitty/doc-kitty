# Implementation Plan: Post-Markua Hardening

**Branch**: `feat/post-markua-hardening` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/post-markua-hardening-01M18HD2/spec.md`

## Summary

Close three post-Markua-merge follow-ups as defect *classes*, not instances (charter DIRECTIVE_040/043):

- **#34** — the a11y deck-diagram theme-toggle colour read races the async Mermaid re-render; `expect.poll` doesn't retry on a thrown callback. Fix: replace the throwing read with an empty-tolerant colour helper shared across the a11y specs and switch the toggle assertions to `expect(...).toPass({timeout: 10_000})`. Test-only.
- **#35** — the re-derive substrate mirrors the build remark stack by convention. Fix: a drift-catching parity test that enumerates the build's remark stages (sourced from the same integration array the build uses) and asserts each is mirrored or a keyed conscious exclusion.
- **#36** — only 1 of 5 Markua passes is deck-aware, and the remark passes run before `deckSplit`. Owner decision **(a)**: all five passes no-op on Presentation pages via one shared `isPresentationFile()` predicate + a `guardDeck` wrap at the plugin registration site; fold the scattered `kind === 'Presentation'` copies onto the predicate. **(b)** decks-Markua-capable is deferred to a filed follow-up.

All fixes preserve base behaviour and the merged Markua feature; on today's corpus every guard is a no-op and rendered output stays byte-identical.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM, `"type": "module"`), Node.js 24.x (workspace runs on v24.11.1; Node 24 is current Active LTS — no runtime version change in this mission)
**Primary Dependencies**: Astro + Starlight; unified / remark / rehype pipeline (remark-gfm 4.0.1, remark-smartypants 3.0.3, remark-directive, mdast-util-directive); Playwright 1.62.1 (a11y lane); Vitest (unit); mermaid 11.17.1 (client-side render). **No dependency is added, upgraded, or removed by this mission.**
**Storage**: N/A — static site generator; content is Markdown under the Common Docs root.
**Testing**: Vitest unit suite (`src/tests/**`, 553 passing at baseline); Playwright a11y (`tests/a11y/**`); build/validate/assert scripts (`build`, `validate`, `assert:markua`, `assert:artifacts`). Test-first per DIRECTIVE_034; black-box per DIRECTIVE_036; mutation-effectiveness on changed scope per USE_MUTATION_TESTING (NFR-004).
**Target Platform**: Node build-time (static build) + browser runtime (client Mermaid + theme toggle).
**Project Type**: single (pnpm workspace — `src` toolkit `@commondocs-kitty/toolkit` + `example` site).
**Performance Goals**: no perf regression; the a11y theme-toggle test is deterministic — 0 empty-colour aborts across 20 consecutive headless runs per colour mode (NFR-001/SC-001).
**Constraints**: byte-identical rendered output on the shipped corpus (NFR-002); #34 changes are test-only (NFR-003); consolidation reduces, never expands, the duplicated deck-check smell (C-005); #35/#36 coordinate on the shared config array (C-006).
**Scale/Scope**: 3 issues → 6 implementation concerns; test-only for #34, one small lib seam + registration wrap for #36, test + test-helper for #35, two minor code/test fixes, plus living-docs updates and one filed follow-up issue.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (directive) | Verdict | How this plan satisfies it |
|---|---|---|
| DIRECTIVE_040 / DIRECTIVE_043 — close defect classes by construction | **PASS (scoped, post-plan)** | #36 → registration-site `guardDeck` wrap (array membership, not author discipline; a C36f test asserts every array member is wrapped, so a 6th pass cannot bypass it). #35 → closes *silent drift* by construction (parity test) + catches *wrong exclusion* behaviourally (golden-tree derived from the substrate's real plugins); the **version-drift axis** is closed by a version-parity assertion or a tracked follow-up — not a comment. Not overclaimed beyond that. #34 → shared empty-tolerant helper + `toPass`, duplicate removed, plus a direct unit test (the race makes revert-and-observe probabilistic). |
| DIRECTIVE_034 / DIRECTIVE_036 / DIRECTIVE_041 — test-first, black-box, tests-as-scaffold | **PASS** | Every fix lands with a regression test written to fail first (empty-colour flake reproduced; unclassified-stage red; deck-Markua-inertness; stacked-attr preservation). Tests assert observable behaviour, not internal wiring. |
| DIRECTIVE_037 — living-documentation sync | **PASS** | FR-009 updates ADR-0025 + `docs/architecture/glossary.md` (re-derive parity claim) and `docs/architecture/markua.md` + `docs/architecture/slide-decks.md` + ADR-0030 Consequences (deck-scope decision) in the same change. |
| DIRECTIVE_024 / DIRECTIVE_025 / DIRECTIVE_044 + RECONCILE_CHANGE_SCOPE_TENSIONS | **PASS (bounded)** | Locality kept: #34 stays in test files. Boy-Scout fold is *domain-matched* — the deck-check consolidation folds the deck-domain copies (`markua-figure`, `glossary-autolink`) onto one predicate. The RSS predicate (`metadata.ts`, different `entry.data` shape) is folded only if behaviour-preserving; otherwise left with a breadcrumb pointing at the predicate. `deck-split` is the deck processor and is **never** wrapped. |
| DIRECTIVE_045 / DIRECTIVE_046 — PRs-only, linear history, independent review | **PASS** | Mission lands via a same-repo PR (feat → main); adversarial squad point-cuts post-plan/post-tasks/pre-merge; history rebased/sliced before PR. |
| DIRECTIVE_051 — supply-chain install safety | **N/A (explicit)** | No dependency is added, upgraded, or removed. Registry/freshness/lifecycle-script/Node-LTS checks are not triggered. Recorded here so silence is not mistaken for an unexamined default. |
| USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY | **PASS** | NFR-004: each regression test is verified to fail when its fix is reverted (revert-and-observe on changed scope), the cheap mutation-equivalent for this scope. |

No violations to justify — Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/post-markua-hardening-01M18HD2/
├── plan.md              # This file
├── research.md          # Phase 0 output — consolidated six-lens decisions
├── data-model.md        # Phase 1 output — the seams (predicate, wrapper, allow-list, helper)
├── quickstart.md        # Phase 1 output — how to run/verify each fix
├── contracts/           # Phase 1 output — invariant/test contracts
└── tasks.md             # Phase 2 output (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

Brownfield mission — touches specific existing surfaces, no new top-level structure:

```
src/lib/
├── config.ts                     # remark array :604, rehype array :606 — guardDeck wrap sites; deckSplitIntegration :350/:746 (NOT wrapped)
├── deck/                         # EXISTING dir — add is-presentation.ts (shared predicate)
│   └── is-presentation.ts        # NEW file: isPresentationFile(vfile) + isPresentationEntry(entry); defensive optional-chain
├── markua/
│   └── deck-guard.ts             # NEW: guardDeck(plugin) registration-site wrapper (exposes __inner for #35)
├── remark/
│   ├── markua-normalise.ts       # wrapped via guardDeck at registration
│   ├── markua-attributes.ts      # wrapped; + stacked-attr coalesce fix (FR-007)
│   ├── markua-callouts.ts        # wrapped
│   ├── deck-split.ts:46          # deck processor — folds onto predicate, NOT wrapped
│   └── glossary-autolink.ts:70   # folds onto predicate
├── rehype/
│   ├── markua-figure.ts:237      # wrapped; existing guard folds onto predicate
│   └── markua-toc-demote.ts      # wrapped via guardDeck
├── glossary/
│   └── page-processor.ts         # re-derive substrate — target of the #35 parity guard (unchanged code; documented)
└── metadata.ts:428               # RSS predicate (entry.data shape) — fold-if-safe or breadcrumb

src/tests/
├── helpers/remark-stack.ts       # NEW: extracted combinedRemark enumerator (prefix-derived names)
├── glossary-substrate-parity.test.ts  # NEW: #35 drift guard (MIRRORED vs CONSCIOUS_EXCLUSIONS)
├── markua-attributes.test.ts     # + stacked-attr regression (FR-007)
├── markua-callouts.test.ts       # de-vacuum three-form test (FR-008)
└── deck-guard.test.ts            # NEW: unit assertion all 5 passes no-op on decks

tests/a11y/
├── helpers/colour.ts             # NEW: empty-tolerant toRgbTriple + nodeFill (shared)
├── diagram.spec.ts               # #34 fix: toPass + shared helper; remove local throwing copies
└── deck.interaction.spec.ts      # import shared helper; remove duplicate toRgbTriple

docs/
├── adr/0025-*.md                 # re-derive parity enforcement note (FR-009)
├── adr/0030-markua-*.md          # Consequences amendment: deck scope (a) (FR-009)
└── architecture/{glossary,markua,slide-decks}.md  # parity + deck-scope narrative (FR-009)
```

**Structure Decision**: Single pnpm workspace, brownfield. New code is minimal and placed at neutral seams: the deck predicate in `src/lib/deck/` (not inside `markua/`, so it does not leak deck-knowledge into Markua-only modules — arch lens), the wrapper in `src/lib/markua/deck-guard.ts`, and the parity enumerator in `src/tests/helpers/` (test-only, not `src/lib` — arch lens). A11y colour helper lives in `tests/a11y/helpers/`.

## Complexity Tracking

*No Charter Check violations. Table intentionally empty.*

## Implementation Concern Map

> Concerns are architectural areas, not work packages. `/spec-kitty.tasks` maps these to WPs.

### IC-01 — a11y colour-read flake (test-only)

- **Purpose**: Make the deck-diagram theme-toggle colour-equality read survive the async re-render flush so the a11y lane reflects the real invariant, never an empty-colour abort.
- **Relevant requirements**: FR-001, FR-002, NFR-001, NFR-003, C-002.
- **Affected surfaces**: `tests/a11y/diagram.spec.ts` (toRgbTriple :304, nodeFill :323, toggle reads :511/:513/:528/:541/:547); `tests/a11y/deck.interaction.spec.ts` (duplicate toRgbTriple :299); NEW `tests/a11y/helpers/colour.ts`.
- **Sequencing/depends-on**: none (independent, highest priority).
- **Risks**: `toPass` vs poll semantics — `toPass` retries on any throw and also covers the un-polled reads at :511/:541 that a poll-only fix cannot; `nodeFill` must return a not-ready sentinel (`''`), never throw. Keep DISTINCT from #31 (blocked geometry proof). Deck-spec callers read static chrome tokens on a settled page — share only the `toRgbTriple`/`nodeFill` helper; do not change their (correct) non-toggle assertions.

### IC-02 — re-derive parity drift guard

- **Purpose**: Fail the suite when a build remark stage is neither mirrored into `page-processor.ts` nor recorded as a conscious exclusion — close the #16/#20 parity class by construction.
- **Relevant requirements**: FR-003, FR-004, C-004, C-006.
- **Affected surfaces**: NEW `src/tests/glossary-substrate-parity.test.ts`; NEW `src/tests/helpers/remark-stack.ts` (extract `combinedRemark` from `markua-attributes.test.ts:334`); reads `src/lib/config.ts` integration array and `src/lib/glossary/page-processor.ts`.
- **Sequencing/depends-on**: coordinates with IC-03 (both reason about the config remark array; the parity classifier must key on the `guardDeck`-wrapped identity via `__inner`).
- **Risks / post-plan folds**: false-green holes to plug — derive integration names by `doc-kitty:` prefix (not a hardcoded literal); force `markua:true, diagrams:true` + glossary active so stages appear; add a stage-count floor; loosen the `SetupHook` shim (`markua-attributes.test.ts:315`) and assert each integration registers ≥1 plugin. `MIRRORED` must be **derived from `page-processor.ts`'s real plugins** (not hand-listed), plus a **behavioural golden-tree** so a *wrong* `CONSCIOUS_EXCLUSIONS` entry reds. **Version-drift axis is closed**, not documented-away: a version-parity assertion (resolved gfm/smartypants == Astro's) or a tracked follow-up.

### IC-03 — deck-scope symmetry (one predicate + registration-site wrap)

- **Purpose**: Make all five Markua passes no-op on Presentation pages as a property of registration-array membership, so no present-or-future pass transforms deck content.
- **Relevant requirements**: FR-005, FR-006, C-003, C-005, C-006, SC-003.
- **Affected surfaces**: NEW `src/lib/deck/is-presentation.ts`, NEW `src/lib/markua/deck-guard.ts`; `src/lib/config.ts:604` (remark array) + `:606` (rehype array) wrapped with `.map(guardDeck)`; fold `src/lib/rehype/markua-figure.ts:237` and `src/lib/remark/glossary-autolink.ts:70` onto the predicate; NEW `src/tests/deck-guard.test.ts`; a deck-Markua-inertness fixture/assertion.
- **Sequencing/depends-on**: IC-02 coordination (shared config array + identity keying).
- **Risks / post-plan folds**: `deckSplit` must NOT be wrapped (deck processor); `remarkDirective` (`config.ts:567`) is also out of scope — it parses native `:::` before deckSplit, a pre-existing directive/deck interaction; do NOT widen `guardDeck` to cover explicit `:::` (scope creep). C36a is therefore scoped to **Markua-syntax inputs** (`{…}`/`W>`/`{aside}`) and asserts **slide/section structure** (structure-adversarial fixture), not body-equality. Two frontmatter shapes — `file.data.astro.frontmatter.kind` (plugins) and `entry.data.kind` (RSS `metadata.ts:428`); predicate exposes both, with the defensive optional-chain. `guardDeck` exposes `__inner`; a C36f test asserts every `:604`/`:606` member is wrapped (closes AS-3). Folding is strictly behaviour-preserving; grep baseline is **4** runtime guards (exclude enum decls + comments).

### IC-04 — Markua minor edges

- **Purpose**: Close the two minor Markua edges while the code is open (Boy Scout, domain-matched).
- **Relevant requirements**: FR-007, FR-008.
- **Affected surfaces**: `src/lib/remark/markua-attributes.ts` `applyBlockFormsToChildren` (stacked-attr coalesce, merge `entries` + hoisted-`id`, nearest-wins) + regression in `src/tests/markua-attributes.test.ts`; `src/tests/markua-callouts.test.ts` three-form de-vacuum (distinct pre-normalise inputs or move to the normalise layer).
- **Sequencing/depends-on**: independent of IC-01..IC-03 (can parallelise).
- **Risks**: the coalesce must correctly advance the child index after splicing; low likelihood, no shipped fixture hits it, so the regression test is the proof.

### IC-05 — living-documentation sync

- **Purpose**: Update the architecture docs whose claims these fixes change, in the same mission (DIRECTIVE_037).
- **Relevant requirements**: FR-009.
- **Affected surfaces**: `docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md` (re-derive parity enforcement note pointing at the new guard); `docs/architecture/glossary.md` (twin narrative); `docs/architecture/markua.md` Limits + `docs/architecture/slide-decks.md` (deck-scope decision (a)); `docs/adr/0030-markua-preprocess-to-directive.md` Consequences amendment. **(post-plan) Also**: `docs/architecture/research/markua-syntax-support.md:~311` present-tense "supports … presentations" claim → scope breadcrumb; and trim the **in-code** FORWARD RULE breadcrumbs (`config.ts` markuaIntegration docstring, `page-processor.ts:45-54`) to point at the new guard.
- **Sequencing/depends-on**: follows IC-02 and IC-03 (docs describe the shipped guards).
- **Risks**: Common Docs governance (DIRECTIVE_042) — docs carry lifecycle frontmatter; keep the delete-stale/single-source discipline. Do not create a new ADR (amend existing ones) — a new ADR is warranted only if (b) is ever pursued.

### IC-06 — deferred (b) follow-up filing

- **Purpose**: Capture the decks-Markua-capable design as a tracked issue so the deferred intent is not lost.
- **Relevant requirements**: FR-010, SC-005, C-003.
- **Affected surfaces**: a new GitHub issue (compose-with-deckSplit, PR #33 hero conflict, deck-Markua fixture + a11y gate); referenced from the ADR-0030 amendment.
- **Sequencing/depends-on**: filed before mission close (post-merge consolidation).
- **Risks**: none — administrative; ensure it links back to #36 and the ADR amendment.
