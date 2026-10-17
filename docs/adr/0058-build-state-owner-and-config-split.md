---
title: "ADR-0058: One owner for build state, a split config, and the env reader"
description: One owner for draft-publication build state, config.ts split into integration modules, envDir and --mode for env files, and _links in the agent API.
doc_status: active
updated: 2026-10-17
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0057-internal-env-handoff-seam
  - guides/draft-publication
  - guides/consumer-setup
---

# ADR-0058: One owner for build state, a split config, and the env reader

## Status

Accepted. Closes [#115](https://github.com/spec-kitty/doc-kitty/issues/115) and
[#103](https://github.com/spec-kitty/doc-kitty/issues/103).
It builds on [ADR-0057](./0057-internal-env-handoff-seam.md), which owns the
five values DocKitty passes through `process.env`. This ADR covers what stays
out of `process.env`: the drafts a build withholds.

## Amended 2026-10 (#172, #173)

The three build gates now evaluate the site config instead of searching its
text for `envDir`, and `assert-build-artifacts` takes `--index-path`. Sections 3
and 5 and the Risks list describe the result.

## Context

Four things had grown together in `src/lib/config.ts` (2,298 lines):

- The draft-publication integration decided which drafts a build withholds, and
  route shaping needed the same lists. They travelled through module-level
  variables, so a second config in one process read the first config's lists.
- Six integrations lived in one file, which made each hard to read and to change
  on its own.
- The env-file reader looked only in the site directory and ignored `--mode`.
  Vite lets a site move its env files with `envDir` and pick a mode, so a site
  using either got a different draft setting from the one it expected.
- The agent API had no links between records, although the roadmap listed a
  `_links` read API as done.

## Decision

### 1. One build state per config

`defineDocKittyIntegrations` calls `createBuildState()` once
(`src/lib/build-state.ts`) and hands the object to the integrations that need
it. The draft-publication integration writes the withheld directories and files
in its `astro:config:setup` hook. The route-shaping integration reads them when
Vite loads `virtual:doc-kitty/route-shaping`. A second config gets its own
object, so it cannot see the first one's.

The route-shaping *warnings* are the exception, and they stay on one
`globalThis` channel (`Symbol.for('doc-kitty.route-shaping.warnings')`) owned by
`build-state.ts`. The route middleware runs in Astro's prerender bundle, which
is a second module instance of the same file in the same process. Module state
cannot carry a warning from the middleware to the `astro:build:done` hook that
prints it. The channel belongs to the process, and the route-shaping
integration clears it at the start of each build.

`RouteShapingOptions` lost `unpublishedDirs` and `unpublishedPaths`, because the
state object now carries them. The type is `@internal`, as the changelog already
says of the internal seams, so this is not a breaking change.

### 2. The config splits into eight integrations

`config.ts` goes from 2,298 to 739 lines. The `./config` package export is
unchanged: the export list matches the list taken before the split.

| Module (`src/lib/integrations/`) | Owns |
| --- | --- |
| `diagrams.ts` | The Mermaid fence transform, the diagram mode and the build-time Mermaid and PlantUML rendering |
| `gherkin.ts` | The Gherkin option handling, fence and scenario-index wiring |
| `glossary.ts` | The glossary integration |
| `markua.ts` | The Markua integration |
| `route-shaping.ts` | Sidebar and route shaping, and the virtual module |
| `draft-publication.ts` | The draft setting, the withheld lists and the build summary |
| `markdown-pipeline.ts` | The always-on remark and rehype stages: deck split, relative-link and base-absolute-link rewriting, and the single `remark-directive` owner |
| `toc-rail.ts` | The collapsible table-of-contents rail's client script |
| `shared.ts` | Helpers two or more of the above use. A leaf: it imports nothing from `config.ts` |

The last integrations to leave `config.ts` went into two modules, because they
share a seam or a purpose. `markdown-pipeline.ts` holds the always-on stages
that all register through `markdown.remarkPlugins` and `rehypePlugins` with
`updateConfig`, so one file shows their order against each other. `toc-rail.ts`
holds the table-of-contents rail's client script, which has no option and no
shared state. Moving them left `config.ts` with the option types, the preset and
the registration list, and no integration code. No integration module imports `../config`, so there is no import cycle. The
registration order of the integrations is pinned by one literal list,
`src/tests/helpers/integration-names.ts`. It is a literal on purpose: the tests
use it as the expected value of an order assertion, so deriving it from
`defineDocKittyIntegrations` would make the assertion compare the code with
itself.

### 3. The env reader follows Vite's `envDir` and `--mode`

- **Mode.** `activeMode` reads `--mode x` or `--mode=x` from the command line.
  Without one, the mode is `development` for `astro dev` and `production` for
  every other command. The mode `local` is an error, as in Vite, because
  `.env.local` is a file of its own.
- **Directory.** `resolveEnvSource` resolves a relative `vite.envDir` against
  the site root. `envDir: false` means no env files are read. Without `envDir`,
  the site root is used.
- **Precedence and syntax are unchanged.** The process environment still wins
  over a file, only `DK_` keys are read, and quoting works as before.
- **Gates.** `dockitty-check-links`, `dockitty-assert-build-artifacts` and
  `dockitty-check-redirect-coverage` (with and without `--docs`) evaluate
  `astro.config.*` in a child process and follow the `envDir` it sets. One
  lookup finds the config. It knows six names, in Astro's order: `.mjs`, `.js`,
  `.ts`, `.mts`, `.cjs`, `.cts`. A gate exits 2 when the config will not
  evaluate or takes longer than 30 seconds, and when the config that decides
  the site root is not the one it evaluated (a config above a nested docs tree,
  say). `--astro-config <file>` picks the config. `--env-dir <dir|false>`
  decides the env files and skips evaluation. An `envDir` set in an imported
  base config is honoured, because the gate evaluates the whole module graph.

- **A `--mode` with no value stops the build.** A bare `--mode`, or one followed
  by another flag, fails with `[dk-drafts] --mode needs a value`. The command-line
  parsers of Vite (cac) and Astro (yargs-parser) read it as `true`, which is no
  mode, so the build would otherwise fall back to the default mode unnoticed.
- **Vite's deprecated `envFile: false` still means no env files.** Vite 6 turns
  it into `envDir: false`, so the integration and the gates do the same.

Two limits remain. The gates read `vite.envDir` from the exported config
(`module.default.vite.envDir`), and they evaluate it without a build mode.

- A config that sets `envDir` only through an integration's `updateConfig` hook
  is not seen by them, and they read the site root instead. Set `envDir` in the
  config object itself, or pass `--env-dir`.
- A config that sets `envDir` differently per build mode is evaluated once, with
  no mode. The gates see the value for that evaluation, not the one your build
  uses. Pass `--env-dir` for the mode you build.

### 4. Two behaviours stay as they were

- **Redirect withholding stays static-only.** A redirect that ends at a draft is
  removed by deleting its stub file from the build output. DocKitty builds
  static sites, so there is always a stub. Under an adapter that emits
  host-level redirects there is none, and the redirect is not withheld. The
  [draft publication guide](../guides/draft-publication.md#known-limits) says
  so.
- **The draft-only empty-group drop stays.** A sidebar group whose pages are all
  withheld drafts is dropped, so a published site does not show an empty
  folder. The reason is recorded in `route-shaping.ts`.

### 5. The agent API gains `_links`

The relation names follow the web-linking convention: `self`, `up`, `html`,
`related`.

| Where | Relations |
| --- | --- |
| `api/index.json` (top level) | `self`, `llms`, `sitemap`, and, when declared, `rss`, `bibliography`, `scenarios` |
| Each record in `pages` | `html`, `related` (a list of `{ href, title }` for the resolved entries), and `self` (the per-page JSON, only when `links.pages` is on) |
| `api/pages/<slug>.json` | `self`, `up` (the index), `html`, `related` |

- **No top-level `pages` link.** There is no `/api/pages/` index to point at.
- **No `source` relation.** A record's `source` field already is the URL of the
  per-page JSON. A relation to the Markdown source waits until a separate URL
  for it exists.
- **The `links` option defaults to all `true`**, which matches the worked
  example. A site that does not mount a surface must pass `false` for it
  (`agentIndexRoute({ links: { rss: false } })`, `agentPageRoute({ links: { index:
  false } })`), or the link dangles. A route cannot see whether another route
  exists.
- **The index and page routes take an `indexPath`.** It defaults to
  `/api/index.json` and sets the index's own `self` link and each page's `up`
  link, both with the site base added. Pass it when you mount the index route
  somewhere else, or those links dangle. Then pass the same file to the build
  check as `--index-path <path relative to dist>` (see the next bullet).
- **A build check keeps the links honest.** `dockitty-assert-build-artifacts`
  reads every `_links` href in `dist/api/**/*.json`, removes the site origin and
  base, and fails when the file is missing from the build. A path that ends in
  `/` must have an `index.html`; any other path must be a file. It reads the base
  from the index's `self` link, which must end in the path of the file the gate
  reads. When it does not, the gate fails and names the link.
- **`--index-path` moves the index the gate reads.** The default is
  `api/index.json`. `assert-build-artifacts --index-path <path relative to
  dist>` moves every index check to that file. The path never includes the site
  base, because `dist` does not nest it. The gate derives the base from the
  index's `self` link. It scans the JSON files in the index's folder, and
  follows `_links` to other JSON files transitively, wherever they sit. A path
  with `..`, an absolute path or an empty value exits 2.
- **The index `version` stays `'2'`.** The new keys are additive, and a reader
  that ignores unknown keys is unaffected (DIRECTIVE_018). A change that removes
  or renames a key bumps the version.

## Consequences

### Positive

- A second config in one process starts with no withheld-draft leftovers.
- Each integration reads on its own, and `config.ts` is under the 1,000-line
  limit.
- A site that sets `envDir` or builds with `--mode` gets the draft setting it
  wrote down.
- Agents can follow links from the index to a page, from a page to its HTML and
  related pages, and from a page back to the index.

### Negative

- One `globalThis` channel remains, for the warnings. A new reader of
  `build-state.ts` has to learn why it is there.
- `links` defaults to `true`, so a site without a feed or a bibliography route
  has to opt out.

### Risks

- A gate evaluates the config, so a config that cannot load in a child process
  (a missing dependency, a top-level network call) stops it with exit 2. The
  message names the config and `--env-dir`, so the fix is one flag.
- Anyone who calls the `@internal` `routeShapingSource` with the removed options
  must pass a build state instead.

## Alternatives considered

### Keep module-level variables and reset them per config

Rejected: that repeats the stale-state problem one level down, and a reset is a
step someone forgets.

### Derive the pinned integration order in the tests

Rejected: the order assertion would then compare the code with itself.

### Add a `source` relation now

Rejected: the record's `source` field already holds the per-page JSON URL, so a
second relation would point at the same place under another name.

## References

- [#115](https://github.com/spec-kitty/doc-kitty/issues/115) and
  [#103](https://github.com/spec-kitty/doc-kitty/issues/103), the issues.
- [Draft publication](../guides/draft-publication.md), for the env and gate
  behaviour.
- [Consumer setup](../guides/consumer-setup.md), for the routes and their
  `links` option.
- [#172](https://github.com/spec-kitty/doc-kitty/issues/172) and
  [#173](https://github.com/spec-kitty/doc-kitty/issues/173), the amendment.
