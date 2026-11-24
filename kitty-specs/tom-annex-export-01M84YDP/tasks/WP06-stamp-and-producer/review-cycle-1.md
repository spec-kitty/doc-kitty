---
affected_files: []
cycle_number: 1
mission_slug: tom-annex-export-01M84YDP
reproduction_command: spec-kitty agent tasks move-task WP06 --to approved --mission tom-annex-export-01M84YDP --agent claude::reviewer-renata
reviewed_at: '2026-11-24T17:21:45Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP06
---

Approved by claude::reviewer-renata: approval:WP06

# WP06 review, cycle 1: APPROVED (claude::reviewer-renata)

Range: 0930cbba..9777d6fa (lane-f). The WP06 commits are 94ea8294, bc79540a and 9777d6fa, with the approved lane-e merged at efa44f1f.
Normative source: ADR-0087 (Accepted) on main, including the R81 amendment to D3.

## Independent recomputation

- Python (`hashlib`, `sorted()` over UTF-8 keys, `json.dumps(sort_keys)` for JCS) reproduces the ADR values:
  - the D2 worked example: `sha256:3f1cb1c1bfbeb5922c739057e9987407df7396829d97682420aee0ea94d823d2`;
  - the empty digest: `e3b0c442…b855`;
  - the page `content_hash`: `3ebe501730db`.
- Lane-f's `sourceDigest` gives the same two digests.
- A non-BMP key ordering (U+FFFF against U+1F600) does not depend on input order and follows UTF-8 byte order.
- Separators: `docs\a.md` and `./docs/a.md` give the same key. The sort is `Buffer.compare`, so it does not depend on locale.
- What changes the digest: a change to `site`, a change to `base`, and an evidence-byte edit each change it. A whitespace edit to a non-evidence page does not.
- `content_hash`: the first 12 hex digits over `serializeTomAnnex` without `generated`. This is the D2 rule for a JSON producer ("as its documented serialiser writes it").

## Declared divergences from the prompt, judged against ADR-0087 D2

1. Sorting by UTF-8 key bytes is **required** by D2 step 2. The prompt's "code unit" sort would be non-compliant. ACCEPT.
2. A single `config:doc-kitty-tom-annex` entry, the JCS of {base, catalog, site}. D2 step 1 knows only file, `children:` and `config:` keys, at most one config entry per producer. `site` and `base` change every evidence URL, so they belong in it. The default catalog sorted by id is what you get when the default is configuration. ACCEPT.
3. A consumer `_meta/measures.yaml` is a file entry (D2 step 1, "A file"). It replaces the default wholesale (measures-loader: no merge), so `catalog: null` in the config loses nothing. ACCEPT.

## format_version 1.0 with `generated` now required

- NFR-003 says additions bump the minor version.
- No format 1.0 without the stamp has been released: tom-annex is absent from main, and the mission lands in one PR.
- The shipped schema now equals `contracts/tom-annex.schema.json` exactly (key-sorted diff empty).
- ACCEPT. This is not a versioning violation.

## Out-of-map edits

- The out-of-map edits are minimal and stamp-only:
  - route + route test (WP03);
  - schema `required` + core test (WP01);
  - verify.mjs stamp block, schema-check FORMS and gate/build tests (WP05).
- The WP06 commits do not touch `draft-publication-build.test.ts`: the unmasked tom-annex two-builds assertion came in with approved lane-e.
- The approved WPs' behaviour is unchanged apart from the stamp. The route test now compares the body minus `generated` to the core bytes.

## Gates (lane-f @ 9777d6fa)

- `pnpm test`:
  - src: 250 files, 4895/4895 tests;
  - mcp: 23 files, 181/181 tests;
  - exit 0, with no flakes.
- Lint: 0.
- Typecheck: 0 errors.
- The tree stayed clean afterwards: no #448 glossary side effects.

## Mutation testing

