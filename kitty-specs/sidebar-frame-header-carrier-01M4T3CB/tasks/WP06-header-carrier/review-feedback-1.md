# WP06 review feedback (cycle 1) — changes requested

Reviewer: reviewer-renata (claude). Reviewed: 815c62c, 55c3b77 on 2ffe856.

The carrier itself is correct and byte-neutral. One blocking defect in the test fixture; one comment fix.

## Blocking

### B1 — `src/tests/fixtures/header-theme/stock-header.html` is bound to the lane-f checkout path

Astro's scoped class hashes (`astro-xxxxxxxx`) depend on the absolute path of the checkout. The committed fixture holds the hashes of
`.worktrees/sidebar-frame-header-carrier-01M4T3CB-lane-f` (`astro-xqlqasfd`, `astro-ll7tlscw`, ...). Every other checkout produces different ones:

| checkout | `<header class="header astro-…"><div class="header sl-flex astro-…">` |
|---|---|
| lane-f (fixture) | `xqlqasfd` / `ll7tlscw` |
| repo root | `67ggdlxs` / `wixmr2mu` |
| lane-a | `nxcykncd` / `rdqviukk` |
| scratch worktree of 55c3b77 | `h4p6n2tf` / `xq5ulevf` |

Reproduced: a `git worktree` of 55c3b77 at another path, `pnpm install --frozen-lockfile --offline`, then
`vitest run tests/header-carrier.test.ts` gives **7 failed / 9 passed** (the three pinned-page tests, "every framed page", and the three
"sits directly in the frame header" tests, whose `frameOpen` is sliced from the fixture). The suite will therefore go red on the mission
branch, in the repository root, in WP07's lane and in CI.

The test header says "Nothing in the block is normalised"; the WP prompt allowed normalising scoped-class hashes "only if they would differ
for reasons unrelated to this change — say exactly what you normalised and why". This is that case.

Required:
1. Replace `astro-[a-z0-9]{8}` with a fixed placeholder in both the fixture and the built block before comparing, and say so in the test
   header (what, and why: the hash is derived from the checkout path). Nothing else needs normalising: with only that substitution the
   header block of a build at another path equals the fixture (checked), so asset hashes are path-independent.
2. Take `frameOpen` in the themed test from the stock build's own page (or apply the same normalisation), not from the raw fixture.
3. Update the "Regenerating the fixture" note accordingly.
4. Prove it: run the test from a second checkout path and record the result in the hand-off.

The three mutations still have to fail after the change (wrap the fallback in a `<div>`; render both; unregister the carrier). They do
today in lane-f: 4, 4 and 10 failures.

## Non-blocking, fix in the same pass

### N1 — `src/components/Header.astro:24-26` states the wrong replacement contract

The comment says a replacement "owns ... the search control, the theme switch, the mobile menu control and a skip link". Starlight 0.32.6
renders `SkipLink` in `Page.astro` before `PageFrame`, and `MobileMenuToggle` in `PageFrame.astro` inside the sidebar `<nav>`; both survive
a replacement, as this package's own fixture comment and test assert. Correct the comment: a replacement renders inside Starlight's
`<header class="header">` (so it must not emit its own `<header>`), keeps the skip link and the mobile menu toggle, and loses the site
title/logo, search, social icons, theme select and language select. Do not point at `contracts/public-surface.md` section 3 for the list
until WP07 corrects it.

## Verified, no action

- Same-path build of 2ffe856 and 55c3b77, `DK_PUBLISH_DRAFTS=off`: 58 HTML files compared, 0 differ; `diff -rq` of the whole `dist` is empty.
- Escape hatch: `components: carriers` already replaced the whole map before this change, so a consumer `Header` was already discarded. No behaviour change.
- No runtime slot-name validation is pre-existing for every slot. Out of scope.
- The six out-of-map edits are comment-only; trial merges with lane-a, lane-b and lane-c are clean.
- `pnpm lint`, `pnpm typecheck` pass; `pnpm test` 1241 passed, 1 failed (known `example-adopter` T023, PlantUML).
