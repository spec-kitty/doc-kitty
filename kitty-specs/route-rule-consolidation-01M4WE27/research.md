# Research: Route rule and index-name consolidation

Mission `route-rule-consolidation-01M4WE27`. Spikes run 2026-10-14 against
Astro 5.18.2, Starlight 0.32.6, Vite 6.4.3, Node 24.11.1. Probes lived in the
session scratchpad and are not part of the repository.

---

## S1 — How the docs loader learns the integration's index names (C-004, FR-007)

**Decision**: `defineDocKittyIntegrations` publishes the normalised index names
into `process.env.DK_INDEX_BASENAME` (a JSON array) when it is called, next to
the existing `DK_DOCS_ROOT` write (`src/lib/config.ts:1733`).
`docKittyDocsLoader` reads that value lazily, inside `resolveIds()` at load time
(`src/lib/schema.ts:324`), not when the loader is constructed.

- Loader given no `indexBasename`: uses the published value; if nothing is
  published, the documented default `['README']`.
- Loader given a value that equals the published one (after normalisation):
  accepted, unchanged behaviour.
- Loader given a value that differs from the published one: throws
  `[dk-loader]` naming both values (contract `contracts/index-basename-config.md`).

**Rationale**:

1. Ordering is guaranteed. In every Astro entry point the config file is
   evaluated (and its integration setup hooks run) before the content layer
   loads `content.config.ts`:
   `astro/dist/core/build/index.js:71-78` (`runHookConfigSetup`, `runHookConfigDone`)
   precede `:99-100` (`syncInternal`); `core/dev/container.js:23,39` precede `:61`;
   `core/sync/index.js:41,48` precede `:49`. `defineDocKittyIntegrations` runs
   even earlier, while the config module itself is evaluated.
2. A module-level registry is not safe. Astro loads `astro.config.*` through its
   own Vite server (`core/config/vite-load.js:36`, `ssrLoadModule`) and the
   content config through the main Vite server (`content/utils.js:388`). Each
   gets its own module instance of `config.ts`/`schema.ts`, so a variable set in
   one is not visible in the other. `process.env` is process-wide.
3. Precedent. The toolkit already uses this same-process seam twice:
   `DK_DOCS_ROOT` (`config.ts:98`, `routes/shared.ts:64,111`) and the resolved
   draft setting (`config.ts:1597-1600`). No new mechanism.
4. No import cycle: `schema.ts` keeps importing only `vocabulary-core.mjs`,
   `docs-walk.mjs` and `draft-publication.mjs`; it never imports `config.ts`.

**Alternatives considered**:

- *Module-level registry set at `astro:config:setup`*: rejected, separate Vite
  module instances (point 2). Would work in unit tests and fail in real builds.
- *Virtual module (`virtual:doc-kitty/index-names`)*: the loader runs in the
  content layer's Node context and is constructed when `content.config.ts` is
  evaluated; reading a virtual module there needs the Vite plugin to be in that
  server. Works in principle but adds a plugin for one array. Rejected as heavier
  than the env seam.
- *A `dockitty.config.*` file read by both*: contradicts operator decision 3
  (index names live in `defineDocKittyIntegrations`) and adds a third file.

**Risk**: `process.env` leaks between vitest test files in one worker. The
suite runs with `fileParallelism: false`; tests that call
`defineDocKittyIntegrations` must restore `DK_INDEX_BASENAME` (the same
`afterEach` pattern existing tests use for `DK_DOCS_ROOT`; verify during
implementation).

---

## S2 — How `dockitty-check-links` reads the configured index names (FR-007, FR-008)

**Decision**: for each strict root, `check-links` looks for `astro.config.mjs|ts|js`
in the root's parent folder (the lookup it already does,
`src/scripts/check-links.mjs:106,413`). When it finds one, it evaluates it with
Vite's public `runnerImport` (Vite >= 6.1), resolving `vite` from the site's
installed `astro` package (`createRequire` at the site root), and then reads
`process.env.DK_INDEX_BASENAME`, which `defineDocKittyIntegrations` set during
evaluation (S1). No Astro hook runs; only the config module is evaluated.

Sources, in order, and the line printed once per strict root:

| Case | Names used | Printed source |
|------|-----------|----------------|
| Config found, calls `defineDocKittyIntegrations` | published value | `index names: README,index (from example/astro.config.mjs)` |
| Config found, no DocKitty integration (env unset after import) | default `README` | `index names: README (default; example/astro.config.mjs does not call defineDocKittyIntegrations)` |
| No config found | default `README` | `index names: README (default; no astro.config.* next to <root>)` |
| `--index-basename` given, agrees with config | flag | same as config line |
| `--index-basename` given, disagrees with config | — | exit 2, both values printed (contract `check-links-index-names.md`) |
| `--index-basename` given, no config | flag | `index names: index (from --index-basename)` |

`DEFAULT_CHECK_INDEX_BASENAMES = ['README', 'index']` (`check-links.mjs:88`) is
removed; the check's default becomes the loader's default, `['README']`. That
is a behaviour change for non-strict roots too only in so far as
`indexBasenames` is used there (folder-link status hints); see IC-01 risks.

**Evidence** (probe in `example/`):

- Plain `node` import of `astro.config.mjs` fails: `ERR_MODULE_NOT_FOUND
  .../src/lib/metadata.js imported from .../src/lib/config.ts`. The toolkit ships
  TypeScript sources with `.js` specifiers (`src/package.json` exports
  `./config: ./lib/config.ts`), so a bundler/runner is required.
