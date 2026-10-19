---
work_package_id: WP02
title: Per-output "last changed" rules in one module (#226)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- NFR-001
- NFR-002
- C-001
- C-002
planning_base_branch: feat/dates-actors-anchors
merge_target_branch: feat/dates-actors-anchors
branch_strategy: Planning artifacts for this mission were generated on feat/dates-actors-anchors. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/dates-actors-anchors unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-dates-actors-anchors-01M5A01Z
base_commit: 043b3c4db5f1707e3e36753ce13b850d885e2741
created_at: '2026-10-19T12:13:37.194572+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 1 - Behaviour
history:
- at: '2026-10-19T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/generator-stamp.mjs
- src/lib/metadata.ts
- src/lib/okf-export/core.mjs
- src/tests/okf-export.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP02 – Per-output "last changed" rules in one module (#226)

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile with the
`/spk-charter-profile-load` skill (profile: **node-norris**). Then run
`spec-kitty charter context --action implement` and apply it. DIRECTIVE_041 (test
economy) is in force: exactly **one** new focused test for this WP, inside the existing
`src/tests/okf-export.test.ts`.

## Objective

Three outputs pick a page's "last changed" date. The operator decided (Decision Moment
`01M5A02GSJ9YZHCEK9SZ482MTY`) to keep a precedence per output, but define the rules side
by side in one module, pinned by one test, and fix a flaw in the OKF rule.

| Output | Rule after this WP |
| --- | --- |
| RSS (`feedDateMillis`, `src/lib/metadata.ts:304`) | `updated`, else `generated.at`. **Unchanged.** |
| OKF export (`generatedFor`, `src/lib/okf-export/core.mjs:169`) | An **ownership** stamp (`isGeneratedStamp(by)`: Gherkin/glossary) supplies `by`, `at` (else `updated`) and `content_hash`. **Any other stamp is ignored**: `by` = first author (who leaves `authors`), else `process:dockitty-export`; `at` = `updated`, else the ignored stamp's `at`; no `content_hash`. |
| Agent API (`metadata.ts:345-362`) | `updated` only. **Unchanged; out of scope.** |

**The flaw**: a scaffolded page carries
`generated: {by: doc-kitty-scaffold/<v>, at: T1}`. The scaffold is provenance-only
(`generator-stamp.mjs:29-35`, `SCAFFOLD_PRODUCER` is not in `PRODUCERS`). After a human
edits the page and bumps `updated` to T2, the export still says `generated.at: T1`
(stale), with `by: doc-kitty-scaffold/<v>`, which falsely claims the scaffold made the
edit.

## Context

- **Spec**: FR-001 to FR-004, US1. **Research**: R2 and R7. **Data model**:
  "Last changed precedence".
- **Inputs differ**: RSS reads raw frontmatter (a `Date`, date-only strings and so on).
  The export reads content-graph nodes whose instants are already canonical strings
  (`docs-index.ts:230`).
  - So `feedInstant` must use `normaliseInstant`.
  - `okfGenerated` must pass strings through unchanged; the export must stay
    byte-identical for every existing case.
- `generator-stamp.mjs` already exports `PRODUCERS` and `isGeneratedStamp`. `metadata.ts:18`
  imports from it. `okf-export/core.mjs` must stay I/O-free; importing
  `generator-stamp.mjs` is fine (it only imports `package.json` as a JSON module), but
  check that the export's Vite/CLI entry (`dockitty-export-okf`) still runs.

## Branch Strategy

- Planning branch: `feat/dates-actors-anchors`. Final merge target:
  `feat/dates-actors-anchors`.
- Your execution worktree is allocated per computed lane from `lanes.json`.
- Implement with `spec-kitty agent action implement WP02 --agent claude --mission dates-actors-anchors-01M5A01Z`.

## Subtasks

### T006 — Red-first: one test pinning both rules

**Steps**:
1. In `src/tests/okf-export.test.ts`, inside `describe('concept frontmatter (FR-025)')`
   (~line 82), or right after it, add **one** `it(...)`:
   "last-changed precedence (#226): RSS and the OKF export on the same three inputs".
2. Build three inline page objects. **Do not** add nodes to `fixtures/okf-export/graph.json`;
   other tests depend on its contents.
   - **A, ownership only**: `generated: {by: 'doc-kitty-gherkin/0.4.0', at: '2026-10-02T09:30:00Z'}`, no `updated`.
   - **B, scaffold + later edit**: `generated: {by: 'doc-kitty-scaffold/0.4.0', at: '2026-10-01T00:00:00Z'}`,
     `updated: '2026-10-05T00:00:00Z'`, `authors: ['human:jane', 'human:joe']`.
   - **C, ownership + different updated**: `generated: {by: 'doc-kitty-gherkin/0.4.0', at: '2026-10-02T09:30:00Z'}`,
     `updated: '2026-10-05T00:00:00Z'`.
   - **D, foreign stamp, no updated**: `generated: {by: 'other-tool/1.0', at: '2026-10-01T00:00:00Z', content_hash: 'sha256:0123456789ab'}`,
     `authors: ['human:jane']`, no `updated`.
3. Assert:
   - **RSS**, through `feedDateMillis` (it exists before the fix; importing `feedInstant`
     before T007 would break the whole file at import): A → 10-02, B → 10-05, C → 10-05,
     D → 10-01.
   - **OKF** (`generatedFor`):
     - A → `{by: gherkin, at: 10-02}`;
     - B → `{by: 'human:jane', at: 10-05}` with `authors: ['human:joe']` and no
       `content_hash`;
     - C → `{by: gherkin, at: 10-02}`;
     - D → `{by: 'human:jane', at: 10-01}`, no `content_hash` (it is red today, because the
       foreign hash passes through).
   - Case C is the positive control for FR-004: if the RSS order ever flipped, C would
     fail.
4. Run it. Cases B and D must FAIL their OKF assertions on current code (B gives
   `by: scaffold`, `at: 10-01`; D passes the foreign stamp and hash through). Save the
   output.

### T007 — The two rules side by side in `generator-stamp.mjs`

**Steps**:
1. Add a short section to `src/lib/generator-stamp.mjs`, in the module's comment style:
   ```js
   // --- "last changed" per output (#226, ADR-0059 implementation notes) --------
   // Two outputs, two questions, so two rules defined side by side, not one:
   // RSS dates a page by when its author last said it changed; OKF's generated.at
   // is the producing tool's last content change, so only an ownership stamp counts.
   ```
2. Export `feedInstant(page)`: `normaliseInstant(page.updated)?.date ?? normaliseInstant(page.generated?.at)?.date ?? null`.
   Import `normaliseInstant` from `./vocabulary-core.mjs`, which `formatInstant` already
   comes from.
3. Export `okfGenerated(page)`, which returns `{ stamp, at }`:
   - `stamp` = `isGeneratedStamp(page.generated?.by) ? page.generated : undefined` (the
     only stamp the export may use);
   - `at` = `stamp?.at ?? page.updated ?? page.generated?.at`.
   The whole OKF order lives here, next to `feedInstant`. Strings pass through
   unchanged. Keep the JSDoc explicit about why the scaffold doesn't count.
4. Give both JSDoc that cites #226 and the other rule.

### T008 — `feedDateMillis` delegates

**Steps**:
1. In `src/lib/metadata.ts:304`, change the body to `feedInstant(data)?.getTime() ?? 0`.
   The behaviour must be identical, including `updated` at epoch 0 (today
   `updatedMillis(data) || …` treats 0 as missing). Keep that exact semantics; if
   `feedInstant` differs for epoch 0, encode the `||` there and test nothing new for it.
2. Replace the JSDoc paragraph "The OKF export … Do not unify the two." with a pointer:
   "The OKF export uses its own rule ({@link okfGenerated}); both are defined side by side in
   `generator-stamp.mjs` (#226)."
3. `rankForFeed` (`metadata.ts:507`) and `rss.ts` must not change.

### T009 — `generatedFor` delegates

**Steps**:
1. In `src/lib/okf-export/core.mjs` `generatedFor(node)` (~169-182), let
   `const { stamp, at } = okfGenerated(node);` replace `node.generated` and the local `at`. The rest of the function
   already gives the "no stamp" behaviour:
   - `by` = first author, else the export process;
   - that author leaves `authors`;
   - `at = stamp?.at ?? node.updated`.
2. The local `const at = stamp?.at ?? node.updated` goes away; `okfGenerated` owns the
   order, including the fallback to a non-ownership stamp's `at` when there is no
   `updated`.
3. Update the function's JSDoc (FR-025 note): "an ownership stamp's `by`/`at`, else the
   first author, else the export process; `at` = the stamp's, else `updated`, else a
   non-ownership stamp's `at` (#226)".
4. `rg "\.generated" src/lib/okf-export`: check that no other export path reads
   `node.generated` directly for `by`/`at`. The `content_hash` passthrough must come only
   from an ownership stamp.

### T010 — Verify

**Steps**:
1. T006 now passes; the whole `okf-export.test.ts` and `okf-export-links.test.ts` pass
   unchanged ((a)–(c) and the two-run byte test).
2. `metadata.test.ts` and `collect-doc-entries-order.test.ts` (feed order) pass unchanged.
3. Example build: `pnpm build`, then run the artifact asserts. Build twice and
   `diff -r` the `dist` copies, including `okf/`, `rss.xml` and `api/`; they must be
   identical (NFR-001).
   - No example page carries a non-ownership stamp, so the `okf/` bytes must also equal
     `main`'s. Compare `okf/` against a build on `origin/main` if feasible; otherwise
     state this in the review note.
4. `pnpm lint` and the typecheck, comparing tsc errors file by file against `main`.

## Definition of Done

- One new test exists and was red before the fix (case B), and is green after.
- RSS dates and order are unchanged; the existing export tests are unchanged; the two
  builds are byte-identical.
- Both rules live in `generator-stamp.mjs` with a comment explaining why there are two.
- Commit with `spec-kitty safe-commit <files> -m "fix(okf-export): count only an ownership stamp as the last content change (#226)"`.

## Risks

- **Changing `feedDateMillis` semantics by accident**: keep the `||` 0-handling exactly.
- **Import cycles**: `generator-stamp.mjs` imports `vocabulary-core.mjs`, never the
  reverse.
- **Docs**: WP04 owns them. Leave the ADR and guide pages alone.

## Reviewer Guidance

- Re-derive each of the 12 assertions from the table in Objective.
- Check that `by` and `at` describe the same event in case B.
- Check that no second "last changed" helper exists elsewhere (`rg -n "generated\?\.at" src/lib`).
