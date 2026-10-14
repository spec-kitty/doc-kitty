---
title: Scenarios
description: A gherkin fence and an included .feature file, rendered from the packed toolkit tarball.
doc_status: active
updated: 2026-10-13
type: Guide
kind: Reference
tags: [gherkin, scenarios]
---

# Scenarios

The fixture turns in-page Gherkin on with
`gherkin: { includeRoots: ['scenarios'] }`, so this page renders a fence and an
include as structured scenarios.

## A fence

```gherkin
Scenario: Find the preamble
  Given the rhetoric section
  When the student opens the preamble
  Then the preamble is shown
```

## An include

::gherkin{src="scenarios/study/read-a-chapter.feature" scenario="Look up a term while reading"}
