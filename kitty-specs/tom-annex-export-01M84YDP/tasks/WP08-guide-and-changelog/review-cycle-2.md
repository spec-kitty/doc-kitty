---
affected_files: []
cycle_number: 2
mission_slug: tom-annex-export-01M84YDP
reproduction_command: spec-kitty agent tasks move-task WP08 --to approved --mission tom-annex-export-01M84YDP --agent claude::reviewer-renata
reviewed_at: '2026-11-24T20:33:12Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP08
---

Approved by claude::reviewer-renata: approval:WP08

# WP08 review, cycle 2: APPROVE (claude::reviewer-renata)

Reviewed da7bc9e5 on `feat/401-tom-annex-export` (one commit on f94a64b5),
against the WP07 code on lane-g at 6134ce5c. Coordination at e814589a.

`git diff f94a64b5 da7bc9e5` touches only `docs/guides/tom-annex.md`
(+23/−8). Every hunk is one of the cycle-1 folds; no other text changed.

## Cycle-1 findings, re-verified by running the CLI on lane-g

I used the example site's committed snapshot as `<dist>/api/tom-annex.json`
(it is the built index's exact bytes) and ran `src/scripts/tom-annex.mjs`.

| # | Fold | Verdict | Evidence |
|---|---|---|---|
| R1 | A `by` bump makes both files `stale-render` | PASS | `by` 0.7.1 → 9.9.9 in the built index: `--check` prints `stale-render snap.json` and `stale-render hub.md`, exit 1. Not blocked on OQ1. |
| R2 | "The hub page needs a date" | PASS | `generated.at: null`, `--snapshot --hub`: `[dk-tom-annex] the hub page needs a date …`, exit 2. Fresh targets: neither file created. Existing owned targets: both unchanged (md5). |
| N1 | A refused write names the file, writes nothing, exits 1 | PASS | Authored `hub.md`: `refusing to overwrite hub.md: it is not stamped by doc-kitty-tom-annex`, exit 1, `snap.json` not created. |
| N2 | Commit both files with LF (`eol=lf`) | PASS | CRLF copies of both files: `stale-render` ×2, exit 1. |
| N5 | The gate recomputes neither `source_digest` nor `generated.at` | PASS | `verify.mjs` checks `content_hash` only; `contentHash()` strips `generated`, so `at` is outside it. |
| N6 | Per-file, not atomic across both | PASS | Preload making `renameSync` throw EBUSY for `hub.md` only: `wrote snap.json`, then exit 2; snapshot is new, hub unchanged, no `.tmp` left; `--check` → `stale-render hub.md`; a rerun writes both and `--check` exits 0, as the guide says. |
| N7 | "published classified pages" (two places) | PASS | `scan.mjs` applies `draftRoutesOf`; `integrations/tom-annex.ts` gates on `hasPublishedClassifiedPages`; the CLI's own message says "no published classified pages?". |
| N4 | `unowned` cites PR #454's amendment of ADR-0087 D3 | PASS | #454 is merged and adds `unowned` to D3; on the target branch's ADR it is still only a Follow-up, so the citation is needed. |
| — | Issue-matrix `evidence_ref` refreshed | PASS | #401's ref now reads "WP01-WP07 approved (lanes a-g), WP08 docs on feat/401-tom-annex-export"; status.json agrees (WP01–WP07 `approved`). All 7 rows have a decided verdict (2 in-mission, 5 not-applicable); the cited spec lines (6, 260, 270, 274) say what the refs claim. |
| N8 | Regenerate-hint code fix | DEFERRED to R24 | Accepted. Still observed: the hint names only `--hub` and the script path. |

## Coordination status merge (171 → 177)

Merge efb4bf55 has parents with 173 and 175 events from a 171-event base; the
merge holds 177, which is exactly their union (none lost from either parent,
none invented). HEAD now has 183: all 177 retained, plus 6 later WP08 events.
There are no duplicate `event_id`s and no duplicate lines.

## Non-blocking nits

1. **The null-`at` paragraph reads as if every write fails.** A
   `--snapshot`-only write with a null `at` succeeds (exit 0). Consider
   "a write that names `--hub` then exits `2` …". This is accuracy polish, not
   an error: the paragraph sits under the hub heading.
2. **The new bullet is followed by a blank line,** which turns the "Some limits
   follow" list into a loose list (every item becomes a `<p>`). markdownlint
   accepts it; drop the blank line if the tighter spacing is wanted.

## Compliance wording

No sufficiency or compliance claim anywhere in the guide or the changelog
fragment. Every "legal"/"sufficient" hit is a disclaimer (the caution block,
"makes no claim that the listed measures are adequate or legally sufficient",
the ⚖ notice row).

## Gates (feat/401-tom-annex-export @ da7bc9e5)

- `lint` and `typecheck`: exit 0.
- `validate:docs`: 218 files valid, the 4 pre-existing warnings.
- `validate:links`: 1952 internal references resolve across 301 files.
- `validate:changelog`: OK, 13 fragments.
- markdownlint on the 3 changed files (guide, changelog fragment,
  `metadata-model.md`): 0 issues.
- `pnpm test`: src 241 files / 4745 tests passed; mcp 23 files / 181 tests
  passed. No flakes, and no glossary side effects to stash.
- Vale 3.18.0 **was not run**. The pinned binary is not installed, and running
  a downloaded copy was not permitted in this session. The implementer reports
  0 errors and 0 warnings.

## Anti-pattern checklist

| # | Item | Result |
|---|---|---|
| 1 | Dead code | N/A (docs only) |
| 2 | Synthetic-fixture test | N/A |
| 3 | Silent empty return | N/A |
| 4 | FR coverage | FR-013, FR-004, NFR-003, C-001: covered; R1/R2 gaps closed |
| 5 | Frozen surface | PASS |
| 6 | Locked decision | PASS (no compliance claim; label verbatim) |
| 7 | Shared-file ownership | PASS (only the guide changed this cycle) |
| 8 | Production fragility | N/A |
