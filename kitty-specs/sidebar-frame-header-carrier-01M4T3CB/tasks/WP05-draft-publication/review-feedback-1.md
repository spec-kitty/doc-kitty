# WP05 review, cycle 1 — changes requested

Reviewer: reviewer-renata (claude). Reviewed commits `f0af3a3`, `01fa434` in lane-e.

The feature itself behaves correctly. Three things must change before approval;
the first is a deterministic red PR gate.

## What was verified and holds

- Builds: `on` 71 pages / 9 draft routes; `off`, unset and empty-string 61 pages / 0 draft
  routes. An `off` build contains no mention of any draft route in any file (HTML, sitemap,
  RSS, `llms.txt`, `api/`, Pagefind).
- No cache leak or loss: on -> off -> on -> default without `pnpm clean` gives outputs
  byte-identical to clean builds. Repeated with the example redirects made unconditional
  (so the Astro config digest does not change between modes): still correct.
- `on`: all 9 drafts carry `noindex`, none has `data-pagefind-body`, Pagefind has 56
  fragments in both modes, sitemap/RSS/`llms.txt`/`api/index.json` list none.
- `maybe` stops `astro build` and `astro dev` with the documented message.
- Dev server: `.env.development` gives `on (env file)`; with `off`, a page edited
  draft -> active appears and active -> draft disappears without a restart.
- `pnpm test` 1201/1202 (only the known local-PlantUML T023), lint 0 errors, typecheck 0
  errors, validate green. Link gate clean on both outputs.
- Mutations killed: default flipped to on; invalid value accepted; loader policy bypassed;
  `noindex` removed; absent status treated as published; env-file precedence reversed;
  empty-group drop removed / made unconditional.

## Blocking

### 1. [HIGH] `.github/workflows/ci.yml` — "Assert build artifacts (drafts off)" checks the wrong directory

`run: pnpm assert:artifacts example/dist-nodrafts`. The root script is
`node src/scripts/assert-build-artifacts.mjs example/dist`, so pnpm appends the argument and
the script reads `process.argv[2]`, which is `example/dist` (the drafts-ON build).
Reproduced locally:

```
$ DK_PUBLISH_DRAFTS=off pnpm assert:artifacts example/dist-rev-off2
$ node src/scripts/assert-build-artifacts.mjs example/dist example/dist-rev-off2
```

Run with `DK_PUBLISH_DRAFTS=off` against the ON dist the gate fails with
"DK_PUBLISH_DRAFTS is off, but the draft page "adr/template" was built". So the PR gate
goes red on its first run, and the drafts-off artifact is never checked by this gate.

Fix: call the script directly, as the next step already does:
`node src/scripts/assert-build-artifacts.mjs example/dist-nodrafts`.
(Pointed at the right directory the gate passes on a drafts-off build; checked on a
client-render build because PlantUML is not available locally.)

### 2. [HIGH] `src/lib/schema.ts` post-load sweep — the cache-leak guard has no test

Removing the `for (const [id, entry] of [...store.entries()])` sweep leaves
`draft-publication-build.test.ts` at 18/18 green. The sweep is load-bearing: with it
removed and the Astro config identical across modes, `on` then `off` without a clean emits
all draft pages in the `off` build. The build test does not notice because the example's
mode-dependent `REDIRECTS` change the config digest, which makes Astro discard the content
store between its builds. An adopter with a mode-independent config relies on the sweep
alone.

Fix: add a test that fails without the sweep. Cheapest is a unit test that drives the
wrapped `load()` with a fake store pre-seeded with a draft entry (as an earlier `on` build
would leave it) and asserts it is gone under `off` and gains `pagefind: false` under `on`.

### 3. [MEDIUM] Redirect coverage is not asserted on the artifact that ships

`check-redirect-coverage.mjs` fails 2 of 9 on a drafts-off build
(`/plans/features/mission-alpha/`, `/plans/features/mission-beta/`: "no page and no
redirect") and CI skips it there. The example avoids dead stubs only because its own
`astro.config.mjs` drops those two redirects; nothing in the toolkit protects an adopter.
With the redirects left unconditional, a drafts-off build emits both stubs pointing at
pages that do not exist, with no warning.

Fix, both parts:
- Make the gate mode-aware and run it on `example/dist-nodrafts`: under `off`, a baselined
  URL whose terminus is a draft source page is reported as "unpublished, expected"; every
  other URL must resolve, and no redirect stub in the dist may target a missing page.
- In `draftPublicationIntegration`, when drafts are off, warn (or fail) for each configured
  redirect whose target is a draft route.

## Non-blocking

- [LOW] `ci.yml` "Assert no draft page is built or linked": the nine routes are hard-coded,
  so a tenth draft is not covered. Derive the list from `doc_status` in `example/docs`.
- [LOW] `example/astro.config.mjs`: mode is detected by `process.argv.includes('dev')`
  while the integration uses Astro's `command`. Two detections can disagree
  (`astro build --mode development`, a programmatic dev server). Note the limitation in the
  comment, or have the integration own the redirect filtering (finding 3).
- [LOW] With `on`, `api/pages/<slug>.json` exists for each draft (full Markdown,
  `doc_status: draft`) although `api/index.json` omits them. None exists with `off`. This
  predates WP05; state it in the contract or exclude it — an owner decision.
- [INFO] `example/docs/adr/README.md` now points readers to a template the live site does
  not publish. See the owner list in the review report.

## Anti-pattern checklist

1 Dead code PASS · 2 Synthetic fixture PASS · 3 Silent empty return PASS (`resolvesToDraft`
catch is documented) · 4 FR coverage PASS for FR-013..017; FR-018 is workflow-only and its
assertion step is broken (finding 1) · 5 Frozen surface PASS · 6 Locked decision PASS ·
7 Shared-file ownership PASS (out-of-map edits to `config.ts`, `route-shaping.ts`,
`vitest.workspace.ts`, `assert-markua-builds.mjs`, `example-adopter.test.ts`, the two
pinned-list tests, `.gitignore`, `adr/README.md` are minimal and justified; record
`route-shaping.ts` in the hand-off) · 8 Production fragility PASS (the throw is the
documented FR-017 fail-loud).
