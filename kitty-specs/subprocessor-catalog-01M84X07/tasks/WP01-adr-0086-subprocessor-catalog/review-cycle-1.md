---
affected_files: []
cycle_number: 1
mission_slug: subprocessor-catalog-01M84X07
reproduction_command:
reviewed_at: '2026-11-25T07:36:49Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

# WP01 review: ADR-0086, sub-processor catalog

Reviewer: claude::reviewer-renata. Verdict: **REJECT** (changes requested). Reviewed 577da43b on feat/403-subprocessor-catalog.

The ADR body is sound. Status is Proposed and was not self-accepted. Number 0086 is free on main and on every remote branch: 0085 is on main, 0087 is on main, and 0089 is on feat/342. The field table matches data-model.md row for row. Decision 4 matches operator ruling A, which fails the build at `astro:config:setup` with one aggregate error. The feed and the export take their dates from `since` and `until` only, so the "no build clock" claim holds for both outputs. ⚖ items are framed as questions for counsel, and the ADR does not claim compliance. Two changes are required before approval.

## Required

1. **Revert `docs/adr/README.md` to main.** ADR-0072 D2 (Accepted) moved index regeneration out of PRs.
   - The table is regenerated after merge by `.github/workflows/adr-index.yml` as one bot PR. CI runs only `validate:adr-ids` per PR (`ci.yml`, line 150).
   - The README itself says "Do not edit the table above".
   - The "out of sync on main" state is expected under ADR-0072. The bot branch `origin/ci/adr-index` (0e82da53, 2026-11-24) already holds exactly this regeneration: `git diff origin/ci/adr-index HEAD -- docs/adr/README.md` differs only by the 0086 row.
   - Keeping the change duplicates that bot PR. It also conflicts in the same hunk with the bot PR and with the #342 (ADR-0089) and diagram-mission (ADR-0088) branches if they do the same.
   - The WP prompt's T002 and its DoD ("all four validators pass") predate ADR-0072 D2. `validate:adr-index` is no longer a PR gate, so its failure on a branch is expected.
   - Drop the file from `owned_files` in spirit, and from the diff. Do not move it to the PR rebuild either; the bot will add the 0086 row after merge.

2. **Decision 6 must record the C-005 exception and ADR-0087 conformance.**
   - (a) Decision 5 says "No output reads the build clock". Decision 6 then promises a page that lists *current* and *past* sub-processors separately, which needs a reference date. Spec C-005 states this exception ("except on the gated page (FR-017), which follows ADR-0087's masking rules"), and plan IC-05 names it as a risk. The ADR records neither. Scope the decision 5 sentence to the API document and the feed. In decision 6, say that the current/past split is the one date-relative output, and that its reference date and masking follow ADR-0087 D5. The concrete rule belongs to WP07; the ADR only has to say where it is decided.
   - (b) ADR-0087's contract is "one stamp, one drift gate, **registry ownership**" (D1, D3, D4). Decision 6 names only the stamp and the drift gate. Add one or two sentences covering four points:
     - the page has a registered producer with an ownership scope (ADR-0083 D7, ADR-0087 D4);
     - its `source_digest` inputs (D2) are the committed catalog file, plus any reference data the page renders;
     - the `--check` gate reports the full D3 verdict set, including `unowned` (ruling R81, #454);
     - the producer reads committed data only (D6, spec C-007).

## Non-blocking (fix if convenient)

3. **Context, first sentence.** "Several sources require a processor to keep a current list of its sub-processors" overstates GDPR Art. 28(2) and 28(4), which require authorisation and notice, not a list as such. The list comes from the SCC annexes. Suggest "Several sources concern the list of sub-processors and changes to it:", which keeps the ADR from stating a legal requirement.
4. **Decision 5 change order.** "Newest first" omits the tie-break from data-model.md: `id` ascending, then `added` before `removed`. The tie-break is what makes the order total, so state it, or point to the data model.
5. **Spec drift, for a later WP or a spec touch-up.** FR-006 names only `{type: biblio, id}` and the bibliography catalog. The data model and the ADR also accept `{type: tool, id}`, which matches the existing page shape (C-003). The ADR is right; the spec should follow.

## Notes for later WPs (not WP01 blockers)

- **I1.** PR #445 and ADR-0087 are merged on main. The ADR wording is already correct: it links 0087 and does not say "unmerged". Spec, plan and WP07 still need the update.
- **U1.** WP05 T023 must byte-compare the no-catalog `dist/` (at least `api/index.json`, `llms.txt`, `rss.xml`), not only the file list. The ADR is unaffected.
- **Issue matrix.** Rows #359, #402 and #403 are `unknown` with placeholder titles. #403 needs a real row (wp, fr, evidence) before any WP citing it is approved (finding F2). #402 looks context-only (the ADR-0085 number) and #359 too, since ADR-0087 is now merged.
- **Trailer.** Implementer commit 577da43b carries a `Co-Authored-By:` trailer that names a model. Strip it at the PR rebuild if trailers are not allowed on this repo.

## Checks run on 577da43b

- `validate:adr-index`: pass, and re-running the generator produced no diff, so the README is pure generator output.
- `validate:adr-ids`: pass (86 ADR ids, all unique).
- `validate:docs`: pass (218 files, 4 pre-existing warnings).
- `validate:links`: pass (1964 references, 301 files).
- markdownlint: 0 issues on the 2 changed files.
- lint: pass. Typecheck: pass.
- Refreshed index dates match each ADR's own `updated` frontmatter: 0046 = 2026-11-13, 0059 = 2026-11-22, 0073 = 2026-11-21.
- `pnpm test`: exit 0. src: 241 files and 4745 tests passed. mcp: 23 files and 181 tests passed. No flakes hit, and no glossary side effects to stash.
