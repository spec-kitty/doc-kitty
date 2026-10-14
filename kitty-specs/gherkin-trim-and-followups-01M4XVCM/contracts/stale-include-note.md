# Contract: stale note on a single-scenario include (FR-007)

When a `::gherkin{src=… scenario=…}` include (one scenario, no feature summary) renders and the report state for the file is `stale`, the scenario's **result line** (`<p class="dk-gherkin__result">`, the element that holds the status badge for a current report) reads:

> **Results not shown:** the test report was made from a different version of this file.

The wording is the same as the feature-level stale summary.

- The note appears whether or not the scenario's line is in the report.
- It never appears for a current report: the status shows as before (control).
- It never appears with no `gherkin.results` configured.
- Full-feature renders keep the feature-level summary and do not repeat the note on each scenario.
- It contains no report text (FR-005).
