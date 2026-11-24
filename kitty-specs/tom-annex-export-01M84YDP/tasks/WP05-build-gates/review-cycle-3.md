---
affected_files: []
cycle_number: 3
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T06:55:44Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review cycle 3: REJECT

Reviewer: claude::reviewer-renata. Lane head reviewed: 43e5e75. The review flow's auto-rebase merged the coordination branch into the lane. The code is in e7bed2b, and `git diff e7bed2b 43e5e75 -- . ':!kitty-specs'` is empty.

## Blocking

**Issue 1: an unknown key under `scopes` passes the gate with zero problems. That breaks SC-001's "0 extra".**

`tomAnnexProblems` iterates only `['system', 'organisation']` and never looks at any other key of `annex.scopes`. Each of these edits to the good fixture passes with **no problems at all**:

```js
// the same covered measure listed a second time, under a scope that does not exist
a.scopes.vendor = [structuredClone(a.scopes.system[0])];
// an uncovered measure also listed as "covered", citing a page that is not built
a.scopes.vendor = [{ id: a.uncovered[0].id, label: 'x', evidence: [{ url: `${PREFIX}x/` }] }];
```

The second edit is the worst case. The measure is listed twice (in `uncovered` and under `scopes.vendor`), and its evidence URL is never checked by `pageBuilt`. That is because the `pageBuilt`, triple and accounting checks all live inside the two-key loop.

The shipped schema forbids this (`scopes` has `additionalProperties: false`, with only `system` and `organisation`). Nothing validates the built file against that schema, though. The only schema check is in `tom-annex-core.test.ts`, and it runs on `buildTomAnnex` output, not on the built artifact.

This is the same class of hole as cycle 2's two blockers: the builder never emits it, but the gate accepts it while SC-001 fails.

**Fix:** report any key of `annex.scopes` other than `system` and `organisation`. For example: `evidence index: unknown scope: vendor`. Optionally, also fail when `scopes` is not an object. Add a negative unit case, red first.

## Non-blocking

- **N1. A `null` entry makes the check throw instead of reporting.**
  - Examples: `a.scopes.system.push(null)` and `a.scopes.system[0].evidence.push(null)`. The code uses `entry.id` / `ref.url` without `?.`, so it throws a TypeError.
  - The gate still fails closed: the top-level await rejects and the process exits non-zero. So this is a message-quality issue, not a hole.
  - It is cheap to fix: `entry?.id` / `ref?.url`, and report a non-object entry.

## Verified fixed

- **Cycle-2 blocker 1 (empty scope entry counted as covered).**
  - The exact cycle-2 repro (move `backup` from `uncovered` into `scopes.system` with `evidence: []`) now reports both `a scope entry has no evidence: backup` and `not accounted for ... backup`.
  - An entry counts as covered only when it has evidence. `evidence` given as a non-array string also reports "no evidence".
- **Cycle-2 blocker 2 (a measure twice under one scope).**
  - The empty-twin repro and the split-evidence repro both report `listed twice under system: access-control`.
  - The set is per scope. Listing a measure once in each scope still passes: sharing `inScope` across scopes turns 17 of 20 tests red, the good fixture included.
- **Cycle-2 N1.** The `[...listed]` narrowing is now killed by the new stray-covered-id case.

## Adversarial checks with no hole found

Each of these is reported:
- empty-string evidence URL, alone or alongside others;
- an evidence URL that is not built;
- an evidence ref with no `url`;
- an id differing only in case (covered) or whitespace (uncovered, including a whitespace twin);
- `scopes.system: null` and `scopes: null`;
- a `null` uncovered item, and `uncovered: null`;
- a numeric id;
- a scope entry with no `id`.

The one exception is the unknown scope key (Issue 1 above).

## Mutations (each of the 14 killed)

`src/tests/assert-build-artifacts-tom-annex.test.ts`, 20 tests. Each of these mutations turned at least one test red:
- dropping the listed-twice-in-scope check;
- dropping the no-evidence error;
- counting an empty entry as covered while still reporting it;
- sharing `inScope` across scopes;
- narrowing the catalog loop to `[...listed]`, and separately to `[...covered]`;
- dropping the uncovered-twice check;
- dropping the both-covered-and-uncovered check;
- dropping the unaccounted check;
- dropping the whole catalog check;
- dropping the duplicate-triple check;
- dropping `pageBuilt`;
- dropping the extra-triple check;
- dropping the missing-triple check.

## Surface

Cycle 3 touches only `src/lib/tom-annex/verify.mjs` and `src/tests/assert-build-artifacts-tom-annex.test.ts`. The whole WP05 range (`daccab22..e7bed2b`, excluding kitty-specs) is the same 7 files accepted in cycle 2. There are no stray changes.

## Gates on lane-e (43e5e75)

- Full `pnpm test`: src 237 files / 4597 tests passed; mcp 23 files / 181 tests passed; exit 0.
- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
