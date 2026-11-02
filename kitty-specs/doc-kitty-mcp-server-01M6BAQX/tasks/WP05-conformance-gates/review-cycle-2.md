---
affected_files: []
cycle_number: 2
mission_slug: doc-kitty-mcp-server-01M6BAQX
reproduction_command:
reviewed_at: '2026-11-01T20:36:10Z'
reviewer_agent: opencode
wp_id: WP05
---

# WP05 review feedback (cycle 2) — reviewer-renata

Cycle-1's planning-artifact defect is correctly fixed at the gate-reading
surface (frontmatter roster now T020/T021; subtask snapshot marks both done;
approval is no longer mechanically blocked). But the lane is now RED: a
latent WP05 harness defect was activated by the legitimate WP04 dependency
merge. The merit pass cannot be inherited — the exercised code surface
changed underneath it.

## Issue 1 (BLOCKING): `golden.test.ts` gated-resources branch fails deterministically since the WP04 merge

**Evidence** (lane-e @ c9bc08d6, clean worktree):
`pnpm --filter @spec-kitty/doc-kitty-mcp test`
→ Test Files 1 failed | 17 passed (18); Tests 1 failed | 161 passed | 1 skipped (163).
Failing: `tests/conformance/golden.test.ts` — "resources gated branch: above
the listing threshold, list omits pages but read still serves bytes
(conditional)" (assertion ~line 194): expected `string(2588B)` vs got
`string(2588B)` — equal LENGTH, different bytes.
Isolated re-run 2/2 identical: `cd mcp && npx vitest run tests/conformance/golden.test.ts -t 'above the listing threshold'`.

**Root cause (proved)**: `tests/conformance/serve-fixture.ts:53` rebases the
fixture's baked origin onto each static server instance's own loopback origin
(`replaceAll(rewriteFrom, base)`), so two server instances serve bytes that
embed *different* `http://127.0.0.1:<port>/` prefixes. The gated-branch test
composes its expectation from `ctx.corpus` — projected in the outer
`beforeAll` against the FIRST, non-gated server (port A) — but the actual
`resources/read` body comes from the SECOND, gated server (port B).
`expectedResourceBody()` returns `page.raw` verbatim for https views, so the
comparison is port-A bytes vs port-B bytes: mismatch at every embedded
origin, equal length when both ports have the same digit width (observed).
Verified with a one-off diagnostic (created, run, deleted): projecting the
corpus from the SAME gated server yields expected === actual, 0 differing
chars. This is not flake; it is structural cross-server sourcing in WP05's
own owned test file.

**Why cycle-1 green did not see it**: the branch early-returns 'skipped'
when `capabilities.resources !== true`. At the cycle-1 reviewed head
(67cf42a5) WP04's surface reported that capability falsely; the WP04 review
fix (0d44a070, "report capabilities.resources truthfully") merged into
lane-e via 1588d93e AFTER cycle 1 and flipped the branch from skipped to
active. The cycle-2 submission claim "code unchanged since cycle-1 merits
pass" is true of WP05-owned files but false of behavior: do not rely on a
prior green across dependency merges that gate conditional test arms —
re-run the suite after each such merge.

**Fix** (implementer):
1. In the gated test, source corpus AND view from the gated server instance:
   `const gatedCorpus = await projectCorpus({ kind: 'http', base: gated.served.base })`
   and use `expectedResourceBody(gatedCorpus, gatedView, …)`; derive slug/ids
   consistently from it. Re-audit every use of `ctx.*` inside the gated
   branch (`expectedSiteSlug(ctx.corpus, gatedView)` mixes port-A corpus with
   port-B view — same defect class even where it happens to pass).
2. Re-run the full mcp suite: the two resources branches must now actually
   RUN (log 'ran', capabilities true — WP04 is present in this lane) and be
   green; a 'skipped' log line for resources is itself a review red flag now.
3. T020's own prompt owns this: "(+ resources both branches when WP04
   landed)" — WP04 has landed in lane-e.

## Issue 2 (non-blocking, record accuracy): stale DoD bullets were NOT struck

Cycle-1 fix instruction part 2 asked to strike/move the three WP08-owned DoD
bullets (C-003 boundary test, NFR-001/002 evidence, serialized-CI lane) with
a pointer to WP08. The fix commit (67f58a06 on `feat/doc-kitty-mcp-server`)
removed only the frontmatter `- T022 / - T023` lines; the DoD bullets remain
verbatim at lines 72–74 of `tasks/WP05-conformance-gates.md`, while the
cycle-2 `for_review` note claims "stale DoD bullets struck". The completion
gate reads the frontmatter roster + event-log snapshot only, so this is no
longer gate-blocking — but please strike the bullets now (or fold into
T029's consistency sweep) so WP05's own file stops contradicting its
Objective paragraph, and keep transition notes truthful.

## Verified good this cycle (do not redo)

- Frontmatter roster on the gate-authoritative copy: exactly T020/T021.
- `tasks.md` consistent: WP05 section carries T020/T021; WP08 section exists
  carrying T022/T023 + boundary/serialized-lane/NFR DoD; header subtask
  accounting agrees.
- Completion-gate refusal is moot: reduced snapshot slot is
  `{T020: done, T021: done}` (T022/T023 'planned' entries are outside the
  roster and correctly ignored per `_check_unchecked_subtasks`).
- `git diff 67cf42a5..c9bc08d6` — WP05-owned paths (`mcp/tests/conformance/**`,
  `mcp/tests/fixtures/**`) and the sanctioned `mcp/src/server.ts` hook: zero
  changes. All deltas since cycle-1 are legitimate coordination/dependency
  merges (WP04's approved surface + status bookkeeping; kitty-specs artifacts).
- Anti-pattern checklist items re-verified where applicable to the new diff:
  no new dead code, no frozen-surface touches, no locked-decision violations
  introduced by the merges.
