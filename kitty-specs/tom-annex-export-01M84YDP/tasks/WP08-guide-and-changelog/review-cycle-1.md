---
affected_files: []
cycle_number: 1
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T19:57:02Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP08
---

# WP08 review, cycle 1: REJECT (claude::reviewer-renata)

Reviewed f94a64b5 on `feat/401-tom-annex-export`, against the WP07 code on
lane-g at 6134ce5c (`src/lib/tom-annex/*`, `src/scripts/tom-annex.mjs`).

Most of the guide is accurate:

- The caution block, the label and the three ⚖ counsel items match
  `TOM_ANNEX_LABEL`, `TOM_ANNEX_NOTICE` and `TOM_ANNEX_COUNSEL` exactly. I
  checked them by script, with whitespace collapsed.
- Every Format 1.x table matches `tom-annex.schema.json` and `core.mjs` key for
  key: types, null against absent (only `dpv` is ever absent), the sort orders
  and the serialised key order.
- The flags, the bin name, the verdict line, the verdict precedence and exit
  codes 0, 1 and 2 under `--check` match the CLI.
- The symlink limit is right. I ran the CLI: a symlinked target is replaced by a
  regular file.
- The tmp, umask, fsync and Windows lines are right.
- There is no compliance or sufficiency claim anywhere, and the ⚖ framing holds.

The rejection is for **two limits that the code contradicts or that the guide
leaves out**. I reproduced both by running the CLI on lane-g. Both are
one-paragraph fixes.

## Required (blocking)

**R1. A toolkit upgrade also makes the hub page `stale-render`, not only the
snapshot.**
The guide (section "Snapshot and hub page", the build→write→commit paragraph)
says: "A toolkit upgrade changes `by`, so it also makes the snapshot
`stale-render` until you write it again." But the hub page's frontmatter
carries the same `by` (`hub-page.mjs`, `frontmatter()`), and `checkHub` compares
bytes.

Reproduction: write both files, change the built index's `generated.by` to
`doc-kitty-tom-annex/9.9.9`, then run `--check`. It gives
`stale-render snap.json` and `stale-render hub.md`, and exit 1.

Fix: say "makes both files `stale-render`".

**R2. The hub page cannot be written when `generated.at` is `null`, and the
guide does not say so.**
The stamp table says `at` is "`null` when none has one". But
`renderHubPage` throws when `at` is not a string: "the hub page needs a date:
no evidence page carries an `updated` or `verified` date". So
`dockitty-tom-annex --hub …` exits 2 and writes nothing. The snapshot is not
written either, because the CLI renders the hub first.

Reproduction: set `generated.at` to `null` in the built index, then run
`--hub hub2.md`. It exits 2 with that message.

A site owner whose evidence pages have no `updated` hits this on the first
write. Fix: add the limit in an actionable form, for example "The hub page
needs a date: if no evidence page has `updated` or `verified`, the index's `at`
is `null` and `--hub` exits 2 without writing either file. Give at least one
evidence page an `updated`."

## Non-blocking (fold in if convenient)

- **N1. The exit code of a refused write is not documented.** A write that
  refuses an unstamped target exits `1`, and the CLI header says "1 drift (or a
  refused target)". The guide gives exit codes only for `--check`. Add one
  clause.
- **N2. Line endings (operator question F3).** The snapshot and hub checks
  compare bytes. On a CRLF checkout (`core.autocrlf=true`) both files read as
  `stale-render`, which I reproduced with exit 1. `pageContentHash` normalises
  CRLF, but the byte comparison does not.
  - Whatever the answer to F3 is for this repository, a consumer site has the
    same exposure.
  - Suggest one bullet: "commit both files with LF line endings (for example
    `<path> text eol=lf` in `.gitattributes`)".
  - If F3 adds `eol=lf` only to this repository's `.gitattributes`, the guide
    still needs the bullet, for consumers.
- **N3. Operator question OQ1 (`by` carry-over).** If `by` is carried over while
  `content_hash` is unchanged, the R1 sentence must go. A toolkit upgrade would
  then leave both files `ok`. Under the shipped code, the R1 text is right.
  - Note: #454 changes `metadata-model.md` to say `makeStamp` "already carries
    over `by` and `at` together". Once #454 lands, this index diverges from that
    rule, so the answer to OQ1 matters.
- **N4. `unowned` provenance.** On the target branch, ADR-0087 D3 has no
  `unowned`; #454's D3 amendment adds it. The guide's table matches the code.
  Consider "(`unowned`: ADR-0087 D3 as amended by #454)" so that a reader who
  opens the ADR before #454 lands is not confused.
- **N5. The artifact gate (WP06 review N5).** The guide says the gate "checks
  `content_hash` but cannot recompute `source_digest`". The gate does not check
  `generated.at` either. A hand edit of `at` in the built file passes the gate.
  The snapshot `--check` does catch it.
- **N6. The two-file write is atomic per file, not across both files.** If the
  hub's rename fails after the snapshot's has succeeded (the Windows lock case),
  the snapshot is already new. "The old file stays as it was" is true only of
  the failing file.
- **N7. Draft-only sites.** "A site with no classified pages gains nothing"
  also holds when every classified page is a draft (the scan uses the draft
  rule). Consider "no *published* classified pages".
- **N8. Code, not WP08.** The registry's regenerate hint, which `--check`
  prints, names only `--hub` and not `--snapshot`, and it uses
  `node <toolkit>/scripts/tom-annex.mjs` rather than the `dockitty-tom-annex`
  bin. Track this for WP07 or at consolidation.

## Checked and fine

- **Project-relative digest keys against D2's "repo-relative".** The guide is
  accurate (`path.relative(process.cwd(), …)` in `routes/tom-annex.ts`) and
  says when the two coincide.
- **The D5 follow-up wording** matches D5's text ("the latest `generated.at` or
  `updated`").
- **The changelog fragment** follows `docs/changelog/unreleased/README.md`:
  `section: Added`, a bold lead with the issue number, "Before … Now", and a
  repository-root link.
- **The metadata-model cross-link** is minimal. It merges and rebases cleanly
  onto PR #454's head, including the identical `updated:` bump.
- **ADR links** resolve: ADR-0080, ADR-0083, ADR-0087 (D2, D3 and D5 as cited)
  and #404.

## Gates (feat/401-tom-annex-export @ f94a64b5)

- `lint`, `typecheck`, `validate:docs` (218 files, 4 pre-existing warnings),
  `validate:links` (1952 references) and `validate:changelog` (13 fragments)
  are clean.
- markdownlint on the changed files reports 0 issues.
- Vale **was not run**: the pinned 3.18.0 binary is not installed here, and
  downloading it was not permitted in this session.
- `pnpm test`: src 241 files and 4745 tests passed; mcp 23 files and 181 tests passed. No flakes.

## Anti-pattern checklist

| # | Item | Result |
|---|---|---|
| 1 | Dead code | N/A (docs only) |
| 2 | Synthetic-fixture test | N/A |
| 3 | Silent empty return | N/A |
| 4 | FR coverage | FR-013, FR-004, NFR-003 and C-001 are covered by the guide; R1 and R2 are accuracy gaps within FR-013 |
| 5 | Frozen surface | PASS |
| 6 | Locked decision | PASS (no compliance claim; label verbatim) |
| 7 | Shared-file ownership | PASS: `metadata-model.md` is also edited by #454, which is outside the mission; the two merge cleanly |
| 8 | Production fragility | N/A |
