# Research: gherkin-trim-and-followups

Spikes were run against commit `050b168c` by reading the code. Starlight is 0.32.6 (`example/node_modules/@astrojs/starlight`).
Nothing was changed in `src/`. Claims marked **(unverified)** were not run end to end.

## S1 — Overview label: translation and option (#161, FR-009/010)

**Decision**
- **UI string key**: `dockitty.sidebar.indexLabel`, with English default `Overview`.
- **How the default ships**: `defineDocKittyIntegrations` adds a small Starlight plugin (`doc-kitty:i18n`) to `starlightConfig.plugins`. Its `i18n:setup` hook calls `injectTranslations({ en: { 'dockitty.sidebar.indexLabel': 'Overview' } })`. A site translates the label by adding the key to its own `src/content/i18n/<locale>.json`.
- **Option**: `defineDocKittyIntegrations({ sidebar: { indexLabel: 'Start here' } })`, a non-blank string. The value is carried to the middleware in the existing `virtual:doc-kitty/route-shaping` data, as a new `indexLabel` field (`routeShapingSource`, config.ts ~:1770).
- **Where the label is chosen**: `route-middleware.ts` works out `label = routeShaping.indexLabel ?? context.locals.t('dockitty.sidebar.indexLabel')` for each request and passes it to `shapeSidebar(…, { indexLabel })`. `INDEX_ENTRY_LABEL` stays as the exported default. `shapeSidebar` uses `opts.indexLabel ?? INDEX_ENTRY_LABEL` in the relabel step (~:309-318), including in the "another entry already reads Overview" check.
- **Precedence**: the option, then the locale's translation, then Starlight's fallback to the default locale, then `Overview`.

**Evidence**
- Starlight sets `context.locals.t = useTranslations(context.currentLocale)` in `locals.ts:8`, before route-data middleware runs (`utils/routing/middleware.ts:15` builds `starlightRoute` and then runs the middleware chain). So `t` is per-locale and available at shaping time.
- `plugins.ts:50` exposes `injectTranslations` to a plugin's `i18n:setup` hook (Starlight ≥0.30).
- `schemas/i18n.ts:28`: the i18n collection schemas are "passthrough", so an extra key in a site's `i18n/<locale>.json` is accepted without `i18nSchema({ extend })`. **(unverified at runtime; the IC-07 red test proves it with a fixture locale file.)**
- Prev/next: `shapePagination` (~:371) already puts the page's original title back for a relabelled link ("Pagination keeps the page title", #112). So "prev/next follow the same label rule" (US4-AS4) means the translated or overridden label never reaches prev/next either. This is guarded, not changed. **Operator check**: if the spec meant that prev/next should *show* the label, that would change 0.3.0 behaviour. The plan assumes it does not.

**Alternatives rejected**
- An env bridge like `DK_INDEX_BASENAME`: these exist for code that cannot import virtual modules (scripts and standalone routes). The middleware already reads `virtual:doc-kitty/route-shaping`, and a string label does not need process-global state.
- Requiring adopters to extend `i18nSchema`: more adopter work, and the schema is passthrough anyway.
- Translating inside `shapeSidebar`: it would make the pure module depend on Astro. The label is passed in instead.
- An English-only option: decision 8 requires both the UI string and the option.

## S2 — A missing report fails in CI (FR-006)

**Decision**
- `checkResultsReport` (config.ts ~:1447) keeps one branch for a missing report (`!loaded.ok`). There it calls `isCiEnv(process.env.CI)`. When that returns true and `results.required !== false`, it **throws** `[dk-gherkin] gherkin.results report not found: <path> (CI is set; set gherkin.results.required: false to build without results)`. In every other case it keeps today's warning.
- `isCiEnv(raw)`: `raw` is trimmed and lower-cased. It returns true when the result is non-empty and not `false` or `0`. So unset, `''`, `'  '`, `false`, `FALSE` and `0` mean local.
- **Opt-out**: `gherkin.results: { report, root?, required?: boolean }`. `GHERKIN_RESULTS_KEYS` gains `'required'`. `normalizeResultsOption` accepts only a boolean (anything else throws `gherkin.results.required must be a boolean`) and returns `required` only when it was given. The string form `'reports/x.ndjson'` means `required` is unset, which is treated as true. `scenarioIndexRoute({ results })` shares the normaliser: it accepts the key and ignores it, because the route never throws for a missing report.
- An empty, malformed or over-cap report still throws as it does today (spec edge case). `required` only changes the not-found case.

**Evidence**: `example/reports/cucumber.ndjson` and `PROVENANCE.txt` are tracked (`git ls-files`). `example/astro.config.*:129` sets `results: 'reports/cucumber.ndjson'`. So the example build passes with `CI=true`. **(unverified: IC-06 adds an assertion that the example's configured report exists, using the example test's existing config read.)**

