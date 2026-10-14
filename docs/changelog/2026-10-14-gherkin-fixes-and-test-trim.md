---
title: Gherkin fixes and a leaner Gherkin test suite
description: Draft-only directories get a draft hub, gherkin.titles names hubs, a mis-cased @wip warns, the scenario index route is injected, and the Gherkin tests lose their duplicates.
doc_status: active
updated: 2026-10-14
type: Changelog
kind: Changelog
authors:
  - stijn@sddevelopment.be
tags: [gherkin, bdd, testing]
related:
  - adr/0054-gherkin-draft-hubs-titles-and-scenario-route
  - adr/0046-gherkin-feature-pages
  - architecture/gherkin-pages
  - guides/authoring
  - guides/consumer-setup
---

# 2026-10-14 — Gherkin fixes and a leaner Gherkin test suite

Five small gaps left over from the Gherkin feature pages are closed, and the
Gherkin test suites lose the tests that only repeated another test's check. The
decisions are recorded in
[ADR-0054](../adr/0054-gherkin-draft-hubs-titles-and-scenario-route.md).

## What changed

- **Draft-only directories get a draft hub (#124).** A directory whose features
  are all `@wip` gets a hub with `doc_status: draft`. With drafts published, the
  sidebar finds its index; with drafts off, neither the hub nor its pages are
  built. No published hub links it.
- **Hub titles (#125).** `gherkin.titles: { hr: 'HR' }` titles a hub and its
  sidebar group when the directory name can't. The example site uses it.
- **Mis-cased status tags warn (#123).** `@WIP` stays an ordinary tag, as in
  Cucumber, and the build says "did you mean `@wip`?".
- **The scenario index is served for you (#126).** With `gherkin.sources` set,
  `/api/scenarios.json` exists without a route file, so the `llms.txt` line never
  points at a 404. A route file you already have is kept.
- **One copy of the worked example (#128).** A parity test keeps the two fixture
  copies of `book-consignment.feature` equal to the example's.
- **Fewer, owned tests (#156).** Each Gherkin behaviour is now asserted once, at
  the layer that owns it. A test was retired only after a deliberate one-line
  break in the source turned its covering test red; two retirements that failed
  that check in review were reversed.

## Upgrading

A site with a draft-only Gherkin directory gets one new generated hub: run the
generator once and commit it. Nothing else changes: a site that mounted
`scenarioIndexRoute()` keeps working, and one that did not now gets the route.
