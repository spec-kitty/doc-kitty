---
title: Gherkin scenario results (research)
description: "What Cucumber reports contain, how a result is matched to a rendered scenario, and how other tools show status: the research behind slice D of issue #120."
doc_status: active
updated: 2026-10-14
type: Architecture
kind: Explanation
tags: [qa, testing, bdd, gherkin, cucumber, living-documentation]
related:
  - architecture/research/qa-portal
  - architecture/gherkin-pages
  - adr/0046-gherkin-feature-pages
  - adr/0051-gherkin-in-any-page
  - adr/0055-gherkin-scenario-results
  - plans/features/gherkin-scenario-results
---

# Gherkin scenario results (research)

Slice D of [issue #120](https://github.com/spec-kitty/doc-kitty/issues/120)
(tracked as [#162](https://github.com/spec-kitty/doc-kitty/issues/162)) puts a
pass or fail badge next to each scenario a docsite shows. The result comes from a
Cucumber report that the site's CI already produces. This page records what that
report looks like, how a result can be tied to a scenario on a page, and what
other living-documentation tools do. The decision is
[ADR-0055](../../adr/0055-gherkin-scenario-results.md); the delivery plan is
[Gherkin scenario results](../../plans/features/gherkin-scenario-results.md).

Findings were checked against the official sources linked inline, and against a
real run: cucumber-js 13.3.0 with `@cucumber/messages` 34.2.1 and
`@cucumber/gherkin` 42.0.1, the versions doc-kitty pins. That run produced the
test fixtures under `src/tests/fixtures/gherkin/results/`.

## Two report formats

Cucumber writes results in two formats a docsite can read at build time.

| | Cucumber Messages (NDJSON) | Cucumber JSON (legacy) |
|---|---|---|
| Written by | `--format message` in cucumber-js 7+, cucumber-jvm 6+, cucumber-ruby 4+, Reqnroll 3+ | `--format json` in cucumber-js and cucumber-jvm; also behave, godog |
| Schema | Yes: [`messages.md`](https://github.com/cucumber/messages/blob/main/jsonschema/messages.md), shipped in `@cucumber/messages` | None. ["a de facto standard without specification"](https://github.com/cucumber/cucumber-json-formatter), different per runner |
| Status | The current format | ["maintenance mode"](https://github.com/cucumber/cucumber-js/blob/main/docs/formatters.md), not formally deprecated |
| Carries the `.feature` text | Yes (`source.data`) | No |
| Retries visible | Yes (`attempt`, `willBeRetried`) | No: only the final attempt is written |
| Run date and commit | `testRunStarted`/`testRunFinished` timestamps, `meta.ci.git.revision` | Per-element `start_timestamp` in the JVM shape only |

Messages is the better input on every count, and it is what a new pipeline should
emit. Legacy JSON is still what many existing pipelines write, and it is cheap to
read for the common case, so it is supported as best effort.

### Cucumber Messages

A Messages report is newline-delimited JSON. Each line is one envelope with
exactly one key set. The envelopes slice D reads:

- `source {uri, data, mediaType}`: the full text of each `.feature` file.
- `gherkinDocument {uri, feature}`: the parsed AST, with an `id` on every
  scenario, examples block and table row, and `location.line` on each.
- `pickle {id, uri, astNodeIds, location?, name}`: one executable scenario.
  `astNodeIds` is `[scenario.id]` for a plain scenario and
  `[scenario.id, tableRow.id]` for one row of an outline; the last id is the
  pickle's own. A Rule's id is never in it. `location` (messages 31+) points at
  the scenario line, or at the example row for an outline.
- `testCase {id, pickleId, testSteps}`: one pickle as selected for this run.
  cucumber-js writes a `pickle` for every scenario in the file, but a `testCase`
  only for the ones a `--tags` filter selected, so "pickle without test case"
  means "not run".
- `testCaseStarted {id, testCaseId, attempt}`: one attempt. `attempt` counts
  from 0.
- `testStepFinished {testCaseStartedId, testStepResult: {status, message?, exception?}}`:
  one step result, hooks included.
- `testCaseFinished {testCaseStartedId, willBeRetried}`: the end of an attempt.
  Every attempt but the last has `willBeRetried: true`.
- `testRunStarted`, `testRunFinished {success, timestamp}`, `meta {ci: {git: {revision}}}`:
  the run as a whole.

`TestStepResultStatus` has seven values: `UNKNOWN`, `PASSED`, `SKIPPED`,
`PENDING`, `UNDEFINED`, `AMBIGUOUS` and `FAILED`.

Older reports differ in ways a reader has to tolerate
([CHANGELOG](https://github.com/cucumber/messages/blob/main/CHANGELOG.md)):

- Up to version 15 (the protobuf-JSON era), default values are omitted:
  `attempt` is missing when 0, `willBeRetried` when false, empty strings and
  arrays are absent, and `Timestamp.seconds` is a string.
- Before 17, `willBeRetried` sat on `testStepResult`, not on `testCaseFinished`.
- Before 31, `pickle.location` does not exist; the line comes from the AST.
- Unknown fields and envelopes must be ignored (12.0.0). The bundled JSON schema
  sets `additionalProperties: false`, so it cannot validate a newer report.
- `parseEnvelope` in `@cucumber/messages` 33+ is plain `JSON.parse` and fills no
  defaults.

### Cucumber JSON

A JSON report is one array of features: `{uri, name, line, elements[]}`, each
element `{type, keyword, name, line, steps[]}`, each step
`{keyword, line, name, result: {status, error_message?}}`. The dialects differ:

| Runner | Background | Outline rows | `uri` | Status words |
|---|---|---|---|---|
| cucumber-js | Inlined into each scenario's steps | One element per row; `line` is the row's line; rows share one `id` | Relative to the cwd | The enum, lower-cased (so `ambiguous`, `unknown` occur) |
| cucumber-jvm (official converter) | A `type: background` element before every scenario | One element per row at the row's line; `id` ends `;<examples>;<row+2>` | `file:relative/path`, or `classpath:` | `passed`, `skipped`, `pending`, `undefined`, `ambiguous`, `failed` |
| godog | As cucumber-js | Row line, `id` as the JVM | Relative | As cucumber-js |
| behave | Own element | One element per row | No `uri`; `location: "path:line"` on feature and element | `untested`, `skipped`, `passed`, `failed`, `error`, `hook_error`, `pending`, `undefined`, … |

Hooks appear as extra steps (`keyword: "Before"`, `hidden: true`) in cucumber-js
and as `before`/`after` arrays in the JVM shape. Both count towards the result.
The `id` is not usable as a key: outline rows share one in cucumber-js.

## Tying a result to a rendered scenario

### Not by AST id

doc-kitty parses with an incrementing id generator, so its ids are deterministic.
Runners do not do that: cucumber-js uses `IdGenerator.uuid()`, and cucumber-jvm a
random UUID generator. An id is only useful for joins inside one report.

### By file, scenario line and row line

The key that both sides can compute is
`(feature file, scenario line, example-row line or none)`:

- In a Messages report: `testCaseStarted` → `testCase` → `pickle`, then
  `pickle.astNodeIds[0]` (and the last id, for a row) looked up in the
  **report's own** `gherkinDocument` to get the lines. `pickle.location` is a
  shortcut where it exists.
- In a JSON report: the element's `line` (the scenario line, or the row's line
  for an outline), with behave's `location` split at the last `:`.
- On the docsite: `scenario.location.line` and
  `examples[i].tableBody[j].location.line` from doc-kitty's own parse.

A prototype using only `@cucumber/messages` matched all four pickles of the
fixture (a background, a scenario, a two-row outline and a scenario in a Rule).

### Detecting a stale report

A report can be older than the `.feature` file the page renders: lines move,
scenarios are renamed. A line key on a stale report would put a result on the
wrong scenario.

- **Messages** carries the file text. Compare `source.data` with the file the page
  renders, after removing a BOM and normalising line endings. Equal means every
  line in the report is the page's line. Different means the report is stale for
  that file.
- **JSON** carries no text. The best check is structural: every element's line
  must be a scenario line (or an outline row line) in the current file, and the
  element's name must equal that scenario's name (for an outline row, with
  `<placeholders>` filled in from the row).

No prior tool flags staleness. Pickles matches by feature and scenario name, which
survives moved lines but silently picks the first of two duplicate names. Allure
groups by its own `historyId`. The Cucumber HTML report reads one stream and never
meets a second version of a file.

### URIs

Observed values:

- cucumber-js: relative to the directory Cucumber ran in (`features/x.feature`),
  with backslashes on Windows.
- cucumber-jvm Messages: an absolute, unnormalised `file:///home/…/../features/x.feature`
  (the official converter's own test data has a developer's home directory in it).
- cucumber-jvm JSON: `file:features/x.feature` after relativising, or
  `classpath:com/example/x.feature`.
- behave: `features/x.feature:12`.

So a reader has to: decode `file:` URIs, strip `classpath:`, turn `\` into `/`,
normalise `.` and `..`, resolve a relative URI against the directory Cucumber ran
in (which is not always the docsite's root: a site can check another repository
out into a subfolder), and for an absolute URI from another machine fall back to
matching the path's tail, accepted only when exactly one file matches.

## Status

### The final status of one scenario

The official tools agree ([`@cucumber/query`](https://github.com/cucumber/query/blob/main/javascript/src/Query.ts),
the HTML formatter's react-components, `getWorstTestStepResult` in
`@cucumber/messages`):

1. Keep the final attempt: the one whose `testCaseFinished.willBeRetried` is
   false (the highest `attempt` as a fallback).
2. Take the most severe result among all its step results, hooks included, by
   the ordinal `UNKNOWN < PASSED < SKIPPED < PENDING < UNDEFINED < AMBIGUOUS < FAILED`.

A scenario with no steps yields `UNKNOWN`. cucumber-js retries only failed
scenarios, and ["when a scenario passes on a retry, it's treated as a pass
overall"](https://github.com/cucumber/cucumber-js/blob/main/docs/retry.md). A
`--dry-run` marks every step `SKIPPED` and still reports `success: true`.

### A display vocabulary

| Shown | Messages | JSON | Meaning for a reader |
|---|---|---|---|
| Passed | `PASSED` | `passed` | The behaviour works as written |
| Failed | `FAILED` | `failed`; behave `error`, `hook_error` | It does not |
| Ambiguous | `AMBIGUOUS` | `ambiguous` | Two step definitions match a step |
| Undefined | `UNDEFINED` | `undefined`, behave `untested_undefined` | A step has no automation yet |
| Pending | `PENDING` | `pending`, behave `pending_warn`, `untested_pending` | Automation is started, not finished |
| Skipped | `SKIPPED` | `skipped` | Steps after a failure, or a dry run |
| Not run | `UNKNOWN`, or no attempt | `unknown`; behave `untested`, `executing`; or absent | The run did not execute it |

It mirrors Cucumber's own enum, so nothing is lost and the words are the ones a
team already sees in CI. Undefined, pending and ambiguous each say the spec is not
automated yet in a different way, which matters in living documentation;
LivingDoc's "Other" and Pickles' "Inconclusive" buckets throw that away. Allure's
"broken" needs heuristics over exception data that a public site should not read.

A qualifier on top: **passed on retry** when the final attempt passed and an
earlier one did not (Messages only; JSON hides retries).

### Outlines and features

Each outline row is its own pickle, so each row gets its own badge. The outline
heading gets the worst row status plus counts ("1 passed, 1 failed"), so one
unexecuted row cannot hide behind a pass. A feature summary counts pickles the way
Cucumber's own summary does ("4 scenarios (3 passed, 1 failed)").

## How other tools show it

- **Cucumber HTML report** (react-components): a coloured icon per step and
  scenario with `data-status` and no text alternative (Font Awesome icons are
  `aria-hidden`); the run summary is text ("3 passed").
- **Serenity BDD**: text adjectives ("Passing", "Failing", "Broken").
- **Allure**: colour per status in lists, filters and charts; retries in a tab.
- **Pickles / SpecFlow LivingDoc** (both end of life): three or four states,
  failed wins.

WCAG constraints for a badge:

- **1.4.1 Use of Color**: the status must be in text, not only in a hue.
- **1.4.11 Non-text Contrast**: an icon that carries meaning needs 3:1; one
  that only reinforces text does not.
- **1.4.3**: badge text needs 4.5:1.
- `aria-label` is not allowed on a bare `<span>` (the `generic` role); use
  visible or visually hidden text instead.
- A badge **inside** a heading would change the heading's accessible name, its
  table-of-contents entry and its slug. It belongs next to the heading.

## Security and privacy

Real reports carry more than statuses:

- `testStepResult.message` is defined to include the stack trace, and real traces
  hold absolute CI paths (`/home/runner/work/…`).
- cucumber-jvm writes a developer's home directory into every `uri`.
- Exception messages can hold data values, tokens, SQL or URLs (CWE-209, CWE-532).
- Attachments (screenshots, logs) can hold anything.
- `meta` names the OS, kernel, runtime, CI URL and git remote.

A public docsite should publish the status words, the counts and the run date,
and nothing else from the report by default. The short commit id is low risk and
is what makes a result checkable. Failure messages, stack traces, attachments,
step-definition locations, `meta.os`/`cpu`/`runtime` and raw URIs are never
copied. Since only enum values and counts reach the page, the injection surface
is minimal; the report is still parsed as untrusted input (size cap, per-line
errors, unknown envelopes ignored, `Map`s rather than object merges).

## Supply chain

No new dependency is needed. `@cucumber/messages` 34.2.1 is already a direct,
exact-pinned dependency with no runtime dependencies of its own; it provides the
types and the `TestStepResultStatus` enum. Splitting NDJSON is one line.
`@cucumber/query` 16.1.1 would save about 80 lines of joins, but it brings
`lodash.sortby` (last published 2016) and `@teppeis/multimaps`, and still leaves
URI matching, staleness and JSON to write. It does not meet the
[ADR-0014](../../adr/0014-upgrade-starlight-for-route-data-api.md) bar for what
it saves.

## Fixtures

The fixtures under `src/tests/fixtures/gherkin/results/` come from a real
cucumber-js 13.3.0 run with `--retry 1 --retry-tag-filter @flaky`, with
`meta.ci` populated from GitHub Actions variables. The only edit is the run's
scratch directory in stack traces, rewritten to `/home/runner/work/shop/shop`.
The NDJSON validates against `messages.schema.json` 34.2.1; the cucumber-js JSON
against `@cucumber/json-schema`'s `cucumber-js.json`; the JVM-shaped JSON was made
from the same NDJSON by the official `cucumber-json-formatter` 0.4.2 and validates
against `cucumber-jvm.json`.

| Scenario | Lines | Final status | Notes |
|---|---|---|---|
| Paying by card | 8 | Passed | |
| Applying a discount code, row `SAVE10` | 12, row 18 | Passed | |
| Applying a discount code, row `EXPIRED` | 12, row 19 | Failed | The outline shows Failed (1 passed, 1 failed) |
| Paying with a gift card (in a Rule) | 24 | Passed | Failed on attempt 0, passed on retry; JSON shows only "passed" |

## References

- [cucumber/messages](https://github.com/cucumber/messages) and its
  [schema reference](https://github.com/cucumber/messages/blob/main/jsonschema/messages.md).
- [cucumber/query](https://github.com/cucumber/query), the reference for final
  attempts and severity.
- [cucumber/cucumber-json-formatter](https://github.com/cucumber/cucumber-json-formatter)
  and [cucumber/cucumber-json-schema](https://github.com/cucumber/cucumber-json-schema).
- [Cucumber compatibility kit samples](https://github.com/cucumber/compatibility-kit/tree/main/devkit/samples):
  `retry`, `examples-tables`, `rules-backgrounds`, `all-statuses`, `empty`.
- [WCAG 2.2 Understanding 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
  and [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- [QA portal research](./qa-portal.md), where results were first proposed.
