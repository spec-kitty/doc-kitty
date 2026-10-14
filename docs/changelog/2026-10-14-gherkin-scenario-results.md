---
title: Gherkin scenario results
description: "Set gherkin.results to the Cucumber report your CI writes, and every scenario shown from a .feature file gets its last result next to it."
doc_status: active
updated: 2026-10-14
type: Changelog
kind: Changelog
authors:
  - ivan@spec-kitty.ai
tags: [gherkin, bdd, cucumber, living-documentation, qa]
related:
  - adr/0055-gherkin-scenario-results
  - architecture/gherkin-pages
  - architecture/research/gherkin-results
  - guides/authoring
  - guides/consumer-setup
---

# 2026-10-14 — Gherkin scenario results

Point `gherkin.results` at the Cucumber report your CI already writes, and every
scenario your site shows from a `.feature` file gets its last result next to it:
on generated feature pages and in `::gherkin` includes. Readers see which
behaviour works today without opening CI. This delivers slice D of
[#120](https://github.com/spec-kitty/doc-kitty/issues/120)
([#162](https://github.com/spec-kitty/doc-kitty/issues/162)). See
[ADR-0055](../adr/0055-gherkin-scenario-results.md), the
[architecture page](../architecture/gherkin-pages.md#scenario-results), the
[research](../architecture/research/gherkin-results.md) and
[Show test results](../guides/authoring.md#show-test-results).

```js
defineDocKittyIntegrations({
  // …
  gherkin: { sources: ['features'], results: 'reports/cucumber.ndjson' },
  // or: results: { report: 'reports/cucumber.json', root: 'vendor/app' }
});
```

## What ships

- **A result after each scenario heading.** Passed, Failed, Ambiguous, Undefined,
  Pending, Skipped or Not run, plus Passed on retry when a scenario passed after a
  failed attempt. The word is the signal; a symbol and a coloured bar repeat it.
  Headings, the "On this page" list and anchors do not change.
- **Outline rows.** An Examples table gains a `Result` column, and the outline's
  own result is its worst row with counts ("Failed (1 failed, 1 passed)").
- **A results line per feature.** "Results: 1 failed, 3 passed · as of 2026-10-14
  · commit 3f1c2a9", from the run's end and its commit when the report names them.
- **Both report formats.** Cucumber Messages (`--format message`, recommended) and
  Cucumber JSON (`--format json`) from cucumber-js, cucumber-jvm, godog or behave.
- **Never the wrong result.** Results are matched by file and line. A report made
  from another version of a file shows no results for it, says so on the page and
  warns in the build. An ambiguous report path warns instead of guessing.
- **Generated pages stay as committed.** Results are added when the page renders,
  so the `--check` drift gate never sees them.
- **Only statuses are published.** Failure messages, stack traces, attachments and
  environment details from the report never reach a page.
- **Fresh pages.** A new report re-renders the pages that show results, in a build
  and in the dev server.
- **Agents.** An include's agent Markdown carries the same results, and
  `scenarioIndexRoute({ results })` adds them to `/api/scenarios.json`.
- **A demonstrator.** The example site commits a real Cucumber report of its own
  features; its behaviour pages and
  [Scenarios in pages](https://spec-kitty.github.io/doc-kitty/guides/scenarios-in-pages/#results-from-the-test-run)
  show every kind of result.

## Upgrading

Nothing changes for a site that does not set `results`. To turn it on, have CI
write a report before the docs build (`cucumber-js --format
message:reports/cucumber.ndjson`), set `gherkin.results`, and pass the same value
to `scenarioIndexRoute({ results })` if you mount it.

## Limits

Fences show no results: they have no file. One report is read; merge reports from
several runs into one first. Any edit to a feature file hides its results until
the tests run again. A JSON report is checked by lines, names and step texts, so a
change to only a data table, a doc string or a tag is not detected; use Cucumber
Messages. Re-rendering on a
report change rests on Astro 5 loader internals, like included files (#119).
