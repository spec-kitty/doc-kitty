# Test verdicts: Gherkin suites (#156)

Procedure: `development-assist-test-cleanup` (KEEP / RETIRE / SPLIT-BY-KIND), with
DIRECTIVE_041 and the testing-principles and test-desiderata styleguides.
Rule applied: a test is retired only when a **named** surviving test asserts the
same behaviour at the layer that owns it, **and** a one-line planted break in the
source turns that covering test red. When the cover was only partial, the test
was kept.

Input: the test-by-test first pass in
[`gherkin-test-inventory.md`](./gherkin-test-inventory.md), which has one row for
each of the 406 `it` blocks on `origin/main`, with its layer and proposed
verdict. This file records the final verdicts, judged against the suite after
the fixes (WP01–WP04) landed.

## Summary per file

Test counts are executed vitest cases (each `it.each` row counted). Lines are
file lines. "Before" is after the fixes, just before the trim.

| File | Tests before → after | Lines before → after | KEEP | RETIRE | Verdict |
|------|---------------------:|---------------------:|-----:|-------:|---------|
| gherkin-parse.test.ts | 34 `it` | 357 → 357 | all | 0 | KEEP (view-level unit layer, by mandate) |
| gherkin-select.test.ts | 20 → 19 `it` | 301 → 297 | 19 | 1 | KEEP, one same-file duplicate retired |
| gherkin-view.test.ts | 26 `it` | 488 → 488 | all | 0 | KEEP (view-level unit layer, by mandate) |
| gherkin-mdast.test.ts | 20 `it` | 550 → 550 | all | 0 | KEEP (the in-page emitter's unit pin) |
| gherkin-fence.test.ts | 30 `it` | 742 → 742 | all | 0 | KEEP (fence smoke + plugin wiring); proposed merge declined |
| gherkin-include.test.ts | 55 → 49 `it` | 745 → 692 | 49 | 6 | KEEP the include smoke and wiring; retire duplicates |
| gherkin-fence-build.test.ts | 6 `it` | 283 → 283 | all | 0 | KEEP (the only real builds; one fence smoke + one include smoke); proposed merge declined |
| gherkin-render.test.ts | 29 `it` | 688 → 688 | all | 0 | KEEP (generated-page body emitter; goldens are its smoke) |
| gherkin-scenario-anchors.test.ts | 6 `it` | 246 → 246 | all | 0 | KEEP (scenario-index consumer) |
| gherkin-load.test.ts | 16 `it` | 230 → 230 | all | 0 | KEEP (owner of discovery and parse errors) |
| gherkin-feature-core.test.ts | 46 → 44 `it` | 642 → 562 | 44 | 2 | KEEP the tag contract; retire goldens the generator owns |
| gherkin-generate.test.ts | 58 `it` | 1220 → 1220 | all | 0 | KEEP (owner of planning, ownership, pruning, drift classification) |
| gherkin-check-cli.test.ts | 19 → 15 `it` | 348 → 302 | 15 | 4 (+1 row) | KEEP one test per printed drift kind, exit 0, one error path |
| gherkin-integration.test.ts | 29 → 25 `it` | 542 → 507 | 25 | 4 (+2 rows) | KEEP hook wiring; retire rules other suites own |
| gherkin-options.test.ts | 19 `it` | 295 → 295 | all | 0 | KEEP (owner of option rules) |
| gherkin-codegen-guard.test.ts | 3 `it` | 184 → 184 | all | 0 | KEEP (idempotency owner) |
| gherkin-example.test.ts | 5 `it` | 178 → 178 | all | 0 | KEEP (config ↔ drift-gate parity) |
| gherkin-fixture-parity.test.ts (new, #128) | 1 `it` (2 rows) | 31 | all | 0 | KEEP |
| **Total** | **665 → 642 cases** | **8,070 → 7,852** | | **16 tests + 3 rows** | |

Kept by mandate, outside vitest: `tests/a11y/gherkin.spec.ts` and
`tests/consumption/scripts/assert-consumer-gherkin.mjs`.

**Scale.** #156 estimated that about 4,700 test lines overlapped. Read test by
test, most of those lines are distinct coverage: each layer's suite owns its
own contract, and the emitter suites test plugin wiring that no unit suite
reaches. The proven duplication is 23 test cases and about 220 lines.

## Retired, with the planted break that turns the covering test red

Each break was planted alone, the covering test run, the result recorded, and
the source restored (`git checkout`).

| # | Retired test | Covering test(s) (red under the break) | Planted break |
|---|--------------|----------------------------------------|---------------|
| 1 | select › a Rule left with only its Background is dropped | select › a tag on one Examples block keeps the outline with that block only | `select.mjs`: `return child.rule.children.some((rc) => rc.scenario);` → `return true;` |
| 6 | include › a directory is notFile | include › `src` a directory | `include.mjs`: `if (!stat.isFile()) return …` → `if (false) return …` |
| 7 | include › a missing include root is rootMissing for a target under it | include › a configured include root that does not exist | `include.mjs`: `if (isInside(absPath, lexical)) return … rootMissing` → `if (false) …` |
| 10 | include › `scenario` inside a Rule keeps the Rule heading and its Background | select › a scenario inside a Rule keeps that Rule and its Background only | `select.mjs`: `if (rc.background) return true;` → `return false;` |
| 12 | include › links the source path to sourceUrlPrefix + the path relative to sourceRoot | include › the normalised includeRoots / sourceRoot / sourceUrlPrefix reach the plugin | `gherkin-fence.ts`: `sourceRoot: path.resolve(root, options.sourceRoot ?? '.')` → `sourceRoot: root` |
| 13 | include › keeps a quoted step argument verbatim as inline code | mdast › a full feature …; view › segments a double-quoted argument … | `view.mjs`: `QUOTED_ARGUMENT` → `/(?!)/g` |
| 14 | include › on a deck page a fence stays code while a directive is fatal | fence › a deck page is unchanged | `gherkin-fence.ts`: `collectBlocks(tree, { fences: !deck })` → `{ fences: true }` |
| 16 | feature-core › parsed with @cucumber/gherkin, serialises to the expected frontmatter exactly | generate › generates exactly the 3 expected files, byte-identical | `feature-core.mjs`: `kind: ${fields.kind ?? 'Specification'}` → `kind: Spec` |
| 17 | feature-core › matches the example shipping hub frontmatter exactly | generate › generates exactly the 3 expected files …; generate › a/b/c.feature → hubs at root, a/ and a/b/ … | `feature-core.mjs`: `'kind: Hub'` → `'kind: Index'` |
| 18 | check-cli › refuses to write into a section that holds an authored file; integration › refuses to write into a section holding authored content | generate › `%s` → throws naming it; NOTHING is written or deleted (5 rows) | `generate.mjs`: `if (authored.length > 0) {` → `if (false) {` |
| 18b | (exit-code half of check-cli retirements) | check-cli › a missing source directory → exit 1 | `generate-feature-pages.mjs`: the last `catch` `return 1;` → `return 0;` |
| 19 | check-cli › a removed .feature leaves its owned page stale | generate › clean / changed / stale / added / authored; check-cli › --check is unchanged by the flag: exit 1 listing every page as stale | `generate.mjs`: `const stale = owned.filter(…)` → `const stale = [];` |
| 20 | check-cli › a new .feature not yet generated → listed as `added` | generate › clean / changed / stale / added / authored; check-cli › never generated → … `added` | `generate.mjs`: `if (!existsSync(abs)) added.push(rel);` → `if (false) …` |
| 20b | (print half of 19 and 20) | check-cli › --check is unchanged by the flag …; check-cli › never generated … | `generate-feature-pages.mjs`: `DRIFT_KINDS` without `added` / `stale` |
| 21 | check-cli › a Gherkin syntax error → exit 1 with path:line:col | load › reports every error in every file in ONE thrown error (message); check-cli › a missing source directory (exit code, 18b) | `load.mjs`: `parseGherkin(bytes, { display })` → `{ display: 'x' }` |
| 22 | check-cli › `--section _meta` row (the `glossary` row is kept to prove the CLI names `--section`); integration › rejects the reserved section, `glossary` row (the `_meta` row is restored, see review cycle 1) | options › passes reservedSections through to the pages validator; check-cli › --section glossary is reserved | `options.mjs`: `if (reservedSections.includes(section)) {` → `if (false) {` |
| 23b | (propagation half of 18 and 23) | integration › throws [dk-gherkin] file:line:col for a malformed .feature | `config.ts`: the setup hook swallows a loader throw |
| 25 | integration › rejects an empty / non-array / blank sources (3 rows) | options › runs the pages rules once sources is present | `options.mjs`: drop `sources.length === 0 \|\|` |
| 26 | integration › rejects an allowEmpty that is not a boolean (3 rows) | options › carries allowEmpty into pages only when true | `options.mjs`: `if (allowEmpty !== undefined && typeof allowEmpty !== 'boolean')` → `if (false)` |
| 28 | integration › defaults to paths relative to the site root | integration › generates the section pages under docs/behaviour/** by default | `config.ts`: `sourceRoot: path.resolve(root, opts.sourceRoot)` → `path.resolve(root, opts.sources[0])` |

The eager-validation contract of `defineDocKittyIntegrations` keeps one row
(the section-shape rows) plus the single-sourcing test
(`config.ts validates through the shared options.mjs`).

## Review cycle 1: two retirements reversed

An adversarial review planted breaks in the code the retired tests reached
and found two that no surviving test caught. Both rows were restored and
shown red under those breaks:

| Restored test | Why the named cover was not enough | Break that was green before, red now |
|---------------|------------------------------------|--------------------------------------|
| integration › rejects a reserved section through the list config.ts passes (`_meta`) | `config.ts` passes its own list (`['_meta', ...BUILD_GENERATED_SECTION_IDS]`); the options test passes its own list and the parity test pins only the CLI's default | `config.ts`: `reservedSections: []` |
| integration › throws [dk-gherkin] for a missing source directory, named as configured | the load test calls `loadFeatures` directly and cannot see how `config.ts` passes `sources` in | `config.ts`: resolve each source to an absolute path before `loadFeatures` |

## Kept emitter smokes, shown red

| Emitter | Kept smoke | Planted break | Result |
|---------|-----------|---------------|--------|
| Fences | fence › replaces the fence with div.dk-gherkin, which has NO pre ancestor | `gherkin-fence.ts`: `const blocks = …` → `const blocks = [];` | red |
| Includes | include › a whole file: full header … and `Source: <path>` | same break | red |
| Generated pages (Markdown) | render › `%s` renders byte-for-byte (3 goldens); generate › generates exactly the 3 expected files | `render.mjs`: `childLevel(levels.section)` → `levels.section`; `feature-core.mjs` kind breaks (16, 17) | red |
| Generated pages (HTML) | `tests/a11y/gherkin.spec.ts`, `assert-build-artifacts.mjs` scenario-index block | (Playwright / build gates; kept by mandate) | run in CI |
| Fences and includes in a real build | fence-build › passes once the fence is fixed …; fence-build › passes once the scenario exists … | (real Astro builds; one per emitter) | kept |

## Proposed in the first pass, kept

| Test | Why it stays |
|------|-------------|
| include › reads a file inside a root (resolver happy path) | The resolver's own success contract; no other test asserts `absPath`. |
| include › a missing include root is skipped for a target outside it | Pins `notFound` and `outside` under a stale root; the message row covers only the success case. |
| include › reports every broken include on the page, in source order, and records them in the sink | The only test that mixes an include, a fence and a nested include in one page; the fence suite's order test has fences only. |
| include › `tags` is any-of and follows inheritance | Also pins attribute parsing of a bare tag word (`refunds` without `@`), which the select unit does not reach. |
| include › a generated feature page is left alone, directives included | Added at #151's landing as the include's own guard. |
| render › collapses runs of blank lines in descriptions (MD012) | The generated-page emitter's output contract; the view test checks the view, not the Markdown. |
| render › warns on a duplicate sibling scenario, naming both lines | The warning as emitted from the render entry point, with the file name. |
| fence › 274 / 321 / 367 merged into 265 (proposed) | Distinct assertions; merging trades focused failures for three fewer in-process renders. |
| fence-build › fixed fence merged into fixed include (proposed) | These are the per-emitter build smokes the trim target asks to keep apart. |
| view › defaults: Feature `#`, sections `##`, … | View-level unit test, kept by mandate. |
