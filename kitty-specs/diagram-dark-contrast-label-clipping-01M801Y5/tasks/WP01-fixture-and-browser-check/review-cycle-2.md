---
affected_files: []
cycle_number: 2
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-21T23:00:39Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

# WP01 review cycle 2: REQUEST_CHANGES (reviewer: claude::reviewer-renata)

Reviewed lane-a at 626989e (3661278, c1930bd, 626989e on top of the mission branch).
Note: `action review` recorded the range as e1eca87..7466a70. That range leaves out 626989e,
so this review covered 626989e as well.

## Blocker

1. **The fixture draft breaks the unit suite on this lane.** WP01 adds a `doc_status: draft`
   page but does not register it in the draft-publication tests. On main, the two files pass
   108/108. On lane-a, 3 tests fail:
   - `src/tests/draft-publication.test.ts` › draftPublicationIntegration › off: records off and
     hands the draft slugs to sidebar shaping. An extra `architecture/diagram-contrast-fixture`
     slug shows up.
   - `src/tests/draft-publication-build.test.ts` › setting off › leaves out exactly the draft
     pages. An extra `architecture/diagram-contrast-fixture/index.html` shows up.
   - `src/tests/draft-publication-build.test.ts` › machine surfaces › same in both modes, apart
     from the draft pages' own API records. `api/pages/architecture/diagram-contrast-fixture.json`
     is not in the draft-only allowance.

   Reproduce with `cd src && npx vitest run tests/draft-publication.test.ts tests/draft-publication-build.test.ts`.
   The DoD says the work is red "for the reasons above and for no other reason". These failures
   are another reason: they are in CI's unit job, not the a11y spec. Fix: put the draft-slug
   lines in WP01, the WP that creates the draft. That is one slug in `draft-publication.test.ts`,
   which the dispatcher allowed despite PR #405 (the hunks are far apart), plus the matching
   entries in `draft-publication-build.test.ts`. Record both as out-of-map edits, since neither
   file is in `owned_files`. Don't defer them to WP02. A lane head that has to stay put for
   review isn't a reason to ship a lane that turns a green suite red.

## Not verified here (environment)

2. I could not run `diagram-legibility` headless. The build needs a self-hosted PlantUML server
   on :8091. Docker is unavailable in this reviewer container, and starting a local PlantUML
   server was refused by this session's permission policy. So I have not independently confirmed
   that the spec is red on main and on the lane, and red only for author-fill and ArchiMate label
   contrast plus the 3 overflowing labels, with themed edges ≥3:1. The next reviewer should run
   it, or the implementer should attach the `legibility.json` output for both projects at both
   widths.

## Static review: no further findings

- Non-vacuity holds: 4 figures, ≥20 labels, themed edges per figure exactly [3, 2, 2, 3],
  `skippedEdges` and `skippedLabels` must be empty, exactly 1 authored edge.
- Author `linkStyle` edges are the only exclusion: authored means the computed stroke differs
  from the resolved `--dk-diagram-edge`.
- The backdrop is measured: glyphs go transparent, edges, markers and polygons are hidden, one
  full-page screenshot is taken, the canvas is sampled, and the most frequent pixel is used per
  label and the worst point per edge.
- Cycle-1 items 1–4 are fixed in c1930bd and 626989e. Item 5 (the `draft` status) is justified.
- `#369` item 1 is pinned as a guard (edges ≥3:1 in both themes) and is not claimed as a failure.
- Constraints are respected: no `playwright.config.ts`, `package.json`, workflow or dependency changes.
- `pnpm lint`, `validate:example` and `validate:links` pass on the lane.

Anti-pattern checklist:
1. Dead code: N/A (test-only WP).
2. Synthetic fixture: PASS (real build output, pixels measured).
3. Silent empty return: PASS (every skip is reported and asserted empty).
4. FR coverage: PASS (static).
5. Frozen surface: PASS.
6. Locked decision: PASS.
7. Shared-file ownership: FAIL. The draft registry the fixture needs is deferred to WP02, which
   leaves this lane red (blocker 1).
8. Production fragility: N/A.
