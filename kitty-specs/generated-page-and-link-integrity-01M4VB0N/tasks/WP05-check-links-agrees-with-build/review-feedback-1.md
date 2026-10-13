# WP05 review, cycle 1: changes requested

Reviewed commit `07ac87b` on lane-e. The rule itself is sound: a relative `.md`/`.mdx` link goes through `buildRouteTable` / `resolveRelativeDocLink`, the out-of-tree carve-out works both ways, flags parse, and scope is clean (two files). One existing CI gate breaks and one new rule disagrees with the shared index rule, so this cannot be approved yet.

## BLOCKER

### B1. `pnpm validate:links` in CI now fails (`.github/workflows/ci.yml:114-117`)

The doc-sanity step "Resolve internal links & related refs" runs `pnpm validate:links` (`node src/scripts/check-links.mjs docs example/docs`, root `package.json:22`) with `DK_PUBLISH_DRAFTS: 'off'`.

- WP01 base (`824ff57`), `DK_PUBLISH_DRAFTS=off`: exit 0, 1084 references resolve.
- This WP (`07ac87b`), `DK_PUBLISH_DRAFTS=off`: **exit 1, 50 dangling references**, all `link points at a draft page`, all under `docs/` (0 under `example/docs`). Per root: `docs` exit 1, `example/docs` exit 0.
- Default (drafts on): exit 0. That is the only case the Definition of Done and `example-adopter.test.ts:260` cover, which is why the tests are green.

Cause: `src/scripts/check-links.mjs:438-444,505` applies the unpublished-draft rule to `.md` links on every root. That is what FR-015 and User Story 4 ask for, but this repository's `docs/` is not built as a site and has 25 distinct links (50 occurrences) from active pages to draft pages (`architecture/metadata-model.md`, `section-registry.md`, `theming-spec-kitty-brand.md`, `ci-cd-pipeline.md`, ...).

What to do: this needs a decision the WP cannot take alone, because the WP may not edit `package.json`, `ci.yml` or `docs/`. Stop and ask the orchestrator to choose one, then implement the part that falls in `check-links.mjs`:

1. Keep the rule as specified and change the caller: the CI step (or the `validate:links` script) checks `example/docs` with drafts off and `docs` without that setting. Workflow/package change, outside this WP.
2. Keep the rule and fix the content: publish the draft targets in `docs/` or mark the linking pages draft. Content change, outside this WP.
3. Narrow the rule: report a draft target only on a strict root, as before, and accept it on a non-strict one for the same reason out-of-tree targets are accepted (repository links read on GitHub, tree not built). This is inside this WP but departs from FR-015 / US4's independent test, so the spec has to be amended first.

Whichever is chosen, add the drafts-off run of the repository command to the hand-off evidence, with its exit code.

## MAJOR

### M1. The new "folder has no section index" rule does not use the shared index rule (`check-links.mjs:519-523`, `:570-575`, `:193-209`) — C-002

`hasNoSectionIndex` decides through `resolveDocFile`, which matches index names by exact file name. The shared rule (`indexBasenamePattern`, `vocabulary-core.mjs:784`) is case-insensitive. Reproduction: `kb/a.md` with `[g](./g/)`, `kb/g/Readme.md` active. The build publishes `/g/` (route table: `g/Readme.md -> /g/`); the CLI reports `link names a folder that has no section index (README, index)`, exit 1. On the WP01 base this link passed, so it is a new false failure, and it is exactly the duplicated index logic C-002 forbids.

What to do: answer the question from the route table already built for the root. A folder inside the root has a page iff some value in `allRoutes` equals `/<folder relative to root>/` (`/` for the root itself). Drop the `resolveDocFile` call from `hasNoSectionIndex`. Add one case to the existing `--index-basename home` test (or a sibling) with a mixed-case index file; it must be red before the change.

Keep the rule itself: T024 asks for a test that only passes with it, the build agrees that a folder without an index file has no page, and `docs`, `example/docs` and `tests/consumption/consumer-fixture/docs` all stay at exit 0.

