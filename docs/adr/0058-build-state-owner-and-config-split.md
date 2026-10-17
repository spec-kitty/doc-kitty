---
title: "ADR-0058: One owner for build state, a split config, and the env reader"
description: DocKitty keeps what draft publication decides in one per-config object, splits config.ts into six integration modules, reads Vite's envDir and --mode, and adds _links to the agent API.
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

### 2. The config splits into six integrations

`config.ts` goes from 2,298 to 936 lines. The `./config` package export is
unchanged: the export list matches the list taken before the split.

| Module (`src/lib/integrations/`) | Owns |
| --- | --- |
| `diagrams.ts` | The Mermaid fence transform, the diagram mode and the build-time Mermaid and PlantUML rendering |
| `gherkin.ts` | The Gherkin option handling, fence and scenario-index wiring |
| `glossary.ts` | The glossary integration |
| `markua.ts` | The Markua integration |
| `route-shaping.ts` | Sidebar and route shaping, and the virtual module |
| `draft-publication.ts` | The draft setting, the withheld lists and the build summary |
| `shared.ts` | Helpers two or more of the above use. A leaf: it imports nothing from `config.ts` |

No integration module imports `../config`, so there is no import cycle. The
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
- **Gates.** `dockitty-check-links` and `dockitty-check-redirect-coverage
  --docs` follow the `envDir` of the evaluated config.
  `dockitty-assert-build-artifacts` and `dockitty-check-redirect-coverage`
  without `--docs` do not evaluate the config. They fail by name when the
  config text mentions `envDir`, unless you pass `--env-dir <dir|false>`. A
  comment that mentions `envDir` also triggers the failure. That is deliberate:
  the gate fails closed and names the fix.

Two limits remain. A bare `--mode` at the end of the command line falls back to
the default mode. Vite's deprecated `envFile: false` is not honoured.

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

- A gate that does not evaluate the config can fail on a comment that mentions
  `envDir`. The failure names `--env-dir`, so the fix is one flag.
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
