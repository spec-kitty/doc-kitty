---
title: QA portal (tests as documentation)
description: "Render test and BDD results in the docsite so a repository's site also serves as a QA portal."
status: draft
updated: 2026-08-22
type: Architecture
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

- **JUnit XML** — the lingua franca of test results. Parse it into a summary and a
  failure list. HTML report generators already exist to borrow from.
- **BDD / Cucumber results** — Gherkin features plus a results file (for example
  Cucumber JSON). Render features and scenarios as readable specs with pass/fail
  status. This is the living-documentation idea in the reference presentation,
  [documenting code](https://patterns.sddevelopment.be/presentations/documenting_code/).
- **Great Expectations data docs** — [greatexpectations.io](https://greatexpectations.io/)
  generates HTML documenting data-quality expectations and validation results. For
  data projects, doc-kitty could link or embed these, or render from GE's JSON.

## What it renders

- A results summary: totals, pass rate, and failures with messages, grouped by
  suite.
- BDD living documentation: features and scenarios as prose with status badges.
  This is a natural per-kind layout (a `test` or `spec` kind), tying to
  `kind`-drives-layout.
- Optional: a link to or embed of Great Expectations data docs for data projects.

## How results arrive (open decision)

- CI runs the tests and emits artifacts (JUnit XML, Cucumber JSON); the doc-kitty
  build consumes them. This couples the docsite build to the presence of those
  artifacts from the same CI run, which fits the [CI/CD pipeline](../ci-cd-pipeline.md)
  (tests run, artifacts produced, the deploy or nightly build reads the latest).
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

## Fit

Extends "docsite as portal" (status and QA), aligns with the CI/CD design and the
living-documentation doctrine, and could feed the agent-API with machine-readable
test status. A candidate feature and mission after the core docsite ships.

## Open items

- Which formats first (JUnit plus Cucumber; Great Expectations as embed?).
- The artifact source and convention, and the CI wiring.
- Whether QA pages are a `kind` with a per-kind layout, and how they gate (always
  show the latest run versus draft).

## References

- [Documenting code (BDD / living documentation)](https://patterns.sddevelopment.be/presentations/documenting_code/)
- [Great Expectations](https://greatexpectations.io/)
- JUnit XML (the common test-report format).
