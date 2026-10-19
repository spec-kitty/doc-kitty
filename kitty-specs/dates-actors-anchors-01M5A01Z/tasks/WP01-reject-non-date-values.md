---
work_package_id: WP01
title: Reject non-date values through the one parser (#227)
dependencies: []
requirement_refs:
- FR-006
- FR-007
- FR-008
- FR-009
- NFR-003
- C-003
planning_base_branch: feat/dates-actors-anchors
merge_target_branch: feat/dates-actors-anchors
branch_strategy: Planning artifacts for this mission were generated on feat/dates-actors-anchors. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/dates-actors-anchors unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-dates-actors-anchors-01M5A01Z
base_commit: cf68e575c4ca15ff847cd18c2e3a334bd7201208
created_at: '2026-10-19T12:13:14.200984+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
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
- src/lib/vocabulary-core.mjs
- src/lib/schema.ts
- src/scripts/validate-frontmatter.mjs
- src/tests/schema-validator-parity.test.ts
- src/tests/vocabulary-core.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP01 – Reject non-date values through the one parser (#227)

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile with the
`/spk-charter-profile-load` skill (profile: **node-norris**). Then run
`spec-kitty charter context --action implement` and apply it. DIRECTIVE_041 (test
economy) is in force: strengthen existing tests, and add no new test file.

## Objective

Today `normaliseInstant` (`src/lib/vocabulary-core.mjs`) accepts anything `new Date()`
parses (flag `nonIso`), so `updated: "1"` becomes 2001-01-01 with only a warning, and a
YAML number such as `updated: 1` becomes 1970 + 1 ms. Separately, a stamp's `at`
(`generated.at`, `verified[].at`) gets no instant check in either validator twin.

Make the one parser refuse values that aren't date-shaped, and give stamp instants the
same check, so both twins reject `"1"`-style values. Every realistic form that built
before must keep building with the same advisory.

## Context

- **Spec**: `kitty-specs/dates-actors-anchors-01M5A01Z/spec.md`, FR-006 to FR-009 and US2.
- **Research**: `research.md` R3, R4 and R5. **Data model**: `data-model.md`, "Date-shaped value".
- **The rule** (decided; do not invent another): only the non-ISO fallback branch
  changes. ISO-shaped values, including rollover, zone-less, `±HHMM`/`±HH` and no-seconds
  forms, never reach it.
  - A `number` becomes `null`.
  - A non-ISO string is kept only if it is a year-month (`^\d{4}-\d{1,2}$`), has a month
    name plus a digit, or has at least three numeric groups. Otherwise it becomes `null`.
  - A `Date` object is unchanged.
- **Evidence the rule was run against the current parser**:
  - rejects `"1"`, `"2024"`, `"1/2"`, `"abc 2024"`, `"2024.5"`;
  - keeps `"May 1, 2024"`, `"May 2024"`, `"1 May 2024"`, `"1/2/24"`, `"2024-10"`,
    `"Tue, 01 Oct 2024 10:00:00 GMT"`.
  - V8 matches month names by prefix, so `"Decimal 2024"` and `"1.2.3"` stay accepted;
    note this in the helper's comment, and change nothing for it.
- **Callers that treat `null` as absent**: `src/lib/docs-index.ts:224` (`instantOf`),
  `src/lib/metadata.ts:290/305`, `src/scripts/generate-adr-index.mjs:77`, and
  `Persona.astro:94`. Confirm none throws on `null` (T005).

## Branch Strategy

- Planning branch: `feat/dates-actors-anchors`. Final merge target:
  `feat/dates-actors-anchors`.
- Your execution worktree is allocated per computed lane from `lanes.json`; do not pick a
  base by hand.
- Implement with `spec-kitty agent action implement WP01 --agent claude --mission dates-actors-anchors-01M5A01Z`.

## Subtasks

### T001 — Red-first: parity ROWS and parser rows

**Purpose**: prove the defect before fixing it (C-003).

**Steps**:
1. In `src/tests/schema-validator-parity.test.ts`, `ROWS` (~line 568), add reject rows
   (`reject = true`, needle `null`):
   - `['bare-number string updated', 'context/x.md', page({ updated: '1' }), true, null]`
   - `['YAML number updated', ..., page({ updated: 20241001 }), true, null]`
   - `['small YAML number updated', ..., page({ updated: 1 }), true, null]`
   - `['YAML number generated.at', ..., page({ generated: { by: 'doc-kitty-gherkin/0.3.0', at: 1 } }), true, null]`
   - `['year-only updated', ..., page({ updated: '2024' }), true, null]`
   - `['two-group numeric updated', ..., page({ updated: '1/2' }), true, null]`
   - `['word plus year updated', ..., page({ updated: 'abc 2024' }), true, null]`
   - `['decimal updated', ..., page({ updated: '2024.5' }), true, null]`
   - `['bare-number stale_after', ..., page({ stale_after: '12' }), true, null]`
   - `['bare-number generated.at', ..., page({ generated: { by: 'doc-kitty-gherkin/0.3.0', at: '1' } }), true, null]`
   - `['bare-number verified at', ..., page({ verified: { by: 'human:jane', at: '1' } }), true, null]`
2. Add keep rows (`reject = false`):
   - `['numeric US-style updated', ..., page({ updated: '1/2/24' }), false, 'not ISO']`
   - `['rolled-over calendar updated', ..., page({ updated: '2026-02-30' }), false, 'not a real calendar date']`
     (check the exact advisory text at `validate-frontmatter.mjs` ~line 324)
   - `['month-year updated', ..., page({ updated: 'May 2024' }), false, 'not ISO']`
   - `['year-month updated', ..., page({ updated: '2024-10' }), false, 'not ISO']`
3. In the `normaliseInstant` unit tests (same file, ~lines 634-660):
   - add `'1'`, `'2024'`, `'1/2'`, `'abc 2024'`, `'2024.5'`, `1` and `20241001` to the
     `null` loop;
   - retitle "…anything Date parses" to describe the new accept-set;
   - assert `'1/2/24'` and `'May 2024'` still return `nonIso: true`.
   - `vocabulary-core.test.ts` holds no `normaliseInstant` cases; they all live in this
     parity file (~636-661), so the parser rows go here.
4. Run `pnpm --filter ./src exec vitest run src/tests/schema-validator-parity.test.ts`
   (or the repo's `pnpm test -- <file>`). The new reject rows and parser rows must FAIL.
   Save the failing output for the review note.

**Validation**: the failing output lists the new rows; every pre-existing row still passes.

### T002 — Date-shape rule inside `normaliseInstant`

**Purpose**: one parser decides (FR-009).

**Steps**:
1. In `src/lib/vocabulary-core.mjs`:
   - `normaliseInstant` currently routes a `number` to `legacyInstant(v)` (~line 260).
     Return `null` for a number instead.
   - For strings, keep `isoInstant(text)` first. Only when it is `null` and the text is
     not rolled over (keep the `isRolledOver` path exactly), require
     `isDateShaped(text)` before `legacyInstant(text)`.
2. Add a small private helper `isDateShaped(text)`. Suggested shape:
   ```js
   const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
   /** A non-ISO string reads as a date only with a month name and a number, or three numeric groups (#227). */
   function isDateShaped(text) {
     return /^\d{4}-\d{1,2}$/.test(text) || (MONTH.test(text) && /\d/.test(text)) || (text.match(/\d+/g) ?? []).length >= 3;
   }
   ```
3. Update the JSDoc above `normaliseInstant` (~lines 230-252):
   - the `nonIso` bullet now covers "a written-out or numeric date (a month name and a
     number, or three numeric groups)";
   - add a sentence that a number, or any other string, is `null` (#227).
   - Keep the comment density of the surrounding code.
4. Keep `legacyInstant` itself. Its `number` parameter type can narrow to `string` if no
   other caller passes a number (`rg legacyInstant`).

**Edge cases**: `'Tue, 01 Oct 2024 10:00:00 GMT'` has a month name, so it is kept.
`'2026-02-30'` is ISO-shaped, so it is kept as a rollover. `' 1 '` trims to `'1'` and is
rejected.

### T003 — `stampAt` instant check in both twins

**Purpose**: `generated.at` and `verified[].at` get the same verdict as `updated` (FR-006).

**Steps**:
1. In `src/lib/schema.ts` (~lines 153-156), change
   `z.preprocess((v) => (v instanceof Date ? formatInstant(v) : v), z.string())` so the
   string must also satisfy `normaliseInstant(v) !== null`. For example:
   `.refine((s) => normaliseInstant(s) !== null, { message: 'not a date: write YYYY-MM-DDTHH:MM:SSZ' })`.
   The value stays a string (no type change for consumers). Give the inner `z.string()`
   the same message, so a YAML number in `at` (e.g. `at: 1`) also names the accepted
   form.
2. Delete the stale comment "older pages carry a hash here, so no instant check — only
   the gate warns". The `sha256:` form was retired in 0.4.0 (ADR-0059:214). Replace it
   with one line saying the stamp's `at` is checked by the same parser (#227).
3. Mirror the change in `src/scripts/validate-frontmatter.mjs` (~line 148), where
   `stamp = z.object({ by, at: stampAt })`. Same refine, same message.

**Check**: both twins import `normaliseInstant` already; confirm.

### T004 — Gate error wording; one error for a retired stamp

**Purpose**: the gate's message names the field and the accepted form, and a retired
stamp is not double-reported.

**Steps**:
1. In the gate twin (`validate-frontmatter.mjs`), give the `instantDate` failure a
   message, for example
   `z.date({ message: 'not a date: write a UTC instant, YYYY-MM-DDTHH:MM:SSZ' })`.
   Check how the gate prints Zod issues (it prefixes the path, so the field is named).
   Keep the Astro twin's message identical if it's trivial to do; parity compares
   verdicts only.
2. A page with `generated: { by: 'doc-kitty/gherkin', at: 'sha256:…' }` is already
   reported by `retiredStampProblem` (~line 456). It must not also report the new
   `at` date-shape issue. The gate prints Zod issues in the loop at ~463-467
   (`` `${issue.path.join('.')}`: ${message} ``). In that loop, skip an issue whose path
   is `generated.at` when `retired` (line 456) is set.
3. Run `src/tests/legacy-stamp-removal.test.ts`. Its `toMatch` assertions must still pass.
   If a test there asserts an exact error count, update that one assertion and say why
   in the review note.
4. Strengthen the existing message assertion at `schema-validator-parity.test.ts:511-512`
   so that it checks the message for `updated: "1"` names `updated` and
   `YYYY-MM-DDTHH:MM:SSZ`. Do not spawn the CLI for this, and do not add a new test.

### T005 — Verify callers and gates

**Steps**:
1. `rg -n "normaliseInstant\(" src`: confirm every caller handles `null` (list them in
   the review note).
2. Run the full parity file; all T001 rows now pass, red becomes green.
3. `node src/scripts/validate-frontmatter.mjs src/tests/fixtures/old-forms` must exit 0
   with the same advisories (the NFR-004 describe block covers this too).
4. Run the frontmatter gate on `docs/` and `example/docs/` (see `package.json` scripts,
   e.g. `pnpm validate:frontmatter`). Both must pass.
5. `pnpm lint` and the typecheck. Compare tsc errors file by file against `main`
   (`git stash`, or compare against a run on `origin/main`); no new errors are allowed.
6. Run the full `pnpm test` in this worktree. If dependencies are missing in the lane
   worktree, say so; the orchestrator runs the integrated suite after consolidation.

## Definition of Done

- T001's new rows fail before T002–T004 and pass after.
- No pre-existing row or test changes verdict, except `normaliseInstant` titles or
  comments.
- The old-forms tree exits 0 with unchanged advisories; the docs and example gates pass.
- Both twins carry the same rule; `normaliseInstant` is the only place it is defined.
- `pnpm lint` is clean; tsc errors per file are no more than on `main`.
- Commit with `spec-kitty safe-commit <files> -m "fix(metadata): reject non-date values in instant fields (#227)"`.

## Risks

- A YAML number that some adopter relied on now fails. That is intended (FR-006);
  WP04 calls it out in the changelog.
- Over-broad rejection: run the docs and example gates before handoff.
- The Astro schema now rejects a retired `at: sha256:…` with "not a date"; before, the
  build accepted it and only the gate failed it. Note this in the review note (WP04
  mentions it in the changelog).

## Reviewer Guidance

- Check the red-first evidence (failing output for the T001 rows).
- Try each kept form from `data-model.md` in both twins.
- Confirm a retired stamp yields exactly one problem.
- Confirm no second date parser was introduced (`rg "new Date\(" src/lib src/scripts`
  shows no new validation path).
