---
affected_files: []
cycle_number: 1
mission_slug: generated-page-and-link-integrity-01M4VB0N
reproduction_command:
reviewed_at: '2026-10-13T20:56:19Z'
reviewer_agent: claude
wp_id: WP07
---

# WP07 review feedback, cycle 1

Verdict: changes requested. The gates pass, no accepted ADR is edited, the #129 account is right, and most of the text is true of the code. Three statements are false as written and one generated artifact is wrong. All fixes are sentence-level. Nothing needs restructuring.

Gates run in the lane (all exit 0): `generate-adr-index.mjs --check`, `validate-frontmatter.mjs docs`, `check-links.mjs docs example/docs` (drafts on, and with `DK_PUBLISH_DRAFTS=off`), `assert-guide-no-internal-paths.mjs`. `git diff main -- docs/adr/` shows only 0047, 0048 and `README.md`.

## Must fix

### 1. `docs/guides/consumer-setup.md`, paragraph "What `dockitty-check-links` checks", first sentence (MAJOR)

> It uses the same rule as the build, so a relative `.md` link passes only when the build would turn it into a route.

False without `--strict`. On a non-strict root `run()` in `check-links.mjs` resolves against `allRoutes` (drafts included) and `checkMarkdownLink` returns `null` for an existing file outside the tree. So a link to a draft the live build leaves out, and a link out of the docs tree, both pass, and the build rewrites neither. This is the superseded plan wording. The rest of the paragraph says the opposite, so the paragraph contradicts itself, and the first sentence is the one a reader keeps.

Replace with, for example:

> It resolves a relative `.md` link with the same function the build uses. With `--strict` and your site's index names, a link passes only when the build would turn it into a route. Without `--strict` it is more lenient, as described below.

### 2. `docs/adr/0047-relative-markdown-links.md`, Decision 2 and Consequences > Positive (MAJOR)

> The two agree by construction.

> The build and the source check cannot disagree about which links resolve, because one function answers for both.

False as absolutes, and contradicted by the ADR's own Negative bullet ("A site that builds its docs has to pass `--strict` to make the source check agree"). They share `resolveRelativeDocLink`, but they agree only when the check is given the same inputs: the build's table drops unpublished drafts (`unpublishedDraftPaths` in `baseAbsoluteLinksIntegration`), the check on a non-strict root uses the table with drafts kept, accepts out-of-tree files, and assumes `README,index` when `--index-basename` is absent.

Corrected statement: "Both call one function. They give the same answer when the check runs with `--strict`, the site's index names and the site's draft setting." Reword the Positive bullet the same way.

### 3. `docs/adr/0047-relative-markdown-links.md`, Decision 2, third sub-bullet (MAJOR, small)

> so `README`, `index` and a folder's own file collapse to the folder route.

There is no "folder's own file" rule in `resolveIndexEntries`, `readmeToIndexId` or `routeOfSlug`. What the code does: a file named with one of the site's index names collapses to its folder's route; and an id that still ends in `/index` (a nested `index.md` on a site that does not list `index`, or one demoted by a sibling `README.md`) is also served at the folder route, mirroring Starlight. Say that, or drop the clause.

### 4. Status line of both new ADRs, and the regenerated `docs/adr/README.md` (MINOR, required)

`## Status` begins `Accepted, 2026-10-13.` in both ADRs. `extractStatusToken` cuts the token at whitespace, `.` or an em-dash, not at a comma, so the index rows for 0047 and 0048 read `Accepted,` while the other 46 read `Accepted`. The same token feeds the ADR Hub card badge. House format is `**Accepted** — 2026-10-13.` (ADR-0037, ADR-0038) or `Accepted. …` (ADR-0046). Change both status lines to one of those, then regenerate the index with `node src/scripts/generate-adr-index.mjs`.

### 5. `docs/adr/0047-relative-markdown-links.md`, Decision 6 and Consequences > Negative; `CHANGELOG.md` Breaking entry (MINOR, required: completeness of "what is newly reported")

On every root the check also reports two classes that no document lists. Verified by running the CLI on a temp tree:

- a link whose path goes up out of the docs root and back in (`../docs/sub/README.md`): "link goes up out of the docs root and back in, so the build does not rewrite it". In 0.2.0 this passed, because the file exists.
- a link with a malformed `%` escape.

Add both to Decision 6's "on every root" list and to the Negative bullet "The source check now reports links it used to pass". One clause in the changelog Breaking entry is enough.

### 6. `CHANGELOG.md`, Breaking, second lead sentence (MINOR, required)

> **`dockitty-check-links` reports relative Markdown links that do not lead to a published page (#131).**

Overclaims as a standalone sentence: without `--strict`, a link to an unpublished draft or to a file outside the tree is still accepted. A lead that is true on every root: "**`dockitty-check-links` now reports a relative Markdown link to a file that is not a page, and more with `--strict` (#131).**" The body below it is accurate and can stay.

## Should fix (will not block a second cycle on their own)

- `docs/guides/consumer-setup.md`, "Upgrading from 0.2.0", glossary bullet: "keeps, with a warning, any page that does not match the generator's frontmatter". A page whose `kind` differs is kept with no warning (`pruneStaleIndexPages` skips it silently); only a page with the generator's `kind` and different keys warns. Also say the two cases where old pages stay with no message: the folder of a context you removed from the source, and a page under a name that is no longer an index name. Add that the renamed files show up in git and need committing.
- `docs/adr/0048-…`, Decision 4 and `docs/architecture/glossary.md`: "the build warns once". The code warns once per kept file. Say "warns for each such file".
- `docs/adr/0047-…`, Alternatives, Option A: "leaves the 61-link rewrite cost with every adopter". 61 is one site's count (issue #131: spec-kitty-charter). Write "leaves every adopter to rewrite its links by hand, 61 in the first consumer".
- `docs/adr/0047-…`, Status: the amended `check-links` paragraph of ADR-0037 also said a `.md`-relative link "fails outright" on `example/docs`. State that this is reversed: on a strict root a `.md` link to a published page is now accepted. Also name the amended text precisely: it is the "Hand-authored content links" bullet inside Decision 1, and the paragraph sits in Decision 2.
- `docs/guides/consumer-setup.md`, step 3: "a glossary hub at `/glossary/` that the toolkit recognises as the folder's index page" is written from the code's point of view. Say what the adopter sees: the hub is `glossary/README.md`, served at `/glossary/`, placed in the sidebar and listing its contexts like any other section index.

## Verified true, no change needed

The #129 account in ADR-0048, the changelog and `glossary.md` (Starlight 0.32.6 `slugToParam` strips a trailing `/index`; the hub was served at `/glossary/`; term links worked; the caveat that this is read from source). The Gherkin guard description, opt-outs, non-boolean rejection, first-run and partly-empty behaviour, `--check` unchanged, and the advice to remove `allowEmpty`. The glossary name rule, plain-name rejection, the stop on an authored file or symlink, the four prune conditions and the known limits. The rewrite rule and what it leaves alone. The strict split, the flags, exit 2 for `--name=value` and unknown options. The route-rule limits in ADR-0047 Risks. Changelog classes, style and the 0.3.0 note; no version field changed.
