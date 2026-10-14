---
title: Gherkin scenario results
description: "Show each scenario's last pass or fail result next to it, read at build time from the Cucumber report a site's CI produces (slice D of issue #120)."
doc_status: active
updated: 2026-10-14
type: Feature
kind: Feature
moscow:
  level: Could
  rationale: The results half of BDD living documentation. Built on the shipped Gherkin pages and includes, with no new dependency, but useful only to sites whose CI already writes a Cucumber report.
tags: [bdd, gherkin, cucumber, living-documentation, qa]
related:
  - adr/0055-gherkin-scenario-results
  - architecture/research/gherkin-results
  - architecture/gherkin-pages
  - plans/features/gherkin-feature-pages
  - plans/features/qa-portal
---

# Gherkin scenario results

A site that sets `gherkin.results` to the Cucumber report its CI writes gets a
result badge next to every scenario it shows from a `.feature` file: on generated
feature pages and in `::gherkin` includes. Outline rows get their own result in a
`Result` column, and a feature header gets a one-line summary with the run date
and commit. The report is read at build time; nothing is fetched and no test runs.

Scope: Extended. Slice D of [issue #120](https://github.com/spec-kitty/doc-kitty/issues/120),
tracked as [#162](https://github.com/spec-kitty/doc-kitty/issues/162).

Design: [ADR-0055](../../adr/0055-gherkin-scenario-results.md). Research:
[Gherkin scenario results (research)](../../architecture/research/gherkin-results.md).
Builds on: [Gherkin feature pages](./gherkin-feature-pages.md) and
[ADR-0051](../../adr/0051-gherkin-in-any-page.md). Builds toward:
[QA portal](./qa-portal.md).

## Reader and author jobs

1. A product owner reading a feature page sees which behaviour works today and
   which does not, without opening CI.
2. A guide author who includes a scenario shows its current status with it, and
   it updates when CI runs again.
3. A maintainer trusts that a badge belongs to the scenario it sits next to, even
   when the report is older than the page.
4. An agent reads the same statuses from `/api/scenarios.json`.

## What it does not do

- Run Cucumber, or any test runner.
- Fetch a report over the network. The site's CI puts the file on disk first.
- Publish failure messages, stack traces, attachments or environment details from
  the report. Only statuses, counts, the run date and the commit id reach a page.
- Badge a ```` ```gherkin ```` fence. A fence has no source file, so nothing in a
  report can be tied to it.
- Merge several reports, or show history across runs.

## Design in brief

| Question | Decision | Why |
|---|---|---|
| Input format | Cucumber Messages NDJSON first; legacy Cucumber JSON (cucumber-js, cucumber-jvm, godog, behave) as best effort. Detected from the first character. | Messages carries the file text, the AST, retries and a schema. JSON is what many pipelines already write. |
| Config | `gherkin.results: '<report>'` or `{ report, root? }`. `root` is the directory Cucumber ran in (default `.`). | One report, one place. `root` covers a site that checks another repository out into a subfolder. |
| Matching key | `(file, line)`, where the line is the scenario's line, or the example row's line for an outline row. | Runner ids are random UUIDs; lines are the one key both sides compute. |
| Stale report | Messages: the report's `source.data` must equal the file. JSON: every result's line, name and steps must match the file. Otherwise no badges for that file, a build warning, and a "results not shown" note. | A line key on an old report would put a result on the wrong scenario. Never show a wrong badge. |
| Status | Most severe step result (hooks included) of the final attempt, in Cucumber's order. Shown as Passed, Failed, Ambiguous, Undefined, Pending, Skipped or Not run; "Passed on retry" when an earlier attempt failed. | The rule `@cucumber/query` and the HTML report use. The words are Cucumber's own. |
| Outlines | A `Result` column per row, and on the outline heading the worst row status plus counts. | Each row is its own test. Counts stop a skipped row hiding behind a pass. |
| Committed pages | Badges are added at render time by the in-page stage. The generated Markdown never changes. | The `--check` drift gate must not depend on the last CI run. |
| Markup | A `p.dk-gherkin__result` after the heading; the status word is visible text; a tinted left bar and a glyph only reinforce it. | WCAG 1.4.1. A badge inside a heading would change its TOC entry and slug. |
| Freshness | The report's hash is folded into the digest of every page that shows Gherkin from a file, and a report change re-renders them in dev. | Same mechanism as ADR-0051 decision 11. |
| Missing report | Build warning; the site builds without badges. | A local build has no CI report. |
| Unreadable report | Build-fatal, with `report:line`. | A configured report that cannot be read is a pipeline bug. |
| Dependency | None. `@cucumber/messages` is already pinned. | `@cucumber/query` brings an unmaintained transitive dependency. |

## Work packages

| WP | What | Main files | Depends on |
|---|---|---|---|
| WP01 | Report reader: parse Messages (tolerating protocol 15–34) and JSON (four dialects) into per-file result entries; URI normalisation; final-attempt and severity rules; size cap; per-line errors. | `src/lib/gherkin/results.mjs` | — |
| WP02 | Matching and staleness: add `rowLines` to `ExamplesView`; `featureResults(report, file, view)` returns scenario, row and summary outcomes, or `stale`. | `view.mjs`, `results.mjs` | WP01 |
| WP03 | Config: `gherkin.results` in the option contract, types and JSDoc; publish the report path to the loader (`DK_GHERKIN_RESULTS`); warn when missing, fail when unreadable, in `astro:config:setup`. | `options.mjs`, `config.ts` | WP01 |
| WP04 | Emitters: result paragraph, `Result` column and feature summary in `mdast.mjs`, and the same in `render.mjs`'s embed layout for the agent Markdown. Badge CSS with tokens. | `mdast.mjs`, `render.mjs`, `dk-components.css` | WP02 |
| WP05 | Stage: includes pass the file's results to both emitters; generated pages get an overlay that matches headings and Examples tables to the re-parsed view. Report loaded through an mtime-keyed memo. | `gherkin-fence.ts`, `results-overlay.mjs`, `results-load.mjs` | WP03, WP04 |
| WP06 | Freshness: fold the report hash into the digest of Gherkin-bearing pages, and re-sync them when the report changes. | `schema.ts` | WP03 |
| WP07 | Agents: `/api/scenarios.json` gains `result` per scenario, `results` per Examples table and a top-level `results` block, behind a `results` route option. | `routes/scenario-index.ts` | WP02 |
| WP08 | Example site: a committed report for the example features, wired through `gherkin.results`; the scenarios guide shows badges; the axe lane covers them. | `example/` | WP05 |
| WP09 | Docs: ADR-0055 (amending ADR-0046 and ADR-0051), the architecture page, the authoring and consumer guides, a changelog entry, the roadmap. | `docs/` | all |

## Error and warning table

| Condition | Where | Outcome |
|---|---|---|
| `results` is not a string or `{ report, root? }`; unknown key; path not relative POSIX | `astro:config:setup` | Fatal: `[dk-gherkin] gherkin.results…` |
| Report file missing | `astro:config:setup` | Warning; no badges |
| Report larger than 64 MiB, not UTF-8 JSON, a bad NDJSON line, a JSON report that is not an array of features | `astro:config:setup` (and the stage in dev) | Fatal: `[dk-gherkin] <report>:<line> …` |
| Report is for another version of a shown file | Stage | Warning once per file and report; a "results not shown" note; no badges for that file |
| A report path matches several shown files only by its tail, or a tail-matched report file is claimed by a second shown file | Stage | Warning; no badges for that path |
| Every step in the report is skipped | `astro:config:setup` | Warning: looks like a `--dry-run` |
| A shown file is not in the report | Stage | Nothing (the report covers other files) |
| A scenario or row of a reported file has no result | Stage | "Not run" |

## Verification matrix

| Acceptance criterion | Test |
|---|---|
| Without `gherkin.results`, every page is byte-identical | Existing goldens and build tests unchanged; `gherkin-results-build.test.ts` builds the same page with and without a report |
| Messages and JSON give the same statuses for the same run | `gherkin-results.test.ts`: `messages.ndjson`, `cucumber-js.json`, `cucumber-jvm.json` against one expected table |
| Retries: final attempt decides; "passed on retry" only from Messages | `gherkin-results.test.ts` (fixture and CCK `retry`) |
| Every Cucumber status maps to its word | CCK `all-statuses`, Messages and JVM JSON |
| Outline rows match by row line, Rules and Backgrounds handled | CCK `examples-tables`, `rules-backgrounds` |
| Filtered run: unselected scenarios are Not run | `filtered.ndjson` |
| Stale report shows no badge and warns | Fixture with an inserted line, both formats |
| URIs: relative, `file:///`, `file:rel`, `classpath:`, backslashes, behave `location`, tail match | `gherkin-results.test.ts` |
| Old protocol (string `seconds`, omitted defaults, `willBeRetried` on the step) | Hand-made fixture |
| Malformed report is fatal with its line; missing is a warning | `gherkin-results.test.ts`, `gherkin-options.test.ts` |
| Include badges in HTML and agent Markdown agree | `gherkin-results-render.test.ts` |
| Generated page overlay leaves the committed Markdown alone | `validate:features` stays green; overlay unit test |
| A real build shows badges, and a changed report re-renders | `gherkin-results-build.test.ts` |
| Badges pass axe in light and dark | `tests/a11y/gherkin.spec.ts` |
| No new runtime dependency | `package-runtime-deps.test.ts` unchanged |

## Risks

- **Stale badges are worse than none.** Mitigated by the source comparison and the
  structural check; both refuse rather than guess.
- **Report contents leaking.** Only enum values, counts, a date and a validated hex
  commit id are read into a page; everything else is dropped at parse time.
- **Astro 5 internals.** The freshness fold reuses ADR-0051 decision 11's seam and
  moves with it under #119.
- **Heading matching on generated pages.** It uses the scenario index's text fold
  and document order. A page out of date with its source is skipped with a warning;
  the drift gate fails it anyway.