## MINOR

### m1. The footnote test is inert (`src/tests/check-links-tightened.test.ts`, "ignores a footnote definition and a definition inside a code fence")

Removing the `(?!\^)` footnote guard from `REFERENCE_DEFINITION` (`check-links.mjs:131-132`) leaves all 30 tests green. `[^1]: Notes on the claim` never matched the pattern anyway, because the pattern needs a single token before end of line. Use a one-token footnote that would otherwise be read as a bare link, for example `[^1]: Aristotle` or `[^1]: ./gone.md`. Note for the hand-off: with the guard removed, `docs`, `example/docs` and the fixture still exit 0 with the same count (1084), so the "228 footnotes" hazard does not occur with this pattern; the guard matters only for one-token footnotes.

### m2. The root-page filter has no test (`check-links.mjs:437-440`)

Removing `.filter((p) => allRoutes[p] !== '/')` leaves the file green. Add one case: root `README.md` with no `doc_status`, a nested active page linking `../README.md`, drafts off, exit 0. If the filter moves into the shared helper (see the cross-package note), the test stays here as the CLI-level guard.

### m3. Misleading reason for a link that leaves the root and comes back (`check-links.mjs:362-372`)

`kb/n/a.md` linking `../../kb/n/a.md` is reported as `link target is not a published page (only .md/.mdx files under the docs root are built ...)`. The target is a published page; the link is unresolvable because its path leaves the docs root. Reporting it is right (the build will not rewrite it). Give it its own reason, and here the contract's "where one exists, the route to use" (`contracts/public-surface.md:12`) applies: the route is in `allRoutes`. A malformed `%` escape lands in the same wrong message.

### m4. Module comment is stale (`check-links.mjs:48-88`)

The "Fail-closed tightening" and "Links to unpublished drafts" sections still say the tightening applies only to `SITE_ROOTS` and that the draft report is "for a SITE_ROOTS file". After this WP a `.md` link to a draft is reported on every root, while extensionless, root-absolute and `related:` references to a draft are still reported only on a strict root (`:468-469`). State that split in the comment and in `--help`, or remove it under the B1 decision.

### m5. Unknown flags are still read as roots (`check-links.mjs:339`)

`--bogus` and `--index-basename=home` give `cannot read docs dir "--index-basename=home": ENOENT`, exit 2. Unchanged from before, but the WP adds two flags and a usage text. Reject any `--`-prefixed leftover with `unknown option … (see --help)`, exit 2.

## NOTE

- `documents the flags in --help` asserts two flag names in the usage string. It is the only guard for the DoD line "documented in `--help`", so it may stay, but it is a text pin; folding it into the `--strict` and `--index-basename` cases is not worth the churn.
- The `toMatchObject({ kind: 'invalid', reason: expect.stringMatching(/CHILD/) })` change is equivalent to the two assertions it replaced.
- Reference definitions: a definition inside a blockquote (`> [g]: ./x.md`) and one whose target is on the next line are not seen; `[f]: ./x.md` on a list-item continuation line is read as a definition although Markdown treats it as paragraph text. Rare; no change required.
- `INDEX_BASENAMES` has no remaining importer anywhere in the repository.

## Cross-package (for the orchestrator, not this WP)

`unpublishedDraftPaths` (`src/lib/draft-publication.mjs:325`, WP01) returns the root index when it has no `doc_status` or is `draft`. The build never withholds the root: `isDraftEntry` (`src/lib/metadata.ts:268-269`) exempts `ROOT_ENTRY_ID`, and `draftRoutesOf` (`draft-publication.mjs:304-312`) skips route `/`. This WP corrects for it locally at `check-links.mjs:439`. WP04 is due to call the same helper; without the same filter its route table drops the root page with drafts off, a relative link to the root README is left unrewritten and 404s, and the source check accepts it. No tree in this repository has a status-less root, so no existing gate would notice. Move the exemption into the helper (it needs the index names, or the caller's route table, to know which file is the root), pin it in `route-table.test.ts`, and then remove the filter here.
