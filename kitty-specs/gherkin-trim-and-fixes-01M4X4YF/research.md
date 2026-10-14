# Research: Gherkin test trim and fixes

Detailed code survey: [research/code-grounding.md](./research/code-grounding.md).

## R1 — #123: case-insensitive match or near-miss warning

- **Decision**: keep exact, case-sensitive matching of `@wip` and `@deprecated`;
  a tag equal to one of them ignoring case (and not equal exactly) raises one
  warning: `tag @WIP is not the @wip status shorthand (tags are case-sensitive);
  did you mean @wip? It stays an ordinary tag`. The tag stays a page tag.
- **Rationale**: Cucumber tag expressions are case-sensitive. A runner filtering
  `not @wip` still runs a `@WIP` scenario, so treating `@WIP` as a draft in the
  docs would make the docs and the test run disagree about what is in progress.
  The warning catches the author's mistake without that split.
- **Alternatives considered**: case-insensitive match (silently diverges from the
  runner); fail closed to draft like a mis-cased `@dk:Status` key (that rule is
  for the toolkit's own namespace, where a mis-cased key is never a valid
  Cucumber-level choice; `@Deprecated` failing closed to draft would also be
  surprising).

## R2 — #124: where the draft setting enters

- **Decision**: the planner always plans a hub for every directory holding a
  feature. A directory with no published feature below it gets a hub with
  `doc_status: draft`, an intro and no listing, and no published hub links it.
  The planner never reads `DK_PUBLISH_DRAFTS`.
- **Rationale**: the generated tree is committed and drift-checked; the planner
  is pinned as a pure function of sources and docs tree (risk R3). The existing
  draft gating (loader, sidebar, sitemap, agent API, hubs) already builds a
  draft page exactly when drafts are published, so a draft hub follows its pages
  in both modes. The drift gate and every build agree by construction, which is
  stronger than resolving the setting the same way in two places.
- **Alternatives considered**: plan the hub only when drafts are published (a
  drafts-off build would delete a committed hub and `--check` would disagree
  with half the builds); option 2, skip the sidebar warning for generated
  sections (hides the symptom, leaves no index page).

## R3 — #125: key form and CLI shape

- **Decision**: keys are directory paths relative to a source root, as written
  on disk (`hr`, `shipping/edi`), POSIX separators, no `.`/`..`/empty segments,
  no leading `/`. Values are non-blank strings. `titles` is refused without
  `sources`, like `section` and `allowEmpty`. A key that names no directory
  holding a feature warns once. The CLI takes `--titles <dir>=<title>`, repeated
  per entry (split on the first `=`), so titles may contain commas and spaces.
- **Rationale**: matches the issue's proposal and the existing rule that every
  pages key has a CLI flag of the kebab-cased name (`gherkin-example.test.ts`).
- **Alternatives considered**: JSON flag value (`--titles '{"hr":"HR"}'`: needs
  shell quoting inside `package.json` scripts and breaks the parity test's
  whitespace split); a `_title` file in the source directory (a non-`.feature`
  file the loader must learn).

## R4 — #126: where the check runs

- **Decision**: a pure `checkScenarioIndexAdvertised(outDir)` reads
  `<outDir>/llms.txt`; if it has a `Scenario index: ` line and
  `<outDir>/api/scenarios.json` does not exist, it throws a `[dk-gherkin]` error
  naming the route file to add. `doc-kitty:gherkin` calls it in
  `astro:build:done`.
- **Rationale**: the example already asserts both files in
  `assert-build-artifacts.mjs`; the gap is consumer sites, which never run that
  script. A build-end hook covers every site with generated pages, keeps the
  route site-mounted (glossary precedent, C-001), and needs no new integration
  (the integration-name lists pinned in four tests stay as they are).
- **Alternatives considered**: inject the route (option 1; needs a tarball
  proof; ruled out by the brief); only extend `assert-build-artifacts.mjs`
  (example-only).
- **Residual**: a site that removed the `gherkin` option but keeps frozen pages
  has no `doc-kitty:gherkin` integration and is not checked.

## R5 — #128: parity test or read the example

- **Decision**: a parity test asserts the render and generate fixture copies are
  byte-identical to `example/features/shipping/book-consignment.feature`, and
  `gherkin-feature-core.test.ts` reads the render fixture instead of inlining a
  fourth copy guarded only by its own hash.
- **Rationale**: smallest change; unit fixtures stay independent of the example
  site; a drift fails one test that names the copy. Reading the example directly
  would couple three unit suites to the example tree.

## R6 — #156: method

- Inventory every `it` in the 17 suites with layer, behaviour and proposed
  verdict; retire only where a named surviving test asserts the same behaviour
  at its owning layer; prove it with a planted break (one-line source mutation)
  that turns the covering test red, recorded in
  `research/test-verdicts.md`. Mutations are reverted before commit.
