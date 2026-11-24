---
affected_files: []
cycle_number: 1
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T18:29:52Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP07
---

# WP07 review, cycle 1: REJECT (claude::reviewer-renata)

Reviewed lane-g at f8c898c5 (e9a5035d + f8c898c5), range 57b261cb..f8c898c5.

The production code is correct. Every verdict path I ran by hand gave the
verdict ADR-0087 D3 (with the #454 amendment) requires. All gates are green.
The rejection is for two **test gaps on behaviour the WP names explicitly**.
My independent mutation run killed 25 of 30 mutants, not the claimed 12/12.
One survivor is equivalent; the two below are required.

## Required (blocking)

**R1. Refusing an authored snapshot is untested.**
The CLI test "refuses to overwrite an authored file at **either** target" only
puts an authored file at the hub. Deleting the snapshot guard in
`src/scripts/tom-annex.mjs:114`
(`if (current !== undefined && !isOwnedSnapshot(...)) refused.push(values.snapshot)`)
leaves the whole suite green. That guard is a data-loss safeguard, and the WP
lists it as a case: "an authored file at the target is refused".
I checked by hand that the code refuses `{"mine":1}` and a truncated JSON
(exit 1, file untouched). But nothing pins that behaviour.
Fix: add a snapshot-only case, an authored JSON at `--snapshot`. Assert exit 1,
the "refusing to overwrite" line, that the bytes are unchanged, and that no hub
is written. `--check` on the same file should report `unowned`.

**R2. The hub's precedence (hand-edited over stale-source) is untested.**
Swapping the two checks in `checkHub` (`check.mjs:250-251`) survives.
`checkSnapshot` has the combined test ("hand-edited wins over stale-source");
`checkHub` does not, so the claim for the hub rests on nothing.
Fix: add one combined case to `checkHub`: a hand-edited body against a build
with another digest must report `hand-edited`.

## Recommended (non-blocking, fold in while you are there)

- R3. Mutant #6 survives: dropping `annex?.format === TOM_ANNEX_FORMAT` from
  `isOwnedSnapshot`. Add an `unowned` case with this producer's `by` but no or
  a wrong `format`.
- R4. Mutant #10 survives: dropping the CRLF normalisation in `pageContentHash`.
  Assert that the CRLF and LF forms of the ADR worked example hash the same.
- R5. Mutant #17 survives: dropping the link-destination encoding in
  `hub-page.mjs:85`. Add a URL with a space or a parenthesis to the escaping test.
- Mutant #19 (the placeholder passed to `page()`) is equivalent; no action.

## Findings (non-blocking; for WP08 or the operator)

- F1. **Writes are not atomic.** `writeFileSync` goes straight to the target.
  A crash mid-write leaves a truncated file. On the next run that file is
  `unowned` and the writer refuses it, so the user must delete it by hand.
  The behaviour is loud but unnamed. Writing a temp file and renaming it
  would remove this. It is not in the acceptance criteria.
- F2. **The hub masks `at` it could compare.** The hub's `at` is
  deterministic: it comes from the built index, never the clock. A consistent
  forged edit (`at` + `updated` + a recomputed `content_hash`) reads `ok`,
  where the snapshot catches it through `annexInstant`. Once the digests match,
  `stamp.at` could be compared with `builtAnnex.generated.at`. This is a nit;
  the D5 masking itself is followed literally.
- F3. **Line endings.** There is no `.gitattributes` `eol=lf` for the snapshot
  and hub, nor for the evidence inputs, which D2 asks text inputs to pin. A
  CRLF checkout reads as `stale-render` (verified), against the spec's edge
  case "the snapshot is the same bytes on every platform". `.gitattributes`
  is outside WP07's map; operator or WP08 to place.

## Dispositions checked

- **ADR worked example:** `pageContentHash` gives `sha256:3ebe501730db` for
  both LF and CRLF, matching an independent Python computation. It strips only
  the frontmatter stamp block and keeps a body line that looks like one. It
  keeps the trailing newline.
- **Precedence**, probed for every pair on both files: missing > unowned >
  hand-edited > stale-source > stale-render.
  - `unowned` matches #454: a deleted or mistyped stamp, a foreign producer, or
    unparseable YAML/JSON. The producer has no retired stamp, so nothing is
    wrongly called `unowned`.
  - `orphan` cannot occur: both paths are named explicitly and nothing is
    pruned. Confirmed.
- **Exit codes:**
  - A missing index under `--check` exits 1 (the output line names the index).
  - A missing index when writing exits 2, as do usage and bad-JSON errors.
  - Rendering happens before any write. An index with a null `at` writes
    nothing.
- **N5** is sound per the WP text and C-003: the CLI reads only `dist`. The
  consequence is that a stale `dist` passes, so CI must build first. Document
  this in WP08.
- **N6** is consistent with D2's JSON rule. The mask covers only `at`: `by` and
  `source_digest` edits are caught (verified).
- **Goldens:** index 81→82 and sitemap 86→87 are exactly one published Hub, and
  `assert:artifacts` passes. No other golden moved.
- **Out-of-map edits** are minimal and justified: a one-line bin, two pinned
  counts, and the WP06 N1–N3 tests.
- **CI step not wired:** T033 step 4 puts it out of scope. Acceptable.
- **No clock:** no `Date` or `now()` in `hub-page.mjs`. `check.mjs` only uses
  `instanceof Date` to read YAML. The hub carries no `tom_classification`
  (tested).

## Anti-pattern checklist

1. Dead code: PASS (the CLI is the caller).
2. Synthetic fixture: PASS.
3. Silent empty return: PASS (`parseJson` and `safeJson` return undefined, by
   design, for `unowned`).
4. FR coverage: PASS.
5. Frozen surface: PASS.
6. Locked decision: PASS (C-003 holds).
7. Shared-file ownership: PASS (out-of-map edits named in the hand-off).
8. Production fragility: PASS.

## Gates on lane-g (f8c898c5)

- `pnpm test`: src 4935/4935, mcp 181/181.
- lint 0, typecheck 0, `pnpm --filter example build` 0.
- `validate:tom-annex` 0, `validate:example` 0 (84 files), `validate:docs` 0
  (217), `validate:links` 0 (1943 refs).
- `assert:artifacts` PASS.
- Clean tree after the build.

## Operator questions

- OQ1. **`by` on a toolkit bump.** The index's `by` is always the current
  toolkit version. D5 masks only `at`, so every toolkit release turns the
  committed snapshot **and** hub `stale-render` (verified) until someone
  regenerates them. That conflicts with D1's intent, "a release that changes
  nothing leaves every stamp alone". Is this acceptable for a build-derived
  artifact, or should the index carry `by` over while `content_hash` is
  unchanged (WP06 design)? This is a spec or ADR question, not a WP07 defect.
