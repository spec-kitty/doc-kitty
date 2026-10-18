---
title: Gherkin results in CI, and a translatable Overview label
description: A missing Gherkin report fails CI builds, stale and route problems are flagged, the Overview label is translatable, and the Gherkin tests shrink.
doc_status: active
updated: 2026-10-14T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:stijn
tags: [gherkin, bdd, testing, i18n]
related:
  - adr/0056-gherkin-results-followups
  - adr/0055-gherkin-scenario-results
  - guides/authoring
  - guides/consumer-setup
---

# 2026-10-14 — Gherkin results in CI, and a translatable Overview label

Follow-ups to the Gherkin scenario results, plus a smaller Gherkin test suite.
The decisions are recorded in
[ADR-0056](../adr/0056-gherkin-results-followups.md).

## What changed

- **A missing report fails the build when `CI` is set (#166).** Set
  `gherkin.results.required: false` for jobs that never run the tests.
- **A stale report shows a note on a single-scenario include (#166).**
- **A hand-mounted scenarios route without `results` warns once (#166).**
- **The sidebar "Overview" label is translatable (#161)**, and
  `sidebar: { indexLabel }` sets it for all languages.
- **The Gherkin test suites are smaller**, with a coverage map recording that no
  guard was lost.
