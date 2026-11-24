---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command:
reviewed_at: '2026-11-23T09:42:37Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP04
---

# WP04 review — cycle 1: changes requested

Reviewer: `claude::reviewer-renata`. Lane-d reviewed at `8e89964` (stacked on lane-c `ad42cf9`).

## Blocking

### B1 — The new example pages break the pinned example artifact counts (T018)

`pnpm test` (both tiers, 17 min) on lane-d: **4338 passed, 3 failed** (4341 tests, 216 files).
The 3 failures are all in `src/tests/example-adopter.test.ts`, "WP04 worked example — real build":

- `T023: assert-build-artifacts.mjs (WP01-owned pinned ratchet) passes …`
- `#103: assert-build-artifacts.mjs fails, naming the link, …`
- `#176: the gate walks the content graph: …`

Cause, from the test output:

```
assert:artifacts: FAIL — sitemap: page-URL count is 84, expected 78 (the published set — 22 example .md files − 3 drafts, …
If example content changed intentionally, update EXPECTED_SITEMAP_URL_COUNT and re-cross-check example/docs)
```

The six pages in `example/docs/guides/capped-hub/` raise the published count. On base `9621b5f` the same file
passes 19/19. WP01–WP03 change nothing under `example/`, so this regression is WP04's. The CI
`assert:artifacts` step on the built example would fail the same way.

T018 asks for this explicitly ("Fix any existing example test that counts guides pages (record the out-of-map
edit)"). The hand-off's "fast suite 4090/4090" covers only the fast tier, and this ratchet lives in the build
tier.

**Fix:**

1. In `src/scripts/assert-build-artifacts.mjs`, update `EXPECTED_SITEMAP_URL_COUNT` (78 → 84) and its comment
   ("22 example .md files" → 28).
2. Re-check `EXPECTED_INDEX_ENTRY_COUNT` (73) and any other pinned example counts. The comment there asks you to
   re-cross-check `example/docs`.
3. Record the file as an out-of-map edit.
4. Run the whole `pnpm test`, including the `build` project, not only the fast tier. Report both counts.

### B2 — `playwright.local.config.ts` is committed

The hand-off calls this an "uncommitted config overlay", but commit `8e89964` ("commit lane deliverables for
review") adds it at the repository root. It hard-codes this container's Chromium path
(`/opt/pw-browsers/chromium`) and `--no-sandbox`. It is not in `owned_files`, and it does not belong in the
product repo.

**Fix:** remove it from the lane, for example with `git rm --cached` and keep it local or under a git-ignored
name. If a local-browser override is wanted, propose it as a separate, documented change.

## Non-blocking (fix if cheap)

- **N1** — In `sidebar-child-cap-build.test.ts`, the determinism test's `strip` (`sidebar-cap-again` →
  `sidebar-cap-capped`) is a no-op, because the site folder name never appears in the built HTML. Its comment
  ("Same site folder name in the same checkout") is wrong: the two folder names differ. Drop the strip, so the
  test asserts raw bytes as NFR-003 says. Consider also asserting that `again` has the same route set, because
  the loop only walks `capped`'s routes.
- **N2** — The golden test hashes page HTML only. CSS bundle names are masked and their contents are not hashed.
  That matches NFR-002 ("every built page"). Say so in the docblock, so nobody reads it as covering CSS.
- **N3** — `measure.mjs` runs all capped runs, then all uncapped runs, rather than interleaving them. The sizes
  are deterministic, but the time medians can drift with machine load. Interleave the variants, or note this in
  the WP05 hand-off.
- **N4** — `tests/a11y/routes.ts` is not extended. That is acceptable: the spec runs its own axe pass in both modes.
  The prompt says to add the routes "if the axe sweep lists routes", and it does (`AXE_PAGES`), so either add them
  or say why not.

## Verified (no action)

- **Red on base.** I copied the suite onto `9621b5f`. The 4 behaviour tests fail for the right reasons: the group
  has 201 links where at most 52 are allowed, there are 3 current entries, and paging follows slug order. The 2
  controls (golden, determinism) pass.
- **Mutations.**
  - Capped entry forced to `isCurrent: false`: SC-002 goes red, and the golden and determinism tests stay green.
  - prev/next falling back to Starlight's order: FR-007 and FR-008 go red.
  - `INDEX_ENTRY_LABEL` changed (affects uncapped pages): 14/14 pages differ from the golden. The mask is narrow
    enough.
  - Caveat: the fixture renders Starlight's default sidebar, not the toolkit's `SidebarSublist`, so a markup
    change there is invisible to this fixture.
- **Goldens.** `capture-golden.mjs` is documented. Re-capturing on `9621b5f` reproduced `golden/uncapped.json`
  byte-for-byte. The golden test also passes from a different checkout path.
- **Build suite on lane-d.** 8/8 pass in about 27 s in the `build` project. The serialised registration in
  `vitest.workspace.ts` is justified, and it keeps the suite out of the fast tier.
- **Playwright** (preinstalled Chromium, `light` and `dark` projects): 10 passed, 2 skipped as light-only.
  Disabling the `dkHubOrder` block in `src/lib/openapi/route-middleware.ts` turns the OpenAPI-on prev/next test
  red.
- **Measurement** (`measure.mjs`, 1,000 children, 3 runs each, same machine):
  - median page 168,877 → 24,013 bytes (−85.8%, meets NFR-004's ≥50%);
  - total output 163.7 → 23.5 MiB;
  - build time 27.7 s → 19.0 s here (17.1, 19.3, 19.0 / 28.4, 27.4, 27.7). The implementer measured
    21.5 → 13.9 s. The sizes reproduce exactly; the times scale with this machine.
- **Other gates.** `pnpm lint`, `pnpm typecheck`, `validate:example` and `validate:links` are clean.
- **Example hub.** It fits the example site (`kind: Hub`, `sidebar_child_cap: 3`, five Explanation children) and
  builds.
- **Out-of-map edits.** `src/vitest.workspace.ts` and `.gitignore` are justified. `.gitignore` is in fact in
  `owned_files`.
