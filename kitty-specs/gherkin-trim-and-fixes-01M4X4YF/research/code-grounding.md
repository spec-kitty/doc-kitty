# Code grounding: Gherkin test trim and fixes

Read-only survey taken on `origin/main` at `81e1663`, before any edit. It covers
#156 (trim the Gherkin test overlap) and the five Gherkin fixes #123, #124, #125,
#126 and #128, which were left over from PR #121 and PR #151.

## 1. Files involved and what each owns

### Source (`src/lib/gherkin/**`, plain `.mjs`, JSDoc-typed)

| File | Lines | Responsibility |
|------|------:|----------------|
| `parse.mjs` | 159 | The one place a `@cucumber/gherkin` `Parser` is built; parses one string. |
| `fragment.mjs` | 224 | Parses a fence body that may omit `Feature:` / `Scenario:` (parser-driven retry). |
| `load.mjs` | 236 | Walks `sources` for `*.feature`, parses each once, returns the `FeatureModel`; `sourceLink`. |
| `feature-core.mjs` | 724 | Tag → frontmatter core: `parseMetadataTags` (the `@wip` / `@deprecated` shorthands, #123), `buildFrontmatter`, `serializeHubFrontmatter`. |
| `text.mjs` | 132 | Shared pure text helpers (narrative end, `isRelativePosixPath`, log prefix). |
| `view.mjs` | 512 | The view model: the one walk over a `GherkinDocument` both emitters share. |
| `render.mjs` | 553 | Emitter 1: view → Markdown body of a generated page. |
| `mdast.mjs` | 406 | Emitter 2: view → mdast subtree for a fence or include on any page. |
| `select.mjs` | 238 | Scenario selection (`scenario=`, `tags=`) for an include. |
| `include.mjs` | 206 | Include resolver: the trust boundary (`includeRoots`, realpath containment, `.feature` only, 1 MiB cap). |
| `include-path.mjs` / `include-scan.mjs` | 39 / 117 | Include path rules shared with the content loader; include hashing for cache freshness. |
| `agent-includes.mjs` | 159 | Splices include content into the agent payload (`/api/pages/<id>.json`). |
| `errors.mjs` | 136 | Process-wide fatal-error sink drained in `astro:build:done`. |
| `options.mjs` | 315 | Validates the `gherkin` option once for the integration and the CLI (`GHERKIN_PAGES_KEYS`, `GHERKIN_OPTION_KEYS`). #125 adds `titles` here. |
| `generate.mjs` | 622 | Plans and writes generated pages and hubs; `publishedDirs` gates hubs on a non-draft feature (#124, line 218); `dirTitles` (#125). |

Wiring outside the folder:

- `src/lib/remark/gherkin-fence.ts`: the remark stage for fences and includes.
- `src/lib/config.ts`: `gherkinIntegration` (codegen in `astro:config:setup`,
  line ~1293) and `gherkinFenceIntegration` (remark stage plus the fatal sink
  in `astro:build:done`). #126 adds a build-end check to the first.
- `src/lib/routes/llms-txt.ts:92`: advertises `/api/scenarios.json` when a
  published generated page exists. `src/lib/routes/scenario-index.ts` is the
  site-mounted route.
- `src/scripts/generate-feature-pages.mjs`: the bare-Node twin and `--check`
  drift gate (`pnpm validate:features` / `generate:features`). Its `FLAG` map is
  pinned against `GHERKIN_PAGES_KEYS`.

### Tests (`src/tests/gherkin-*.test.ts`, 17 files, about 8,000 lines)

`check-cli` 331, `codegen-guard` 183, `example` 167, `feature-core` 667,
`fence-build` 283, `fence` 742, `generate` 1130, `include` 745,
`integration` 497, `load` 230, `mdast` 550, `options` 242, `parse` 357,
`render` 688, `scenario-anchors` 246, `select` 301, `view` 488.

### Fixtures

- `src/tests/fixtures/gherkin/render/*.feature` + `*.md` goldens.
- `src/tests/fixtures/gherkin/generate/site/**` + `generate/expected/**` goldens.
- `src/tests/fixtures/gherkin/include/**`, `load/**`.
- `book-consignment.feature` (#128) exists byte-identical (md5 `d1c0e085…`) in
  `example/features/shipping/`, `fixtures/gherkin/render/` and
  `fixtures/gherkin/generate/site/features/shipping/`. A **fourth** copy is
  inlined as `EXAMPLE_FEATURE` in `gherkin-feature-core.test.ts:385`, guarded
  only by a hash of itself (`'the inline fixture is the example source'`): an
  inert self-compare that would stay green if the example drifted.
  `gherkin-check-cli.test.ts`'s `BOOK` is a different, shorter feature, not a copy.

## 2. Invariants that must survive

| Invariant | Source |
|-----------|--------|
| Generated pages are codegen'd into the collection, committed, and drift-checked by `--check`; build and gate share one implementation (parity by construction). | ADR-0046 decisions 3, 8; ADR-0026 |
| `planFeaturePages` is a pure function of the model and the docs tree: no clock, no locale, no environment. A rerun is byte-stable (no dev restart loop). | `generate.mjs` header, risk R3 |
| Single ownership by the `generated.by` stamp; an authored file in the section stops the build. | ADR-0046 decision 4; ADR-0048 |
| Draft gating: a draft never reaches the sitemap, `llms.txt`, the scenario index, or a hub's listing (hub Markdown is served raw to agents). | ADR-0046, INV-1 (`hub-children.mjs`) |
| `@dk:status` that cannot be honoured fails closed (draft). | `feature-core.mjs`, PR #121 landing |
| The `gherkin` option refuses unknown keys; `section` / `allowEmpty` are refused without `sources`; every pages key has a CLI flag. | ADR-0051; `gherkin-example.test.ts` FR-004a |
| The scenario index route is site-mounted, not injected (first injected route would need a tarball proof). | ADR-0046 decision 9; ADR-0026 (glossary precedent, `glossary/generate.ts:14`) |
| In-page errors are build-fatal via the error sink. | ADR-0051 decision 5 |
| ADRs are immutable once accepted; a change is a new ADR. | charter "Amendment and exceptions" |
| Docs pages carry `title`, `description`, `doc_status`, `updated`; behaviour changes update docs in the same change. | charter, `docs/context/convention.md` |

ADR-0046 states two things this mission changes, so it needs a new ADR, not an
edit: decision 3 ("one hub per directory with a non-draft feature") and the
"Known limit: a directory holding only draft features gets no hub" risk (#124),
plus decision 9's note that a site without the route advertises a missing page
(#126).

## 3. Gates that touch these files, and how each stays green honestly

| Gate | What it reads | How to keep it green |
|------|---------------|----------------------|
| `pnpm test` (vitest `fast` + `build` projects) | all `gherkin-*` suites; `draft-publication*.test.ts`, `sidebar-build-html.test.ts`, `scenario-index.test.ts`, `config-invariants.test.ts` (integration names), `gherkin-fence-build.test.ts` (real builds) | New behaviour lands red-first; retired tests only after a planted break turns the named covering test red. |
| `pnpm validate:features` (CI doc-sanity) | `example/features/**` vs committed `example/docs/behaviour/**` | Regenerate with `pnpm generate:features` in the same commit as any generator change; the script gains `--titles hr=HR` to match the config (#125). |
| `gherkin-example.test.ts` | parses `example/astro.config.mjs` `gherkin` literal and the `validate:features` script | Keep the flag set equal to the option; extend the parity check to `titles`. |
| `pnpm assert:artifacts` (`assert-build-artifacts.mjs`) | built `example/dist`: scenario index, llms.txt line, draft absence, page counts | No count change expected: the example has no draft-only directory. |
| `tests/a11y/gherkin.spec.ts`, `visual.spec.ts` (Playwright on `build:a11y`) | built pages incl. `/behaviour/shipping/book-consignment/` | KEEP by mandate. The `hr` hub retitle ("Hr" → "HR") changes sidebar text; rebaseline only if a screenshot shows it. |
| `tests/consumption/` + `assert-consumer-gherkin.mjs` | packed tarball consumer fixture (`gherkin: { includeRoots }`, no `sources`) | KEEP by mandate; the #126 check lives in the `sources`-only integration, so the fixture is unaffected. |
| `pnpm lint`, `pnpm typecheck`, `pnpm validate` | source and example docs frontmatter | Run before every push. |
| `validate:docs`, markdownlint, Vale, `validate:links` | `docs/**` (ADR, guide, architecture, changelog) | Frontmatter on every page touched; sentence-case headings. |

No gate may be loosened: a failing pin is re-pointed to the new truth (for
example a regenerated golden), never deleted to get green.

## 4. Per-file overlap map for the Gherkin suites

See section 7 (filled from the test-by-test inventory before the trim WP is
specified in detail). The issue's hypotheses to test:

- `fence` / `include` / `mdast` re-assert the view model at the emitter layer.
- `parse` / `select` / `view` are pure layers that `fence` and `include` also
  cover end to end.
- Rejection paths (traversal, missing file, missing root, decks) are asserted at
  both the include-unit level and the fence level.

## 5. Churn (`git log --since=90.days`)

All Gherkin code is new: PR #121 (generated pages) and PR #151 (fences and
includes) landed on 2026-10-13 and 2026-10-14, with landing fixes since.
Most-touched: `generate.mjs`, `generate-feature-pages.mjs`,
`gherkin-integration.test.ts` (5 commits each), `options.mjs`,
`gherkin-generate.test.ts`, `gherkin-example.test.ts`,
`gherkin-check-cli.test.ts` (4 each). Everything else 1–2. The surface is young
and still settling, which argues for trimming duplicates now, before they drift.

## 6. Interactions with sibling dispatches

| Sibling | Their files | Overlap with this mission | Plan |
|---------|-------------|---------------------------|------|
| Reading width #154 | `src/styles/theme.css`, `src/lib/theme.ts`, layout/a11y baselines | Playwright baselines | Do not touch their files; rebaseline once after rebasing if a screenshot changes. |
| Diagrams option #153 | `docs/guides/consumer-setup.md`, `src/lib/config.ts` doc comment | Same guide; `config.ts` | Edit only the Gherkin section of the guide (and the one scenario-route sentence in step 5); in `config.ts` touch only `gherkinIntegration`. |
| Theme slots #114 + sidebar labels #112 | `src/lib/theme.ts`, `src/lib/glossary/generate.ts`, sidebar build | #125 hub titles feed sidebar group labels; #124 adds a hub that the sidebar reads | No sidebar code change here: the title flows through the hub page. Rebase and recheck `sidebar-build-html.test.ts` if #112 lands first. |

## 7. Overlap inventory

The test-by-test inventory (406 `it` rows across the 17 files, with layer,
behaviour, proposed verdict and a planted break per RETIRE candidate) is in
[`gherkin-test-inventory.md`](./gherkin-test-inventory.md). Its first-pass
totals: 373 KEEP, 29 RETIRE, 4 MERGE, about 390 lines. The verdicts are
predictions until each planted break is run (WP05).

Findings against the issue's hypotheses:

- The view and mdast suites own shape; `fence` / `include` mostly assert plugin
  wiring (synthetic flag, include heading level, smartypants, deck and
  generated-page guards, error sink), which no unit suite covers. The real
  duplicates are a handful of shape re-checks in `include` and guards asserted
  at both fence and include level.
- `parse`, `select`, `view` stay whole apart from one same-file duplicate each.
- Rejection paths: each reason has a unit row (classification) and a section-5
  row (message). Single-input unit rows that the message row strictly covers
  are the duplicates.
- `check-cli` re-asserts drift classification that `generate` owns; the CLI only
  needs one test per printed drift kind, exit 0 and one error path.
- `integration` re-asserts option rules that `options` owns.
- `gherkin-feature-core.test.ts` inlines a fourth copy of the worked example,
  checked only against its own hash (an inert self-compare).
- Only `gherkin-fence-build.test.ts` runs real Astro builds (9).
- Hypothesis not confirmed: the issue's estimate of about 4,700 overlapping
  lines. Most of the line count is distinct coverage; the honest trim is in the
  hundreds of lines.