- Vite `runnerImport(example/astro.config.mjs)`: loads in ~850 ms, sets
  `DK_DOCS_ROOT` as expected, returns the config object.
- Astro's `resolveConfig` (`astro/dist/core/config/index.js`): ~810 ms, same
  result, but `dist/*` is not in Astro's `exports` map, so it is a private path.

**Rationale**: it keeps operator decision 3 literal (one place), works before
any build has run (FR-005 "find them before building"), costs under a second
per site, and adds no dependency: `vite` is resolved through the `astro` peer
dependency the site already has (DIRECTIVE_051).

**Alternatives considered**:

- *Astro internal `resolveConfig`*: same cost, but imports a path outside
  Astro's public exports. Kept as the documented fallback if `runnerImport` is
  unavailable.
- *A file the integration writes at build (`.astro/dockitty.json`)*: missing on
  a fresh clone and stale after a config edit until the next build; the check
  would silently use the wrong names. Rejected.
- *Static text parse of the config*: breaks on any computed value (the example
  sets `indexBasename` literally today, but adopters need not). Rejected.
- *Separate shared config file*: contradicts operator decision 3.

**Risks**: evaluating a user's config runs their top-level code (env reads, file
reads). The example config reads `process.env` and a JSON file; acceptable, and
it is what `astro check`/`astro build` do. A config that throws makes
check-links exit 2 with the config error, prefixed with the config path.
`runnerImport` with `configFile: false` was used in the probe; confirm it does
not pick up the site's `vite` options in a way that matters (unverified for
configs with custom Vite aliases).

---

## S3 — Route-keyed collision grouping (FR-004, FR-005, FR-006, US2 sc5)

**Decision**: replace the name-keyed grouping in `groupIndexCollisions`
(`src/lib/vocabulary-core.mjs:859-886`) with grouping by produced route.
Compute `routeOfSlug(id)` for every walked path (drafts included), key by the
route folded to lower case, and report every group with more than one path as a
`RouteCollision { route, paths[] }`. No winner, no demotion: any collision is
fatal in the integration's `astro:config:setup`, in the loader, and in
`check-links --strict`.

Gherkin: `generate.mjs` additionally rejects a feature whose output leaf slug is
`index` on any setting (today it only rejects leaves that are in the configured
index names, `generate.mjs:245`), because `routeOfSlug` serves `x/index` at `/x/`.

**Evidence** (probe over `buildRouteTable`, current code):

| Fixture | Routes today | Name-keyed collisions today |
|---------|--------------|------------------------------|
| `x/README.md` + `x/index.md`, names `README` | both `/x/` | 0 (#135) |
| same, names `README,index` | both `/x/` | 1 (resolved, loser demoted but still `/x/`) |
| `README.md` + `index.md` at root, `README` | both `/` | 0 |
| `x/index.md` + `x/index.mdx`, `README` | both `/x/` | 0 |
| `x/README.mdx` + `x/index.md`, `README` | both `/x/` | 0 |
| draft `x/README.md` + `x/index.md`, `README,index` | `x/index.md` -> `/x/` | 1 |

Every row has two files on one route; grouping by route reports all of them
with one rule. A demoted index still lands on the folder route, so the old
winner/demote model never actually prevented the shared route.

**Drafts**: `buildRouteTable` already resolves ids over all paths before it drops
`unpublishedPaths` (`vocabulary-core.mjs:977-987`). The collision pass runs on
that full set, so the report is the same with drafts on or off (US2 sc5).

**Case sensitivity**: index-name matching stays case-insensitive (current
behaviour, `indexBasenamePattern` uses the `i` flag): `readme.md` is an index.
Route comparison for collisions is case-insensitive too: `x/Guide.md` and
`x/guide.md` produce `/x/Guide/` and `/x/guide/`, whose output folders clash on
macOS and Windows file systems. The message prints the routes as produced. This
widens the check beyond index files; S4 found no such pair in either tree.
Recorded in ADR-0050.

**Two extensions**: `x/a.md` + `x/a.mdx` (index or not) produce one id and one
route; reported as a collision. Today Astro's glob loader only warns
`Duplicate id ... Later items with the same id will overwrite earlier ones`
(`astro/dist/content/loaders/glob.js:108`).

**Alternatives considered**: keep name grouping and add a second "same route"
pass: two rules for one question, which is what C-001 forbids. Rejected.

---

## S4 — Existing collisions in the example site and this repository's docs

**Decision**: no fixes needed; add the audited trees as a regression check by
building them in CI as today (collisions will now fail those builds).

**Evidence** (probe: `walkMarkdownPaths` + `buildRouteTable`, routes grouped
case-insensitively):

| Tree | Index names | Paths | Route collisions | `_meta` markdown |
|------|-------------|-------|------------------|------------------|
| `example/docs` (incl. `plans/`) | `README,index` (real setting) | 72 | 0 | none |
| `example/docs` | `README` | 72 | 0 | none |
| `example/docs` | `index` | 72 | 0 | none |
| `docs/` | `README` | 145 | 0 | none |
| `docs/` | `README,index` | 145 | 0 | none |

`example/features/` holds no `index.feature` or `README.feature`.
`example/docs/plans/index.md` is the only `index.md`-indexed folder and has no
sibling `README.md`.
