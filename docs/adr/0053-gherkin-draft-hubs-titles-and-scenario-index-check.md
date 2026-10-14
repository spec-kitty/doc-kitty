---
title: "ADR-0053: Draft hubs, hub titles, a near-miss status warning and a scenario-index check for Gherkin pages"
description: Draft-only Gherkin directories get a draft hub, gherkin.titles sets hub titles, a mis-cased @wip warns, and a missing scenario index fails the build.
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

# ADR-0053: Draft hubs, hub titles, a near-miss status warning and a scenario-index check for Gherkin pages

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
  page that does not exist". Decision 4 below makes that a build error.

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
  generated page exists, but the site mounts that route itself. A site that
  skipped the route sent agents to a 404, and the build passed.

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

### 4. A build that advertises a missing scenario index fails (#126)

In `astro:build:done`, the `doc-kitty:gherkin` integration reads the built
`llms.txt`. If the file advertises the scenario index and the output has no
`api/scenarios.json`, the build stops. The message names the route file to
add.

The route stays site-mounted, as every doc-kitty route is. This follows the
glossary precedent ([ADR-0026](./0026-glossary-source-and-generation-seam.md)).

## Consequences

### Positive

- A mis-cased draft tag is reported at build time instead of publishing
  silently.
- With drafts published, a draft-only directory has an index, and the sidebar
  warning the author could not act on is gone.
- Acronyms and product names can title a hub and its sidebar group.
- An agent is never sent from `llms.txt` to a scenario index that does not
  exist.

### Negative

- Every draft-only directory adds one committed generated file. The files are
  identical in both draft modes, so the cost is a file in git, not drift.
- A site that turned on `gherkin.sources` without mounting the scenario index
  used to build. Its build now fails, which is a breaking change for that site.
  The fix is the route snippet from the consumer setup guide.

### Residual

- A site that removed the `gherkin` option but kept its generated pages has no
  `doc-kitty:gherkin` integration. Its `llms.txt` can still advertise the index
  unchecked.

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
- **#126: inject the route from the integration.** Rejected. It would be the
  toolkit's first injected route, and it would need a packed-tarball proof.
- **#126: check only in `assert-build-artifacts.mjs`.** Rejected. That script
  runs only on the example site, so consumer sites would never see the error.
