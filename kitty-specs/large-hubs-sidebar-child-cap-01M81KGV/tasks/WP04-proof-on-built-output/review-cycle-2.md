---
affected_files: []
cycle_number: 2
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command: spec-kitty agent tasks move-task WP04 --to approved --mission large-hubs-sidebar-child-cap-01M81KGV --agent claude::reviewer-renata
reviewed_at: '2026-11-23T10:21:13Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP04
---

Approved by claude::reviewer-renata: approval:WP04

# WP04 review — cycle 2: approved

Reviewer: `claude::reviewer-renata`. Lane-d reviewed at `04fd0a0`, which is stacked on lane-c. Lane-c's code equals the
approved WP03 head `ad42cf9`: `git diff 8e89964 ad42cf9 -- src/lib` is empty, and every WP01–WP03 code commit is
an ancestor of lane-d.

## Cycle-1 blockers

- **B1 — fixed, and the new counts are derived, not just bumped.** I built the example in a separate worktree
  (`pnpm build`):
  - `dist/sitemap-0.xml` has **84** `<url>` entries. Six of them are `guides/capped-hub/{,generated-pages,
    the-capped-entry,what-stays-reachable,where-the-cap-is-set,why-a-cap}/`.
  - `dist/api/index.json` has `count` **79** (= `pages.length`), and the same six slugs are in it.
  - So 78 + 6 = 84 and 73 + 6 = 79. None of the six pages is a draft.
  - `assert-build-artifacts.mjs example/dist` → `PASS`.
  - `example-adopter.test.ts` passes in the full run (below).
- **B2 — fixed.** `playwright.local.config.ts` is absent from the lane-d tree (`git ls-tree`). It was removed in
  `e062952`.

## Full `pnpm test` (both tiers) on lane-d `04fd0a0`

Exit **0**, in about 16 minutes:
- **src: 216/216 files, 4344/4344 tests**;
- **mcp: 23/23 files, 181/181 tests**.

`example-adopter.test.ts` (build tier) passes 19/19; it had 3 failures in cycle 1. `sidebar-child-cap-build.test.ts`
passes 8/8, and `sidebar-child-cap.test.ts` passes 29/29.

## Cycle-1 non-blocking items

- **N1 — folded.** The determinism test now compares raw bytes, with no rewrite, and asserts that the two
  builds have the same route set.
- **N2 — folded.** The docblock now says the goldens hash page HTML, that CSS bundle names are masked, and that
  CSS contents are not hashed.
- **N3 — folded, and the method is sound.** Each round builds capped and then uncapped. Each build starts from a
  freshly written site dir, and the dir is removed after the build. Load drift over the session therefore falls
  on both variants. Sizes come from the last run; they are deterministic.
  - Nit: capped always runs first within a round. An ABBA order would also cancel a linear drift inside a round.
    This does not change the conclusion, because the size result (≥85% smaller) is the NFR-004 gate and time is
    secondary.
- **N4 — folded.** `AXE_PAGES` gains `Capped hub` and `Capped hub child`. I ran
  `axe.spec.ts` and `sidebar-child-cap.spec.ts` on freshly built test dists (`pnpm build:test-dists`), in the
  `light` and `dark` projects, using the preinstalled Chromium through an untracked config overlay that I deleted
  afterwards: **16 passed, 2 skipped** (light-only). Both new AXE_PAGES entries pass in both modes.

## NB1 (behaviour change in approved WP03 code)

- **Red first — confirmed.** I put `route-shaping.ts` from `8e89964` (identical to `ad42cf9`) under lane-d's
  tests. `sidebar-child-cap.test.ts` gave 1 failed and 28 passed. Only the label-only test fails, and for the
  right reason: `next` was the capped entry's neighbour. The two NB2 tests pass on the old code. They are
  characterisation tests that kill mutants, as the commit says.
- **End to end, OpenAPI on vs off.** I wrote a probe: an 8-child capped hub (`childCap: 3`) built with and
  without `starlight-openapi`, both visible and with `sidebar.hidden` children. The overrides were:
  - m-0002 `next: "Read on"`;
  - m-0003 `prev: "Back up"`;
  - m-0004 `next: { label }`;
  - m-0005 `next: false`;
  - m-0006 `next: { link, label }`.

  I diffed the rendered prev/next (href and label) between on and off, both before NB1 (WP03 code) and after
  (lane-d):

  | case | before NB1 | after NB1 |
  |---|---|---|
  | visible, string override (m-0002, m-0003) | on ≠ off (on: the capped entry's neighbour) | **on = off** (hub order, author's label) |
  | visible, `{ label }`-only object (m-0004) | on ≠ off | on ≠ off (unchanged) |
  | `false` (m-0005), `{ link, label }` (m-0006), all other pages | on = off | on = off (unchanged) |
  | hidden children, string override | on ≠ off | on ≠ off (on now gives hub order + label; off gives **no link**) |
  | hidden, `{ label }`-only object | on ≠ off | on ≠ off (unchanged) |

  NB1 strictly improves parity: no case went from equal to different, and `false` and `{ link }` object overrides
  are unchanged. The remaining differences are **pre-existing in WP03**:
  - **F1 (follow-up).** A `{ label: "…" }` object with no `link` is also a label-only override in Starlight:
    `applyPrevNextLinkConfig` keeps the neighbour's href. `followsWithLabel` treats only strings that way, so
    with OpenAPI on that page still gets the capped entry's neighbour.
  - **F2 (follow-up).** On a child hidden from Starlight's tree, a label-only override gets no link at all with
    OpenAPI off. In `shapePagination`'s `at === -1` branch, `follows` is false and Starlight's link is
    `undefined`. With OpenAPI on (after NB1) it gets the hub-order neighbour under the label, which is the
    arguably correct result.

  Both cases are narrow (an author override on a child of a capped hub). Neither is in WP04's scope or a
  regression from this cycle, so they don't block. I recommend a follow-up for both: normalise label-only
  overrides (string, or an object with `label` and no `link`) in one place, and use it in both `shapePagination`
  and `followsWithLabel`.

## Gates

- `pnpm lint`: exit 0.
- `pnpm typecheck`: exit 0 (0 errors).
- The example build regenerates four glossary `index.md` stamps (`doc-kitty-glossary/0.7.0` → `0.7.1`). This
  is pre-existing generator drift and unrelated to WP04.

## Scope

The lane-d diff against approved lane-c `ad42cf9` touches:
- the owned files: the test, `fixtures/large-hub/**`, `example/docs/guides/capped-hub/**`, the a11y spec, and
  `.gitignore`;
- these out-of-map files:
  - `src/vitest.workspace.ts` (accepted in cycle 1);
  - `src/scripts/assert-build-artifacts.mjs` (named in `e062952`);
  - `src/lib/{route-shaping,route-middleware}.ts` and `src/lib/openapi-module.d.ts` (named in `e062952`);
  - `tests/a11y/routes.ts` (named in `04fd0a0`);
  - `src/tests/sidebar-child-cap.test.ts`.

Nits:
- `src/tests/sidebar-child-cap.test.ts` (WP03-owned) is edited for NB1/NB2 but not named as out-of-map in the
  commit message.
- In `tests/a11y/routes.ts` the two #341 entries are inserted between the `// #250 — the GitHub alert
  fixture…` comment and the entry it belongs to, so that comment now sits above the #341 comment.
- The sitemap fail message says "28 example .md files − 3 drafts, plus the 8 released generated…". That
  arithmetic did not match before this change either (22 − 3 + 8 ≠ 78). It is a pre-existing stale comment.

No dependency was added. No model identifiers appear in commits.
