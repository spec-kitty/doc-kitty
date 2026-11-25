---
affected_files: []
cycle_number: 2
mission_slug: subprocessor-catalog-01M84X07
reproduction_command: spec-kitty agent tasks move-task WP01 --to approved --mission subprocessor-catalog-01M84X07 --agent claude::reviewer-renata
reviewed_at: '2026-11-25T08:24:12Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

Approved by claude::reviewer-renata: approval:WP01

# WP01 review, cycle 2: ADR-0086, sub-processor catalog

Reviewer: claude::reviewer-renata. Verdict: **APPROVE**. Reviewed 7645ff6e on feat/403-subprocessor-catalog (lane-planning). Coordination branch was at 3c3a2e77.

Both required fixes from cycle 1 are folded, and so are the two non-blocking items. The ADR is still **Proposed**. It makes no compliance or legal-sufficiency claim, and every legal question is framed as **⚖ counsel**. The findings below do not block approval.

## Cycle-1 folds, verified

1. **README reverted (R1).** `git diff origin/main --stat` lists only `docs/adr/0086-subprocessor-catalog.md` (201 insertions). The diff against main for `docs/adr/README.md` is empty. `validate:adr-index` exits 1 on the branch and on `origin/main` (checked in a clean worktree), as ADR-0072 D2 expects. ADR number 0086 appears on no other remote branch.
2. **Decisions 5 and 6 (R2).**
   - (a) Decision 5's rule now reads "Neither the API document nor the feed reads the build clock", so it is scoped to those two outputs. Decision 6 names the page as "the one date-relative output". It defers the reference date and the masking to ADR-0087 D5, and leaves the concrete rule to the page's own WP. This matches spec C-005 and WP07.
   - (b) Decision 6 records the stamp and all four cycle-1 points:
     - the `generated` stamp (D1);
     - a registered producer with an ownership scope (ADR-0083 D7, ADR-0087 D4), where ADR-0083 D7 is "id, role, scope, hint";
     - `source_digest` (D2);
     - `--check` with the full D3 set, including `unowned` (as amended by R81/#454 on main);
     - committed data only (D6, C-007).
   - The claim "a hand edit is flagged rather than silently kept" matches D4.
3. **Context (N3).** The Context now says "Several sources concern…". Art. 28(2) and 28(4) are described as governing authorisation, notice and flow-down. The list is attributed to the SCCs: 2021/915 Annex IV and Clause 7.7 Option 2, and 2021/914 Annex III.
4. **Tie-break (N4).** Decision 5 states the order: same date by `id` ascending, then `added` before `removed`. This matches data-model.md.
5. **FR-006 (N5).** The ADR wording, `{ type: biblio | tool, id }`, is right. The spec is still not fixed (spec.md:189 names only `biblio`), and nothing outside the cycle-1 review records the divergence. This review records it as a **known divergence**: fix FR-006 in a spec touch-up before acceptance. It does not block WP01.
6. **Issue matrix.** Rows #403, #359 and #402 are set:
   - #403 is `in-mission`, with real title and evidence.
   - #359 is `not-applicable`, as a dependency delivered by PR #445.
   - #402 is `not-applicable`, as context only.

## Findings (non-blocking)

1. **D2 inputs are narrower than cycle 1 asked.** Decision 6 says the source digest covers "the `_meta/subprocessors.yaml` file and the generator configuration". Cycle 1 asked for "plus any reference data the page renders". If WP07's page renders resolved bibliography, tool or measure titles, those catalogs are D2 inputs as well. A change to one would then surface only as `stale-render`, never as `stale-source`. Fix this in WP07 by declaring every rendered catalog as an input, or reword the ADR when it is accepted.
2. **SCC annex scope, ⚖ counsel.** As I recall the Official Journal text (I did not re-fetch it in this review), the explanatory notes to 2021/915 Annex IV and 2021/914 Annex III say those annexes are completed for **specific** authorisation: Clause 7.7(a) Option 1, and Clause 9(a) Option 1 for Modules 2 and 3. Under the general authorisation (Option 2), the clauses refer to "an agreed list". The ADR uses Annex IV for what an entry holds and Option 2 for change notice, and both uses are reasonable. Even so, "the list itself comes from the standard contractual clauses" blurs the two. Counsel should confirm the wording at acceptance. Precise pin cites would be "Clause 7.7(a)" and "Clause 9(a)".
3. **Responsibilities field.** Annex IV asks for "a clear delimitation of responsibilities in case several sub-processors are authorised". The field makes this required for every record. That is a format choice already under the ⚖ field-set review, and it needs no change now.
4. **Model-naming trailer.** Implementer commit 7645ff6e carries `Co-Authored-By: Claude <noreply@anthropic.com>`, as 577da43b did. Strip it at the PR rebuild.
5. **Matrix detail.** Row #403 has `wp: "WP02"` and `fr: null`, but the mission is WP01–WP07. This is acceptable if the schema takes only one WP. Otherwise, fill it at acceptance.

## Checks run on 7645ff6e

- `validate:adr-ids`: pass (86 ADR ids, all unique).
- `validate:adr-index`: exit 1, identical to `origin/main` (expected under ADR-0072 D2; the bot regenerates after merge).
- `validate:docs`: pass (218 files, 4 pre-existing warnings).
- `validate:links`: pass (1954 references, 301 files).
- markdownlint: 0 issues on the one changed file.
- lint: pass. Typecheck: pass.
- `pnpm test`: exit 0. src: 241 files and 4745 tests passed. mcp: 23 files and 181 tests passed. No flakes hit (`docs-loader-includes` #449 passed), and no glossary side effects to stash (#448): the tree stayed clean.

# WP01 review, cycle 2: ADR-0086, sub-processor catalog

Reviewer: claude::reviewer-renata. Verdict: **APPROVE**. Reviewed 7645ff6e on feat/403-subprocessor-catalog (lane-planning). Coordination branch was at 3c3a2e77.

Both required fixes from cycle 1 are folded, and so are the two non-blocking items. The ADR is still **Proposed**. It makes no compliance or legal-sufficiency claim, and every legal question is framed as **⚖ counsel**. The findings below do not block approval.

## Cycle-1 folds, verified

1. **README reverted (R1).** `git diff origin/main --stat` lists only `docs/adr/0086-subprocessor-catalog.md` (201 insertions). The diff against main for `docs/adr/README.md` is empty. `validate:adr-index` exits 1 on the branch and on `origin/main` (checked in a clean worktree), as ADR-0072 D2 expects. ADR number 0086 appears on no other remote branch.
2. **Decisions 5 and 6 (R2).**
   - (a) Decision 5's rule now reads "Neither the API document nor the feed reads the build clock", so it is scoped to those two outputs. Decision 6 names the page as "the one date-relative output". It defers the reference date and the masking to ADR-0087 D5, and leaves the concrete rule to the page's own WP. This matches spec C-005 and WP07.
   - (b) Decision 6 records the stamp and all four cycle-1 points:
     - the `generated` stamp (D1);
     - a registered producer with an ownership scope (ADR-0083 D7, ADR-0087 D4), where ADR-0083 D7 is "id, role, scope, hint";
     - `source_digest` (D2);
     - `--check` with the full D3 set, including `unowned` (as amended by R81/#454 on main);
     - committed data only (D6, C-007).
   - The claim "a hand edit is flagged rather than silently kept" matches D4.
3. **Context (N3).** The Context now says "Several sources concern…". Art. 28(2) and 28(4) are described as governing authorisation, notice and flow-down. The list is attributed to the SCCs: 2021/915 Annex IV and Clause 7.7 Option 2, and 2021/914 Annex III.
4. **Tie-break (N4).** Decision 5 states the order: same date by `id` ascending, then `added` before `removed`. This matches data-model.md.
5. **FR-006 (N5).** The ADR wording, `{ type: biblio | tool, id }`, is right. The spec is still not fixed (spec.md:189 names only `biblio`), and nothing outside the cycle-1 review records the divergence. This review records it as a **known divergence**: fix FR-006 in a spec touch-up before acceptance. It does not block WP01.
6. **Issue matrix.** Rows #403, #359 and #402 are set:
   - #403 is `in-mission`, with real title and evidence.
   - #359 is `not-applicable`, as a dependency delivered by PR #445.
   - #402 is `not-applicable`, as context only.

## Findings (non-blocking)

1. **D2 inputs are narrower than cycle 1 asked.** Decision 6 says the source digest covers "the `_meta/subprocessors.yaml` file and the generator configuration". Cycle 1 asked for "plus any reference data the page renders". If WP07's page renders resolved bibliography, tool or measure titles, those catalogs are D2 inputs as well. A change to one would then surface only as `stale-render`, never as `stale-source`. Fix this in WP07 by declaring every rendered catalog as an input, or reword the ADR when it is accepted.
2. **SCC annex scope, ⚖ counsel.** As I recall the Official Journal text (I did not re-fetch it in this review), the explanatory notes to 2021/915 Annex IV and 2021/914 Annex III say those annexes are completed for **specific** authorisation: Clause 7.7(a) Option 1, and Clause 9(a) Option 1 for Modules 2 and 3. Under the general authorisation (Option 2), the clauses refer to "an agreed list". The ADR uses Annex IV for what an entry holds and Option 2 for change notice, and both uses are reasonable. Even so, "the list itself comes from the standard contractual clauses" blurs the two. Counsel should confirm the wording at acceptance. Precise pin cites would be "Clause 7.7(a)" and "Clause 9(a)".
3. **Responsibilities field.** Annex IV asks for "a clear delimitation of responsibilities in case several sub-processors are authorised". The field makes this required for every record. That is a format choice already under the ⚖ field-set review, and it needs no change now.
4. **Model-naming trailer.** Implementer commit 7645ff6e carries `Co-Authored-By: Claude <noreply@anthropic.com>`, as 577da43b did. Strip it at the PR rebuild.
5. **Matrix detail.** Row #403 has `wp: "WP02"` and `fr: null`, but the mission is WP01–WP07. This is acceptable if the schema takes only one WP. Otherwise, fill it at acceptance.

## Checks run on 7645ff6e

- `validate:adr-ids`: pass (86 ADR ids, all unique).
- `validate:adr-index`: exit 1, identical to `origin/main` (expected under ADR-0072 D2; the bot regenerates after merge).
- `validate:docs`: pass (218 files, 4 pre-existing warnings).
- `validate:links`: pass (1954 references, 301 files).
- markdownlint: 0 issues on the one changed file.
- lint: pass. Typecheck: pass.
- `pnpm test`: exit 0. src: 241 files and 4745 tests passed. mcp: 23 files and 181 tests passed. No flakes hit (`docs-loader-includes` #449 passed), and no glossary side effects to stash (#448): the tree stayed clean.
