---
title: "ADR-0056: Gherkin results in CI, and a translatable Overview label"
description: A missing Cucumber report fails the build when CI is set, plus stale and route notices, and a translatable sidebar Overview label.
doc_status: active
updated: 2026-10-14T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0055-gherkin-scenario-results
  - adr/0054-gherkin-draft-hubs-titles-and-scenario-route
  - adr/0046-gherkin-feature-pages
  - architecture/gherkin-pages
  - guides/consumer-setup
  - guides/authoring
---

# ADR-0056: Gherkin results in CI, and a translatable Overview label

## Status

Accepted. **Amends [ADR-0055](./0055-gherkin-scenario-results.md)**; ADR-0055
itself is not edited. Closes the open points of
[#166](https://github.com/spec-kitty/doc-kitty/issues/166) and records the
decision for [#161](https://github.com/spec-kitty/doc-kitty/issues/161).

## Context

ADR-0055 shows each scenario's result from a Cucumber report. Using it showed
five gaps. A missing report only warned, so a CI build could ship a site with
no results and nobody noticed. A stale report was reported on a feature header
but not on a single-scenario include. A site that mounts its own
`scenarios.json` route could lose its results without a sign. Two behaviours
were never written down: how a scenario with no steps shows, and how a
generated page that lacks `generated.at` gets its results. Separately, the
"Overview" sidebar label ([#112](https://github.com/spec-kitty/doc-kitty/issues/112))
was English only.

## Decision

1. **A scenario with no steps shows "Not run".** Cucumber compiles a scenario
   with no steps to no test case, so the report holds nothing for its line. This is the documented behaviour: "Not run" says the truth, that no test ran.
   It is not shown as passed or hidden.
2. **A generated page without `generated.at` gets results by heading order.**
   The overlay takes, for each scenario, the next heading at the right level
   whose folded text equals the scenario title, in document order. It needs no
   source stamp; a scenario with no heading is reported, not guessed.
3. **Adopters produce the report in CI; they do not commit it.** A committed
   report is stale by construction and holds failure text and paths. The docs
   build reads the report the same job produced.
4. **A missing report warns locally and fails when `CI` is set.** "CI is set"
   means `process.env.CI`, trimmed and lower-cased, is non-empty and not `false`
   or `0`. The option `gherkin.results.required: false` turns the failure back
   into the warning, for preview or docs-only jobs. `required` must be a boolean.
   An unreadable, empty, oversize or malformed report still fails, as before.
5. **A stale report on a single-scenario include shows a note on the result
   line**: "Results not shown: the test report was made from a different version
   of this file." The note appears whether or not the scenario's line is in the
   report, never for a current report, and never repeats on each scenario of a
   full-feature render. It holds no report text.
6. **A hand-mounted scenarios route without results warns once per process.**
   When `gherkin.results` is set and the site's own `scenarioIndexRoute()` call
   passes no `results`, the build logs one `[dk-gherkin]` warning naming the route
   file and the value to pass. A process is one `astro build`, or one
   `astro dev` server run (a config reload does not warn again). The integration passes the route file it detected in the
   `DK_GHERKIN_ROUTE` environment variable; without it the message names
   `src/pages/api/scenarios.json`. The injected route never warns.
7. **The Overview label is a UI string, with an option on top (#161).** The
   English default `Overview` is the UI string `dockitty.sidebar.indexLabel`,
   injected by DocKitty's Starlight plugin, so a site translates it with
   Starlight's own `i18n` files. `defineDocKittyIntegrations({ sidebar: { indexLabel } })`
   wins over the translation. `sidebar` accepts either the existing Starlight
   array or this object; an unknown key or a blank label fails the build. Previous
   and next links keep the page title. With neither set, output is unchanged. One
   ADR holds both topics: #161 is a small extension of an existing rule, not a
   new architectural direction.

## Consequences

### Positive

- A CI build with no results fails loudly instead of publishing a quiet gap.
- Stale and mis-wired results show where the reader looks, not only in logs.
- Sites in other languages can translate the sidebar label.

### Negative

- A CI build that lacks the report fails after upgrading; docs-only jobs must
  set `required: false`.
- The `sidebar` option now has two shapes.

### Risks

- A CI value such as `CI=0` on a runner that means "not CI" is read as not set;
  this is intended and matches common tooling.

## Alternatives considered

### Fail on a missing report everywhere

Rejected: a local `astro dev` without a test run would be unusable.

### Show the stale note only in the log

Rejected: the reader of a single-scenario include never sees the log.

### Put the label in `sidebar` as a Starlight key

Rejected: Starlight's `sidebar` is its own item array; a second shape is cheaper
than a new top-level option.

## References

- [ADR-0055](./0055-gherkin-scenario-results.md), the decision this amends.
- [Using Gherkin results](../guides/consumer-setup.md#gherkin-test-results).
- See [ADR-0057](./0057-internal-env-handoff-seam.md), which owns the internal environment names used here.
