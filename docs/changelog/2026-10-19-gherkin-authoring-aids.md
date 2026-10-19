---
title: Gherkin authoring aids and the Specification layout
description: "Glossary contexts by folder, an opt-in warning for UI-scripted steps, a header card on feature pages, and a draft notice on every draft page."
doc_status: active
updated: 2026-10-19T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:stijn
tags: [gherkin, bdd, glossary, lint, layout, drafts]
related:
  - adr/0061-gherkin-authoring-aids
  - adr/0062-specification-layout-and-draft-notice
  - architecture/gherkin-pages
  - guides/consumer-setup
  - guides/authoring
---

# 2026-10-19 — Gherkin authoring aids and the Specification layout

Three follow-ups to the Gherkin feature pages, in one change. The decisions are
recorded in [ADR-0061](../adr/0061-gherkin-authoring-aids.md) and
[ADR-0062](../adr/0062-specification-layout-and-draft-notice.md).

- **A glossary context per folder
  ([#197](https://github.com/spec-kitty/doc-kitty/issues/197)).**
  `gherkin.defaultGlossaryContext` maps source folders to glossary contexts, so
  features no longer repeat `@dk:context`. The longest matching folder wins, and
  a feature's own tag still wins over it. The drift gate takes the same map as
  `--default-glossary-context` flags. The build warns about an unused key and
  about a context the glossary does not define. See
  [Consumer setup](../guides/consumer-setup.md#gherkin-glossary-context-by-folder).
- **A warning for steps that script the UI
  ([#196](https://github.com/spec-kitty/doc-kitty/issues/196)).** With
  `gherkin.lint.imperativeSteps` on, the build warns about Given and When steps
  that name a UI action or quote a CSS selector. It is off by default and never
  fails a build. `@dk:allow=imperative` silences a Feature, a Rule or a
  Scenario. See
  [Write declarative scenarios](../guides/authoring.md#write-declarative-scenarios).
- **A header card on feature pages
  ([#198](https://github.com/spec-kitty/doc-kitty/issues/198)).** Pages with
  `kind: Specification` show their tags and source file above the scenarios. The
  source links to the repository when the site sets `sourceUrlPrefix`.
- **A draft notice on every draft page (#198).** A `doc_status: draft` page in
  the docs frame now says it is a draft, so it is never mistaken for an active
  page.

The example site uses both new options: its shipping and HR folders map to their
contexts, and the imperative-step lint runs with zero warnings.
