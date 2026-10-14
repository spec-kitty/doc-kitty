---
title: "ADR-0055: Show each scenario's result from the site's Cucumber report"
description: gherkin.results reads a Cucumber report and shows each scenario's result next to it, matched by file and line, never from a stale report.
doc_status: active
updated: 2026-10-14
type: ADR
kind: ADR
authors:
  - ivan@spec-kitty.ai
related:
  - adr/0046-gherkin-feature-pages
  - adr/0051-gherkin-in-any-page
  - adr/0014-upgrade-starlight-for-route-data-api
  - architecture/gherkin-pages
  - architecture/research/gherkin-results
  - architecture/research/qa-portal
  - plans/features/gherkin-scenario-results
---

# ADR-0055: Show each scenario's result from the site's Cucumber report

## Status

Accepted. Delivers slice D of
[issue #120](https://github.com/spec-kitty/doc-kitty/issues/120), tracked as
[#162](https://github.com/spec-kitty/doc-kitty/issues/162), and phase 2 of the
[QA portal research](../architecture/research/qa-portal.md).
**Amends [ADR-0046](./0046-gherkin-feature-pages.md) decision 9 and
[ADR-0051](./0051-gherkin-in-any-page.md) decisions 1, 7 and 8** (see
[Amendments](#amendments)).

The research behind it, with sources, is
[Gherkin scenario results (research)](../architecture/research/gherkin-results.md);
the delivery plan is [Gherkin scenario results](../plans/features/gherkin-scenario-results.md).

## Context

Generated feature pages (ADR-0046) and in-page Gherkin (ADR-0051) show what a
system should do. A reader of living documentation also wants to know whether it
does: the result of the last test run, next to each scenario. The site's CI
already runs Cucumber and can write a report; the toolkit must not run tests or
fetch anything (a non-goal of #120).

Facts that shape the design:

- **Two report formats are in use.** Cucumber Messages (NDJSON) is the current,
  schema-backed format, and the only one that carries each file's text, the AST
  and retries. Legacy Cucumber JSON has no schema and differs per runner, but it is
  what many pipelines still write.
- **Runner ids are random.** cucumber-js and cucumber-jvm give AST nodes UUIDs, so
  a report's ids never match doc-kitty's own parse. A file and a line are the one
  key both sides can compute.
- **A report can be older than the page.** Lines move and scenarios are renamed;
  matching an old report by line would put a result on the wrong scenario.
- **Generated pages are committed and drift-gated.** `generate-feature-pages
  --check` must not depend on the last test run, so a result can never be written
  into a generated page's Markdown.
- **Reports hold more than results.** Failure messages carry stack traces with CI
  paths, data values and sometimes secrets; cucumber-jvm writes a developer's home
  directory into every URI.

## Decision

1. **Config.** `gherkin.results` is a project-root-relative path to the report, or
   `{ report, root }`, where `root` is the directory Cucumber ran in (default the
   project root): the report's relative URIs resolve against it. Both follow the
   include path rule (relative, `/` separators). An unknown key is a config error.
   `results` is not a generated-pages key, so the bare-Node CLI has no flag for it.
2. **Formats.** Cucumber Messages (protocol 15 to 34: omitted defaults, string
   `seconds` and `willBeRetried` on the step result are read) and Cucumber JSON
   (cucumber-js, cucumber-jvm, godog and behave dialects), told apart by the first
   character. Unknown envelopes and fields are ignored, never validated against the
   installed schema.
3. **The key is file and line.** A result belongs to the scenario on its line, or
   to the outline row on its line. A Messages pickle's lines come from the
   report's own `gherkinDocument`. A report URI is normalised, resolved against
   `root` when relative, made project-relative when absolute inside the project,
   and otherwise matched by its tail only when exactly one reported file has it
   and no other rendered file has already claimed that reported file.
4. **A stale report is never matched.** A Messages report must carry the rendered
   file's exact text (`source.data`, BOM and line endings aside). A report without
   it (JSON) must have every entry on a scenario or outline-row line of the whole
   file, with a matching name and the steps that scenario (or row, its values
   filled in) has, with or without the Background steps before them. Otherwise the file shows no results, a "Results not
   shown" note where its feature header is shown, and one build warning.
5. **Generated pages get results at render time.** Their Markdown never changes.
   The in-page stage re-reads a generated page's source, checks it against
   `generated.at`, and inserts the same nodes an include gets into the page's mdast,
   matching scenario headings by level, document order and folded text (the
   scenario index's rule) and Examples tables by shape. A heading it cannot find
   is warned about, never guessed.
6. **Status.** The most severe step result, hooks included, of the final attempt
   (`willBeRetried` false, else the highest `attempt`), in Cucumber's order. Shown
   as Passed, Failed, Ambiguous, Undefined, Pending, Skipped or Not run, plus
   "Passed on retry" for a pass after a failed attempt. An outline row has its own
   result; the outline heading shows the most severe row with counts per status;
   the feature header shows counts per test case, the run date and the short commit.
7. **Markup.** A `p.dk-gherkin__result` directly after the scenario heading, never
   inside it, so headings, their TOC entries and slugs do not change. Its
   `span.dk-gherkin__status[data-status]` holds the status word after a visually
   hidden "Result:"; a glyph (with empty alternative text) and a tinted bar only
   repeat it. An Examples table gains a `Result` column with a header. The rules are
   unscoped, in the global component sheet, because a generated page has no
   `.dk-gherkin` container.
8. **Only statuses are published.** The parser keeps status words, lines, names, the
   run's date and a commit id that looks like one. Messages, stack traces,
   attachments, step-definition locations, environment details and raw URIs never
   leave it. Failure details are not offered, even as an option.
9. **Errors.** The report is read in `astro:config:setup`: missing is a warning (a
   local build has no CI report) and the site builds without results; not a file,
   larger than 64 MiB or not a Cucumber report is a thrown error naming the report
   (and line, for NDJSON); every step skipped warns that it looks like a dry run. A
   report that becomes unreadable under a dev server fails the pages that show
   results through the ADR-0051 error sink.
10. **Freshness.** The integration names the report to the docs loader in
    `DK_GHERKIN_RESULTS`. A page that may show results (it holds `::gherkin` or the
    generated-page stamp) folds the report's hash into its digest, and a report
    change re-emits a `change` for each such page in dev, as ADR-0051 decision 11
    does for an included file. With no report, every digest is the one before.
11. **Agents.** An include's agent Markdown carries the same result lines, column
    and summary as its HTML. `scenarioIndexRoute({ results })` adds `result` to each
    scenario, `results` per Examples row, `results: 'current' | 'stale'` per feature
    and a top-level `results` block (report, format, run date, commit). A generated
    page's agent payload is its committed Markdown and carries no results; the index
    does.
12. **No new dependency.** `@cucumber/messages` is already pinned. `@cucumber/query`
    is not added: it brings an unmaintained transitive dependency and would still
    leave URI matching, staleness and JSON to write (ADR-0014 bar).

## Amendments

- **ADR-0046 decision 9 (scenario index).** With the `results` route option, the
  index carries each scenario's result. Without it the shape is unchanged.
- **ADR-0051 decision 1 (config shape).** The option gains `results`. The in-page
  stage is registered when `fences` is on **or** `results` is set; with
  `fences: false` it only adds results to generated pages and leaves fences and
  includes as authored.
- **ADR-0051 decision 7 (generated pages are skipped).** Their Gherkin is still
  left as emitted, but with `results` the stage adds the results overlay of
  decision 5 to them.
- **ADR-0051 decision 8 (markup).** The rendered contract gains the result line,
  the `Result` column and the results summary of decision 7, on both emitters.

## Consequences

### Positive

- A reader sees what works and what does not next to the behaviour it describes,
  on generated pages and in guides, with no change to how scenarios are written.
- A badge is either right or absent: stale reports, ambiguous paths and missing
  headings all refuse rather than guess.
- No new dependency, and nothing changes for a site without `results`: pages,
  digests, plugin lists and the scenario index are byte-identical.

### Negative

- Any edit to a `.feature` file hides its results until the tests run again
  (Messages compares the whole text, comments included).
- The scenario index route repeats `results`, as it repeats `sourceRoot`.
- Generated pages are re-parsed at render time when results are on.
- Content-layer freshness for the report rests on the same Astro 5 loader
  internals as ADR-0051 decision 11 (#119).

### Risks

- **A JSON report that changed only outside steps is not detected as stale.** A
  data table or doc string edit, or a tag change, leaves lines, names and step
  texts the same, so the old results show. Messages detects any change.
- **Tail matching across machines.** An absolute URI from another machine is placed
  by its tail. Two candidates are refused, and one reported file serves only the
  first rendered file that claims it, but a single wrong candidate would be used
  (the staleness checks still apply). Setting `root` and running Cucumber with
  relative paths avoids it.
- **Report size.** A report with attachments can be large; the 64 MiB limit fails
  such a build rather than slowing it.

## Alternatives considered

### Write results into the generated Markdown

Simplest, and the agent payload of a generated page would carry them. Rejected: the
committed pages would change with every test run and the drift gate would fail.

### Match by scenario name

Survives moved lines (Pickles does this). Rejected as the key: two scenarios may
share a name, outline rows share one, and a renamed scenario would silently lose or
take another's result. Names are used only to check a JSON report.

### Show results from a stale report with a warning label

Keeps information on the page. Rejected for v1: a result next to the wrong
scenario is worse than none, and a name-based fallback is the same matching problem
as above. A later change can add it behind an option.

### A `@cucumber/html-formatter` embed

A full interactive report. Rejected as before (ADR-0046 option D): outside the
theme, navigation and agent surfaces. A site can still link its own HTML report.

### Results on fences

A fence has no file, so it would need a name match against the report. Rejected:
the scenario in a guide is often an illustration, not the executed one.

### Failure messages behind an option

Useful to developers. Rejected for now: they are a secret carrier on a public site,
and a reader who needs them needs the CI run, which the commit identifies.

## References

- [Gherkin scenario results (research)](../architecture/research/gherkin-results.md).
- [Gherkin feature pages](../architecture/gherkin-pages.md#scenario-results), the architecture.
- [ADR-0046](./0046-gherkin-feature-pages.md), [ADR-0051](./0051-gherkin-in-any-page.md),
  [ADR-0014](./0014-upgrade-starlight-for-route-data-api.md).
- [cucumber/messages](https://github.com/cucumber/messages),
  [cucumber/query](https://github.com/cucumber/query).
