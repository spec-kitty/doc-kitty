# Post-spec adversarial squad — M1 metadata model + chrome

**Point-cut**: post-spec · **Mission**: metadata-model-and-chrome-01M0PFQT
**Squad** (bounded, profile-loaded, read-only): reviewer-renata (contract fidelity),
architect-alphonso (seams/boundary), planner-priti (scope/harness), analyst-annie
(testability). Verdicts: all four **NO — fold before plan** (0–1 CRITICAL each,
convergent).

## Convergent findings (survived independent scrutiny)

### Design decisions to settle (some → new ADR)

1. **[CRITICAL — priti] Atomic-cutover invariant is unstated.** The validator, build
   schema, gating helpers, agent record, the ~84-file migration, `check-links.mjs`,
   the scaffold/new-doc templates, and the build assertions are a *single atomic
   cutover* for green CI. Migrate a doc while the validator still keys `status` →
   doc-sanity fails and `isPublished` sees `undefined→'draft'`, collapsing the pinned
   agent-index count below 12 (build-example red). No WP boundary may leave doc-sanity
   or build-example red. → new constraint + drives WP sequencing.
2. **[MEDIUM→ADR — alphonso] M1 implements a degenerate single-layer manifest.**
   theming.md/ADR-0011 describe the *M2-complete* merged virtual manifest + 3-layer
   merge. M1 must ship a deliberately degenerate version (one Default layer, static
   transport, no `theme` param). Per C-001 this deviation owes a **new ADR** pinning:
   static `kind→layout` module + static default-token stylesheet in M1; virtual
   manifest + merge deferred to M2; extension points M2 must preserve (carrier import
   site, token cascade order, `components` map already complete);
   `defineDocKittyIntegrations(options)` in M1 → gains `{ theme }` in M2. → **ADR-0013**.
3. **[HIGH — annie] `kind` on the bundle-root `docs/README.md` is ambiguous.**
   metadata-model.md says "required on every page"; the README exemption is scoped to
   `type`/`okf_version` only. → Resolve: `kind` **required on all pages incl. bundle
   root**; only `type` is exempt.
4. **[HIGH — annie] `hero_image.alt` required-ness unstated.** metadata-model.md:
   "carries alt text, which accessibility requires." → Resolve: `alt` **required** in
   `hero_image`.
5. **[MEDIUM — renata] `description` under-50 = warning** is the *preserved existing*
   M0 validator behavior (`DESCRIPTION_SOFT_MIN`), not a new deviation. → State
   explicitly as preserved behavior (no ADR needed).

### Harness-coverage gaps (green-CI blockers)

6. **[HIGH — priti] Sitemap draft-exclusion.** `@astrojs/sitemap` crawls built HTML,
   so the draft page currently emits a sitemap loc (M0 accepted 13 locs). SC-005
   requires draft absent from sitemap (convention.md rule). `isPublished` does not
   touch the sitemap. → new FR: sitemap draft-exclusion mechanism + loc-count/URL
   assertion.
7. **[HIGH — priti] `check-links.mjs:165` skips object-form `related`.**
   (`typeof ref !== 'string') continue`). FR-006's object form gets zero build-free
   integrity coverage. → teach `check-links.mjs` the `{ref, note}` shape (fold into
   FR-006/FR-008) + parity fixture.
8. **[HIGH — priti] Scaffold/new-doc templates emit `status` + no `kind`.**
   `scaffold.mjs` (×3) and `new-doc.mjs:87` mint non-conformant docs post-cutover. →
   add to FR-001/FR-019 scope + occurrence map.
9. **[HIGH — priti] Occurrence-map decoys.** `src/lib/routes/agent-page.ts:34`
   `status: 404` is an HTTP status — **do-not-touch**. Code symbols that DO rename:
   `metadata.ts` `DocStatus`/`isPublished`/`AgentRecord.status`/`toAgentRecord`
   default; the test corpora. → the plan's `occurrence_map.yaml` classifies decoy vs
   rename vs migrate; scope rename tooling to **git-tracked paths** (stale
   `.worktrees/` M0 copies must not be swept).
10. **[HIGH — alphonso] Carrier packaging seam.** The toolkit ships **zero `.astro`
    files** and no component export. FR-011 requires new `.astro` carriers + a
    `./components/*` export + `files[]` additions + Astro/Vite resolving `.astro` from
    a `workspace:*` dep. → make the packaging seam explicit.
11. **[HIGH/MEDIUM — alphonso+priti] `example/docs/` has no `_meta/sections.yaml`.**
    The validator runs on both roots. → keep the validator's built-in section→type
    map (works both roots; reads a registry where present) rather than a hard registry
    dependency; optionally add `example/docs/_meta/sections.yaml`.
12. **[MEDIUM — priti+alphonso] Demonstrators re-tag existing example pages.** The Hub
    and hero demonstrators must reuse existing example pages (count stays 12), not add
    files, or `EXPECTED_INDEX_ENTRY_COUNT` breaks.
13. **[MEDIUM — alphonso] Site-default share image has no M1 source.** The
    `social_thumb → hero_image.src → site-default` chain terminates in an M2 asset. →
    M1 ships a static neutral default asset consumed directly by `Head`.
14. **[LOW — alphonso] `Presentation` missing from `DOC_TYPES`.** The toolkit's own
    `presentations` section would warn. → Boy-Scout add `Presentation` to `DOC_TYPES`
    + validator mirror.

### Testability / acceptance-criteria additions

15. **[CRITICAL — annie] FR-011 carriers & FR-017 token catalog untested/incompatibly
    satisfiable.** → AC: `components` map points at the four named carriers reading
    `starlightRoute`; AC: emitted stylesheet declares the full `--dk-*` set + the
    `--dk-*→--sl-*` bridge assignments.
16. **[HIGH — annie+alphonso] NFR-004 Pagefind** — assert Hub content appears in the
    built `dist/pagefind/` fragment index.
17. **[HIGH — renata+annie] NFR-001 AA** untestable under the no-Playwright M1
    boundary. → text-label/alt verified by HTML assertion; contrast/≥24px/focus
    verified **by construction** (assert emitted CSS min-size ≥24px + the pre-verified
    AA `--dk-*` state/`-bg` token pairs) or recorded as a manual checklist.
18. **[HIGH — annie] NFR-005 parity** — encode a scenario: both validators evaluate
    the shared fixture corpus and agree pass/fail per fixture.
19. **[MEDIUM/HIGH — renata+annie] `social_thumb` fallback per-branch ACs** (three
    branches, each asserting the *resolved* `og:image` differs).
20. **[MEDIUM — annie+renata] Missing ACs**: missing-`kind`→error; under-50
    `description`→warning; empty `related`/`audience` lists→ok; malformed `audience`
    entry→error; out-of-enum `moscow.level`→error; unknown-`kind`/`type` warning
    **observably emitted** (not just exit 0); `feeds` section-filter regression after
    the rename; optimized hero `src` matches the `/_astro/…` hashed pattern.
21. **[LOW — renata] Cite ADR-0010** as the authority for the three planning kinds
    (Planning/Feature/User-Journey); reword FR-003 so sub-path overrides are the
    loader's table, not `sections.yaml`.

## Disposition

All folded into `spec.md` (rev 2) and ADR-0013 authored for finding 2. No divergence
required a second-opinion delegate; the four lenses were complementary and
non-contradictory. Convergence points (AA-testability, Pagefind, social-thumb
branches, example registry) were independently raised by ≥2 lenses.
