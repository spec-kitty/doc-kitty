# WP01 review feedback, round 1: changes requested

## 1. BLOCKER: check-redirect-coverage `--docs` fails open for a nested docs tree (FR-004, Addenda design rule 4)

`resolveSiteIndexBasenames(docsDir)` looks for a config only in `dirname(docsDir)`. When the docs tree is nested
(`site/content/docs`) and the config sits above it (`site/astro.config.mjs`), `indexNames.configPath` is null, so
`docsSite` is undefined, `envDir` stays undefined, and `resolveDraftPublicationForGate` runs against
`findSiteRoot(distDir)`, which is a config nobody evaluated. Before WP01 the `configEvaluated: false` sniff caught
this case. Now the gate proceeds silently.

Reproduction: `site/astro.config.mjs` = `throw new Error('boom'); export default { vite: { envDir: 'env' } };`,
plus `site/content/docs/README.md` and an empty `site/dist`:

- `check-redirect-coverage base.json site/dist --docs site/content/docs` gives `DK_PUBLISH_DRAFTS=on (from: default; site root: site)` and proceeds. **Fail-open.**
- The same command without `--docs` exits 2 (correct).
- `assert-build-artifacts site/dist` exits 2 (correct).
- `check-links --strict site/content/docs` exits 2 through the two-roots refusal (correct).

Fix: apply the same rule check-links uses. Find the config with `findSiteRoot` for the site root that decides
(`--site-root`, else `findSiteRoot(distDir)`). If that config is not `indexNames.configPath`, exit 2, or evaluate it
through `evaluateGateConfig`, unless `--env-dir` decides. Add a test for this exact nested case, and confirm it goes
red when the fix is reverted.

## 2. MAJOR (design rule 1, binding): check-links keeps its own stale config-name list

`src/scripts/check-links.mjs:107` still has `ASTRO_CONFIG_NAMES = ['astro.config.mjs','astro.config.ts','astro.config.js']`
(it is used at :487). That is a second discovery authority, and it has drifted from the six-name list in
`draft-publication.mjs`. Today it only drives the non-strict advisory note, so it is not a gate fail-open. But
rule 1 says "one discovery owner". Replace it with `findAstroConfig(dirname(absRoot))` and delete the local constant.

## Verified OK (no action)

- The fail-closed exit 2 holds for assert-build-artifacts, redirect-coverage without `--docs`, and the check-links two-roots refusal.
- `configEvaluated` and the regex are gone, and no dead `readFileSync` path is left.
- The cache stores `{names, envDir}`, with `envFile:false` folded in by `viteEnvDirOf`. There is one child per config per process.
- The other four callers of `resolveSiteIndexBasenames` keep the same return contract and error type.
- The tests are non-vacuous. With the five source files reverted to `da4a0b40^`, 4 tests fail in draft-publication (imported-base, throwing-config, envDir-from-eval, two-roots) and 1 fails in redirect-coverage (`--docs`/`--site-root` mismatch).
- The PlantUML "found 0 figure" stop comes before WP01 and is environmental. CI provides a `plantuml-server` service container, and WP01 does not touch the render-mode gate.
