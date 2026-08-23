---
title: QA portal (tests as documentation)
description: "Render test and BDD results in the docsite so a repository's site also serves as a QA portal."
doc_status: draft
updated: 2026-08-22
type: Architecture
kind: Explanation
tags: [qa, testing, bdd, living-documentation, portal]
related:
  - architecture/research/mission-status-portal
  - architecture/ci-cd-pipeline
---

# QA portal (tests as documentation)

An idea for first-class support of a repository's quality signals: render test and
BDD results in the docsite so it also serves as a QA portal. This is a proposal,
not a decision. It pairs with the [mission status portal](./mission-status-portal.md)
under the shared theme of doc-kitty as a repository portal.

## The idea

Consume a repo's test outputs and render a QA view: a pass/fail summary, and BDD
scenarios as living documentation. The docsite becomes the place to see "does it
work" next to "what and why." This treats tests as documentation, an executable
specification the reader can browse.

## Sources and precedents

- **JUnit XML** — the lingua franca of test results, though a family of dialects
  (Surefire, Jest, pytest) rather than one schema, which is the format sprawl noted
  below. Parse it into a summary and a failure list. HTML report generators already
  exist to borrow from.
- **BDD / Cucumber results** — Gherkin features plus a results file (Cucumber JSON,
  or the newer Cucumber Messages NDJSON that recent versions favor). Render features
  and scenarios as readable specs with pass/fail status. This is the
  living-documentation idea in the reference presentation,
  [documenting code](https://patterns.sddevelopment.be/presentations/documenting_code/).
- **Great Expectations data docs** — [greatexpectations.io](https://greatexpectations.io/)
  generates HTML documenting data-quality expectations and validation results. For
  data projects, doc-kitty could link or embed these, or render from GE's JSON.

## What it renders

- A results summary: totals, pass rate, and failures with messages, grouped by
  suite.
- BDD living documentation: features and scenarios as prose with status badges.
  This is a natural per-kind layout (a `Test` or `Spec` kind, matching the
  capitalized `kind` vocabulary in ADR-0009), tying to `kind`-drives-layout.
- Optional: a link to or embed of Great Expectations data docs for data projects.

## How results arrive (open decision)

- This requires **new CI wiring**, not a free fit with the current
  [pipeline](../ci-cd-pipeline.md). The pipeline runs path-scoped, independent
  lanes: a docs-only PR skips `code-quality` entirely, so no tests run and no JUnit
  is produced, and nothing today emits or persists test artifacts. Rendering
  results means emitting JUnit from the test lane, persisting it as a run artifact,
  and having the deploy or nightly build fetch the latest. Coupling `build-example`
  or `deploy` to `code-quality` would break the pipeline's path-scoped
  independence, so the **nightly reporting flow is the more natural host** than the
  per-PR build.
- The result is a **build-time snapshot**, not live; stamp it with the commit and
  timestamp.
- Artifact location is a configured path or a convention (for example
  `reports/junit.xml`), and the page is opt-in by presence.

## Considerations and risks

- **Format sprawl** — start with JUnit XML (universal) plus one BDD format
  (Cucumber JSON). Treat Great Expectations as a link or embed first, not a parser.
- **Freshness and provenance** — a snapshot; always show what commit and run it
  reflects.
- **Effort split** — the results summary is the quick win; rendering BDD as living
  documentation is the higher-value, higher-effort part.
- **Access control** — a public GitHub Pages deploy has no auth, so test-failure
  output (stack traces, data values, internal paths) is a potential secret carrier.
  Decide what is safe to publish before wiring this to a public deploy.

## Fit

Extends "docsite as portal" (status and QA) and aligns with the
living-documentation doctrine, and could feed the agent-API with machine-readable
test status. Like the status portal, it is a surface a consuming repo renders on
its own docsite, not a feature of doc-kitty's own site. A candidate feature and
mission after the core docsite ships.

## Open items

- Which formats first (JUnit plus Cucumber; Great Expectations as embed?).
- The artifact source and convention, and the CI wiring.
- Whether QA pages are a `kind` with a per-kind layout, and how they gate (always
  show the latest run versus draft).

## References

- [Documenting code (BDD / living documentation)](https://patterns.sddevelopment.be/presentations/documenting_code/)
- [Great Expectations](https://greatexpectations.io/)
- JUnit XML (the common test-report format).
