---
title: "ADR-0054: Draft hubs, hub titles, a near-miss status warning and a scenario route for Gherkin pages"
description: Draft-only Gherkin directories get a draft hub, gherkin.titles sets hub titles, a mis-cased @wip warns, and the integration injects the scenario index route.
doc_status: active
updated: 2026-10-14
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0046-gherkin-feature-pages
  - adr/0051-gherkin-in-any-page
  - adr/0026-glossary-source-and-generation-seam
  - adr/0048-generated-page-names-and-empty-sources
  - architecture/gherkin-pages
  - guides/consumer-setup
  - guides/authoring
---

# ADR-0054: Draft hubs, hub titles, a near-miss status warning and a scenario route for Gherkin pages

## Status

**Accepted** on 2026-10-14. It was introduced by the gherkin-trim-and-fixes
mission and settles issues #123, #124, #125 and #126.

It amends three statements in
[ADR-0046](./0046-gherkin-feature-pages.md) and leaves that ADR as written:

- **Decision 3:** "one hub per directory with a non-draft feature". Decision 2
  below replaces it.
- **The "Known limit" risk:** "a directory holding only draft features gets no
  hub". It is removed by the same decision.
- **Decision 9:** a site that does not mount the scenario index "advertises a
  page that does not exist". Decision 4 below has the integration mount the route itself.

The rest of ADR-0046 and [ADR-0051](./0051-gherkin-in-any-page.md) stands.

## Context

The generated feature pages (ADR-0046) shipped with four gaps that were left
for separate work when PR #121 landed:

- **#123.** `parseMetadataTags` matches the status shorthands exactly. A
  feature tagged `@WIP` published as an active page, and nothing said so.
- **#124.** A directory got a hub only when a non-draft feature sat below it.
  That rule dates from when drafts were never built. Drafts are now built by
  default (`DK_PUBLISH_DRAFTS` on), so the sidebar listed such a directory's
  draft pages and warned that it had no index page. The author could not add
  one, because an authored file in the generated section stops the build.
- **#125.** A hub's title came only from its directory name. `hr` read "Hr",
  and the sidebar group followed it.
- **#126.** `llms.txt` advertises `/api/scenarios.json` whenever a published
  generated page exists, but the site had to mount that route itself. A site
  that skipped the route sent agents to a 404, and the build passed.

The generated pages are committed and drift-checked by
`generate-feature-pages.mjs --check`. The planner is a pure function of the
sources and the docs tree, which is risk R3 of ADR-0046: it reads no clock, no
locale and no environment.

## Decision

### 1. Status shorthands match exactly; a near miss warns (#123)

`@wip` and `@deprecated` still match only when the case is exact. A feature tag
that differs from one of them only in letter case (`@WIP`, `@Wip`,
`@Deprecated`) stays an ordinary page tag, and raises one warning:

> `tag @WIP is not the @wip status shorthand (tags are case-sensitive); did you mean @wip? It stays an ordinary tag`

Cucumber tag expressions are case-sensitive. A runner filtering `not @wip` still
runs a `@WIP` scenario, so treating `@WIP` as a draft would make the docs and the
test run disagree about what is in progress. The warning catches the author's
mistake without that split.

### 2. Every directory with a feature gets a hub; a draft-only one gets a draft hub (#124)

The planner writes a hub for the section root and for every directory that
holds a feature anywhere below it. A directory with no published feature below
it gets a hub with `doc_status: draft`, the one-line intro and no list. No
published hub links a draft hub.

The section root is always published. Hubs still list only published children,
so whether a draft hub should list its draft pages stays an open question.

Draft gating already builds a draft page exactly when drafts are published, and
it applies to the draft hub as well. With drafts on, the hub is built
(`noindex`) next to its pages and the sidebar finds an index. With drafts off,
neither the hub nor its pages are built.

The planner still does not read `DK_PUBLISH_DRAFTS`. The hub is generated in
both modes, so the committed tree is the same for every build, and `--check`
agrees with every build by construction.

### 3. `gherkin.titles` sets hub titles (#125)

`gherkin.titles` is an optional map from a source-relative directory, as written
on disk, to the title of that directory's hub. For example:

```js
gherkin: { sources: ['features'], titles: { hr: 'HR', 'shipping/edi': 'EDI messages' } }
```

- **Where the title appears.** It replaces the humanised directory name in the
  hub's title, heading and description, and in its parent's list line. The
  sidebar group follows the hub title.
