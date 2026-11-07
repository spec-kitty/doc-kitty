---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-05T18:54:07Z'
reviewer_agent: claude
wp_id: WP11
---

# WP11 review feedback (reviewer-renata)

## Blocking

**Issue 1: the build cache can hide a real toolkit change.**
`src/tests/fixtures/chrome/harness.mjs`, `TOOLKIT_PATHS` (line 29) and `sourceFingerprint` (line 49).

The fingerprint leaves out `src/scripts`, but the production build imports from it:
- `src/layouts/Hub.astro:52` imports `loadAdrIdRule` from `../scripts/generate-adr-index.mjs`
- `src/lib/hub-children.mjs:25` imports `buildAdrHubCards` from the same file

Reproduced:
1. With a warm cache, add `throw new Error('probe')` at module level in `src/scripts/generate-adr-index.mjs`.
2. `vitest run --project build tests/chrome-baseline.test.ts` gives exit 0, 13 of 13 passed, on a build that cannot succeed.
3. Remove `example/.dk-test-chrome` and rerun: exit 1, with the fixture build tests failing.

The harness's own comment says a root is reused "while nothing that can change the output has changed". That is not true today.
CI is not affected, because it starts with no `.dk-test-chrome`. Local runs and later lanes get a false green. Hub output is in this mission's scope, and later suites will read cached hub pages.

Fix:
- Add `src/scripts` to the fingerprint. It is simplest to add it to `TOOLKIT_PATHS`, which also makes the capture script's dirty check cover it.
- In the same list, make `if (!existsSync(abs)) continue;` throw for toolkit paths, so a renamed directory cannot silently leave the fingerprint.
- Add a regression test or record the probe: a change under `src/scripts` must produce `cached: false`.

## Non-blocking (fix while you are there, or say why not)

- `harness.mjs` is not in the fingerprint either, and `buildEnv` in it shapes every build. Changing the environment it passes reuses old builds. Consider adding the file.
- `pnpm clean` (`package.json:14`) is documented in the README as clearing ALL build caches, but leaves `example/.dk-test-chrome` and `example/dist-chrome-*`. Add them, or the only way out of a stale cache is knowing the directory.
- `src/tests/fixtures/chrome/site/src/content.config.ts` adds one new `tsc` error (TS2307, `astro:content`) to `pnpm --filter @spec-kitty/doc-toolkit typecheck`. That command already has 31 errors and CI does not gate it (CI runs the root `pnpm typecheck`, exit 0). Excluding the site in `src/tsconfig.json` keeps the count from growing.
- `src/scripts/capture-chrome-baseline.mjs` ships in the package (`files` has `scripts`, exports have `./scripts/*`), but imports `../tests/fixtures/chrome/harness.mjs`, which does not ship. It is a dev-only script, so it cannot run from the tarball.
- README lines 87-88 still describe `build:a11y` then `test:a11y`. All four Playwright servers now start whichever projects run, so point it at `pnpm build:test-dists`.

## Verified, no change needed

- Goldens: no toolkit source differs from a03080e. They rebuild byte-identical from two cold runs, from a clean copy at another path with `TZ=UTC CI=true`, and under two other time zones.
- `page.html` holds all four metadata panels and no absolute paths or build timestamps.
- Non-vacuity: a class in `Audience.astro`, a relabel in the fixture, a CSS rule and a recapture each turned the test red.
- Lockfile: `--frozen-lockfile` passes in place and from a clean copy; dependencies are pinned exactly; integrity values match the registry.
- CI wiring and `ci-ok`: artifact names and paths match the Playwright servers, and `ci-ok` is unchanged.
- `pnpm test` (3655 + 178 passed), `pnpm lint`, `pnpm typecheck`, `pnpm assert:artifacts`, and the Playwright smoke in all three new projects.

The fix should not touch the goldens: no toolkit output changes, so `stamp.json` and `CAPTURED_ON` stay as they are.
