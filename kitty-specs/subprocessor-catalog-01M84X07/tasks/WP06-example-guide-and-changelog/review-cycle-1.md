---
affected_files: []
cycle_number: 1
mission_slug: subprocessor-catalog-01M84X07
reproduction_command:
reviewed_at: '2026-11-25T12:16:56Z'
reviewer_agent: claude:reviewer-renata
wp_id: WP06
---

# WP06 review, cycle 1: changes requested

Reviewer: claude::reviewer-renata. Lane `lane-e` at `0f38c4a8`, review range
`244dd126..0f38c4a8`.

One blocking finding (F1). It is small and sits in an owned file. Everything
else passed; F2 to F4 are nits you can fold in the same change.

## Blocking

**F1. The feed's URLs are not checked against the site base (T025, bullet 4).**
T025 asked whether `findBaselessFeedUrls` in `assert-no-broken-links.mjs` needs
to learn `subprocessors.xml`. It does: the function scans only `rss.xml`,
`llms.txt` and `api/*.json`. The hand-off doesn't mention it, and step 11 checks
only the two `api/index.json` hrefs.

Reproduction: copy `example/dist` to `example/dist-mut`, then rewrite the four
item `<link>`s in `subprocessors.xml` to
`https://spec-kitty.github.io/api/subprocessors.json` (no `/doc-kitty`). Both
`assert-no-broken-links … --base /doc-kitty --site https://spec-kitty.github.io`
and `assert-build-artifacts` still pass.

Fix it either way:

- add `subprocessors.xml` to the targets in `findBaselessFeedUrls`. That is one
  line, out of map, so note the rationale in the hand-off; or
- in step 11, which is in map, assert that the channel `<link>`, `atom:link`,
  each item `<link>` and each `guid` start with
  `https://spec-kitty.github.io/doc-kitty/`.

Then rerun the mutation above and show that it fails.

## Nits (fold if cheap)

**F2.** Step 11's `_links` check uses `endsWith(suffix)`, but its message says
"absolute, base-aware". A root-relative `/doc-kitty/api/subprocessors.json`
passes step 11. The generic `_links` check catches it today, but step 11 should
test what its message says: use `startsWith('https://spec-kitty.github.io/doc-kitty/')`
or parse the URL.

**F3.** This is information only. When the JSON or the feed is missing, the
generic agent-`_links` check fails first ("links to …, but … was not built"), so
step 11's own existence guards never fire in that case. The build still fails;
nothing to change unless you want step 11 to own the message.

**F4.** In the guide, the sentence "Each message names the file, the record (or
its position when the id is unusable) and the field" overclaims. Catalog-level
messages name no record or field: "could not parse YAML", "the catalog must be a
list of records", and `subprocessor #n: must be a mapping`. Suggested wording:
"Each message names the file and, for a record's problem, the record (or its
position when the id is unusable) and the field."

## Verified (no action)

- **Guide against code.** The field table matches `SUBPROCESSOR_FIELDS`,
  `REQUIRED_FIELDS`, `TEXT_FIELDS`, `KEBAB`, `checkLocation` and the
  `until < since` rule. The unknown-key rule matches, and so does the UK/EU
  rejection (absent from `ISO3166_ALPHA2`). The null, comments-only and `[]`
  file gives a valid empty catalog with the routes still injected. The
  site-owned route keeps its path. No build time appears in either output. The
  dev-restart limit matches the integration.
- **⚖ framing.** The CAUTION says "not legal advice" and "do not call it
  DPA-ready". The IMPORTANT says "for your counsel… a channel, not the notice
  itself". Neither the guide, the changelog fragment nor the API `notice` makes
  a compliance claim. Pass.
- **Clock.** No `Date.now`, `new Date()` or env reads in the
  sub-processor modules. `deriveChanges` sorts by the authored dates, and
  `pubDateOf` is fixed at UTC midnight. The expected changes in step 11 are
  literal strings, so the example and the assertions stay correct after
  2027-06-01. Pass.
- **Assertions.** The positive control passes. Each of these mutations fails
  step 11 with its own message: a `lastBuildDate`, 3 `<item>`s, reversed
  `changes`, reversed `records`, a missing `subprocessorFeed` link, malformed
  XML, and a wrong "Removed" title. Mutating the assertion (the expected
  removal id) fails against the real dist. Removing the YAML and rebuilding
  fails ("api/subprocessors.json: missing").
- **Fixture hand-edit (out of map).** `api/subprocessors.json` is byte-identical
  to a fresh build. The `_links` key order matches the fresh build's (`…,
  scenarios, subprocessors, subprocessorFeed`), and so does the top-level key
  order. There is one `buildId` across all 80 artifacts, so no tear.
  `buildIdForBuild` hashes page entries only, so the YAML does not move it.
  `derive.mjs` is idempotent: a re-run leaves no diff. No other WP owns
  `mcp/tests/**`. The commit message and the fixture README record the
  rationale. The edit is acceptable. A full re-mint is still owed whenever the
  PlantUML server is available, but not as part of this WP.
- **Fictional records.** The names are the well-known placeholder names
  Northwind, Fabrikam and Contoso. They use `.example` domains (RFC 2606),
  "(fictional)" titles and a header comment. They can't be mistaken for real
  companies or agreements. Pass.
- **Scope.** The change touches the four owned files plus the
  `mcp/tests/corpus/fixtures/**` change above.
- **Gates.** These all pass: `pnpm build`, `assert:artifacts`,
  `assert:no-broken-links`, `validate`, `validate:docs`, `validate:example`,
  `validate:links`, `validate:catalog` (3 records), `validate:changelog`,
  `validate:adr-ids`, markdownlint on the 3 changed docs, and Vale 3.18.0 at
  error level (0 alerts at any level in the new section and the fragment).
  `pnpm test` passes too: the toolkit runs 248 files and 4868 tests, and the
  MCP lane runs 23 files and 181 tests. The MCP typecheck is clean.

## Anti-pattern checklist

1. Dead code: N/A. No new production functions.
2. Synthetic fixture: PASS. Step 11 reads the real build output.
3. Silent empty return: PASS. None added.
4. FR coverage: PASS for the API, the index links and the build-clock check.
   The feed's base-awareness is F1.
5. Frozen surface: PASS.
6. Locked decision: PASS. No `lastBuildDate`, no clock, no records in the
   toolkit.
7. Shared-file ownership: PASS. The fixture edit has a note; no other WP owns
   it.
8. Production fragility: N/A.
