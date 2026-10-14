---
title: Gherkin feature pages
description: "Render Gherkin .feature files as glossary-linked Specification pages in the docsite, with related missions, ADRs and personas."
doc_status: active
updated: 2026-10-14
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: The document half of BDD living documentation, built almost entirely from shipped seams (glossary codegen, auto-link, related/audience), and the base the QA portal's results overlay builds on.
tags: [bdd, gherkin, living-documentation, glossary, agent-api]
related:
  - adr/0046-gherkin-feature-pages
  - architecture/gherkin-pages
  - architecture/research/qa-portal
  - plans/features/qa-portal
  - plans/features/glossary-and-contextive
---

# Gherkin feature pages

An opt-in `gherkin` preset parses a repository's `.feature` files and generates one
`kind: Specification` page per feature into the docs collection. Step text is
glossary-linked within the feature's bounded context. Feature tags link the page
to its persona, missions and ADRs. Pages appear in the sidebar, sitemap, RSS,
`llms.txt` and the agent API like any other page.

Scope: Extended.

Design: [ADR-0046](../../adr/0046-gherkin-feature-pages.md) and
[Gherkin pages](../../architecture/gherkin-pages.md). Authoring:
[Authoring behaviour specs](../../guides/authoring.md#authoring-behaviour-specs).

Builds toward: [QA portal](./qa-portal.md). Phase 2, pass/fail per scenario, is
[Gherkin scenario results](./gherkin-scenario-results.md).