- **Validation.** `options.mjs` checks the map once, for the integration and the
  CLI. It must be a plain object. Each key must be a clean relative directory
  path: no empty, `.` or `..` segment, and no leading `/`, drive letter, URL
  scheme or `\`. Each title must be a non-blank string. Like `section` and
  `allowEmpty`, `titles` is only accepted together with `sources`.
- **Unknown keys.** A key that names no directory holding a feature warns.
- **The CLI.** The command-line twin is a repeatable `--titles <dir>=<title>`,
  split on the first `=`, so a title may hold commas, spaces and `=`.

### 4. The integration injects the scenario index route (#126)

When generated pages are on (`gherkin.sources` is set), `doc-kitty:gherkin`
calls `injectRoute` in `astro:config:setup` for `/api/scenarios.json`. The
entrypoint is a toolkit module (`@spec-kitty/doc-toolkit/routes/scenario-index-injected`)
that wraps `scenarioIndexRoute()`. It takes `sourceRoot` and `sourceUrlPrefix`
from the integration's own options through a virtual module, so the route
resolves sources as the generator did and the site passes nothing twice. Astro
applies the site `base` to an injected pattern, so no page address is built here
(ADR-0050 is untouched). `llms.txt` advertises the route only when a published
generated page exists, and the route now always exists when sources are on.

**An existing hand-mounted route is kept.** Astro rejects two routes for one
address. The integration therefore looks for `api/scenarios.json.{ts,js,mts,mjs,cts,cjs}`
under the site's `srcDir/pages` and, if it finds one, does not inject. Sites that
followed the earlier setup guide keep working unchanged, and a hand-mounted route
can still pass its own options. The example site no longer mounts the route, so
its build exercises the injected path.

The operator chose injection over failing the build. The maintainer's comment
on PR #121 leaned the same way. This reverses the PR's first approach, a
build-end check that named the route file to add, which is removed.

## Consequences

### Positive

- A mis-cased draft tag is reported at build time instead of publishing
  silently.
- With drafts published, a draft-only directory has an index, and the sidebar
  warning the author could not act on is gone.
- Acronyms and product names can title a hub and its sidebar group.
- An agent is never sent from `llms.txt` to a scenario index that does not
  exist, and an adopter adds no route file.

### Negative

- Every draft-only directory adds one committed generated file. The files are
  identical in both draft modes, so the cost is a file in git, not drift.
- The toolkit's first injected route, and one more package export
  (`./routes/scenario-index-injected`). Injection is skipped only when the
  site has `src/pages/api/scenarios.json.<ext>` or
  `src/pages/api/scenarios.json/index.<ext>`, with `<ext>` one of `ts`, `js`,
  `mts`, `mjs`, `cts`, `cjs`, `tsx` or `jsx`. A hand-mounted dynamic route (for
  example `api/[x].json.ts`) does not match, so the injected static route
  shadows it for that address (Astro ranks the static route higher) rather than
  raising a duplicate-route error. `.astro` and `.md` pages cannot serve JSON,
  so they are not a concern.

### Residual

- A site that removed the `gherkin` option but kept its frozen generated pages
  has no `doc-kitty:gherkin` integration. It gets no injected route, and its
  `llms.txt` can still advertise the index. It must mount `scenarioIndexRoute()`
  itself.

## Alternatives considered

- **#123: match case-insensitively.** Rejected. The docs would call a scenario a
  draft that the runner still runs.
- **#123: fail closed to draft, like a mis-cased `@dk:Status` key.** Rejected.
  That rule covers the toolkit's own namespace, where a mis-cased key is never a
  deliberate Cucumber tag. Here, `@Deprecated` turning a page into a draft would
  surprise the author.
- **#124: write the hub only when drafts are published.** Rejected. A drafts-off
  build would delete a committed file, and the drift gate would disagree with
  half the builds.
- **#124: have the sidebar warning skip generated sections.** Rejected. It hides
  the symptom and leaves the directory with no index.
- **#125: a `_title` file in the source directory.** Rejected. The loader would
  have to understand a file that is not a `.feature`.
- **#125: a JSON value for `--titles`.** Rejected. It needs shell quoting inside
  `package.json` scripts.
- **#126: fail the build when `llms.txt` advertises a missing route.** Rejected
  by the operator in favour of injection. It would have turned a setup step the
  toolkit can do itself into a build error for every adopter.
- **#126: check only in `assert-build-artifacts.mjs`.** Rejected. That script
  runs only on the example site, so consumer sites would never see the error.