**Risk (important)**: GitHub Actions sets `CI=true`. `gherkin-results-build.test.ts` case 3 ("a missing report builds, with a warning") runs `spawnSync` with the inherited env, so it **would fail in CI** once FR-006 lands. Every test that relies on missing-report-warns must set `CI` explicitly (`env: { ...process.env, CI: '' }`, or `vi.stubEnv`). The same fixture then also runs with `CI: 'true'`, expecting a failure, and with `CI: 'true'` plus `required: false`, expecting a warning. This is the paired no-op guard.

**Alternatives rejected**: `failWhenMissing`, `optional: true` or `ci: false`. `required: false` reads best next to `report`, and its default (true in CI) matches decision 5. A separate env var like `DK_RESULTS_REQUIRED` was rejected because it is not discoverable.

## S3 — Leak sentinels across all built output (FR-005)

**Decision**: use two layers, the smallest shape that is still robust.
1. **The FR-005 guard** is in `src/tests/gherkin-results-build.test.ts`. Its build fixture report carries three distinct sentinels: `DK_SENTINEL_MESSAGE_…` in a failure message, `DK_SENTINEL_STACK_…` in a stack trace, and `DK_SENTINEL_ATTACHMENT_…` in a base64 or text attachment. After the build it walks the **whole** out dir (every `.html`, `.txt`, `.json`, `.xml` and `.md` file, which covers `llms*.txt`, `api/scenarios.json`, the agent API files and feeds) and asserts that none contains any sentinel. The positive control on the same build asserts that a `data-status="failed"` badge and `"result":"failed"` in `api/scenarios.json` are present.
2. **The dist tripwire** in `assert-build-artifacts.mjs` (~:1674): the `GHERKIN_RESULTS_LEAKS` loop moves from `GHERKIN_RESULTS_PAGES` HTML to a single walk over all text files in `dist`, so the deployed example is checked too. It stays one loop and is cheap.

**Alternatives rejected**: a new dedicated e2e spec (more lines, against the trim). Scanning only HTML pages (that is the current gap: llms and the JSON outputs are not covered).

**Note**: the build test belongs to IC-02's file set, so IC-05 follows IC-02.

## S4 — Stale note on include, and the hand-mounted-route warning (FR-007/008)

**FR-007 decision**: the seam is the section renderer in `src/lib/gherkin/mdast.mjs` (~:470). Today `outcome` is only computed when `results?.state === 'current'`, so a stale report renders nothing. A new `staleResultParagraph()` returns a paragraph on the **result line** (class `GHERKIN_CLASSES.result`, the same element a status uses). It reuses the wording of the feature-level stale summary (~:405). The renderer emits it when `results?.state === 'stale'`, `section.kind === 'scenario'`, and the render is a single-scenario include, meaning the feature summary paragraph is not rendered (the `header` option is not `'full'`). The exact flag is confirmed by IC-06 when it reads `include.mjs`. **(unverified)** When a scenario is missing from a current report, nothing changes (it shows `Not run`). When the report is stale, the note shows whether or not the scenario is in it (spec edge case).

**FR-008 decision**: the warning is raised in the route, not in config. Config cannot tell whether a hand-written `src/pages/api/scenarios.json.ts` passes `results`. `scenarioIndexRoute(options)` (`src/lib/routes/scenario-index.ts` ~:80) warns once, through a module-level `warned` flag, when `options.results === undefined` and `process.env[DK_GHERKIN_RESULTS_ENV]` is set. config.ts ~:1982 already publishes that env var for the docs loader. The injected route always passes `results` when it is configured, so it never warns. To name the route file, `hasOwnScenarioIndexPage` gains a sibling `ownScenarioIndexPage()` that returns the matched path. config.ts publishes that path in `DK_GHERKIN_INDEX_ROUTE_ENV` in the hand-mounted branch (~:1364) and clears it otherwise. The warning reads it and falls back to `src/pages/api/scenarios.json` if it is unset. The endpoint is prerendered once per build, and the flag guards dev re-renders, so the warning is "once per build". **(unverified: that prerender sees env vars set in `config:setup`. The precedent is `DK_GHERKIN_RESULTS_ENV`, already read by the docs loader at render time.)**

**Alternative rejected**: a config-time warning whenever a hand-mounted route exists and `results` is set. It would warn even when the route passes `results`, which breaks the with-results control.

## S5 — Trim method

**Decision**
- Freeze the baseline: `research/baseline.md` plus `research/count-lines.mjs`, a planning artifact that is not shipped.
- Write the coverage map first (`research/coverage-map.md`, format defined there).
- Split the trim by **file ownership**. Each test and fixture file has exactly one trim owner (plan.md, IC table), and behaviour work packages that touch a trimmed file come after its trim owner.
- Trim moves, per DIRECTIVE_041 and the test-cleanup rubric:
  - `it.each` tables over report formats (one row per format, not one test);
  - fold the review-regressions blocks into the matrix rows they repeat;
  - one assertion per behaviour per layer (parser, mdast, HTML, build), and drop cross-layer repeats unless the layer adds behaviour;
  - share feature fixtures that are duplicated across `render/`, `load/` and `include/`, keeping `gherkin-fixture-parity.test.ts` green.

**Alternative rejected**: trimming by layer across all files. Several work packages would edit the same file.