**Changed scope** (stamp.mjs, verify.mjs stamp block, route, producers.mjs; fast tier): 31 mutants, 26 killed.
Survivors:

- **N1.** Removing `site` from `annexConfig` survives. No test varies only `site`; "changes with the site or the base" only varies `base`. I checked by hand that the real code changes with `site`. Add a site-only case.
- **N2.** Removing the `classified-as` filter in `evidenceSourceFiles` survives at the fast tier, because the fixture graph has no edges of other relations. Add an edge of another relation (for example a links-to edge from the unrelated page) as a negative control.
- **N3.** Dropping `consider(ref.updated)` survives in the unit tests, because the fixture's `verified` is later than its `updated`. `tom-annex-build.test.ts` (updated only, `at` = 2026-11-20) kills it at the build tier. Optional: add a unit case with `updated` only.
- **Nits.** Two more survivors:
  - the `./` strip in `posix()` is untested, and the route never produces `./`;
  - widening the registry `kinds` survives, because the caller's narrowed scope supplies `kinds`.

**schema-check.mjs FORMS** (WP05 follow-up): 8 mutants, 7 killed. The survivor, `items !== undefined` against `items && object`, is equivalent: `FORMS.items` already rejects a non-object.

## Adversarial notes (non-blocking)

- **N4. Path base.**
  - Keys are relative to `process.cwd()`. That is the project root, and `site-graph` resolves `docsRoot` against the same cwd, so the keys are deterministic and never `../`.
  - In a project whose Astro root is not the git root, they are project-relative rather than D2's "repo-relative". For doc-kitty's own example the keys are `docs/…`, not `example/docs/…`.
  - This is declared in the hand-off. Today nothing recomputes this digest outside doc-kitty.
  - WP08's guide should state "project-relative" explicitly, or a later change should anchor the keys to the repo root.
- **N5. The gate does not check `generated.at` or `source_digest` values.** A hand edit of either in the built file passes, because `content_hash` excludes the stamp by design.
  - `at` could be recomputed cheaply with `annexInstant(annex)`.
  - `source_digest` needs the docs tree.
  - Suggested for WP07's `--check`.
- **N6. Formatting and key order are not caught.** The gate hashes the re-serialisation, so a hand edit that only changes formatting or key order is not caught. Optional fix: `annexText === serializeTomAnnex(annex)`.
- **N7. `at` is null when no listed evidence has `updated` or `verified[].at`.** Schema and contract allow null; this is the "never the build clock" rule of D5. Acceptable.
- **N8. ADR-0087 D3 `--check`.**
  - It does not exist on main: there is no `validate:generated` and no `source_digest` reader.
  - Recognising this producer's stamp there is therefore N/A now.
  - The registry entry (`ownership`, `stamp-and-scope`, Hub, narrowed per call) means a future registry-driven check will pick it up.

## Anti-pattern checklist

1. Dead code: PASS. Every export has a production caller: route, verify.mjs, stampAnnex.
2. Synthetic fixture: PASS. The build test drives real `astro build`; the route test reads real bytes from disk.
3. Silent empty return: PASS. A null `at` is documented and by design.
4. FR coverage (FR-008): PASS. The stamp shape, `at` from evidence and the digest inputs are each asserted.
5. Frozen surface: PASS.
6. Locked decision: PASS.
   - C-003: the route only reads bytes.
   - D5: the clock is never read, and a grep for `Date.now`, `new Date(` and `performance` in stamp.mjs finds nothing.
7. Shared-file ownership: PASS. The out-of-map files are listed in the hand-off with their rationale.
8. Production fragility: PASS. The throws in stamp.mjs fail loudly at build time on corrupt inputs: a duplicate key, a bad hex value, a missing source file, a consumer catalog without its file.

Verdict: **APPROVE**. N1 and N2 are small test gaps worth folding in before consolidation. N4 and N5 can go to WP07/WP08.
