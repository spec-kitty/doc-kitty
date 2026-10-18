---
title: Gherkin feature pages
description: "An opt-in gherkin preset turns .feature files into glossary-linked Specification pages, with owned-output pruning and a --check drift gate."
doc_status: active
updated: 2026-10-13T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:ivan
tags: [gherkin, bdd, living-documentation, glossary, codegen, ci]
related:
  - adr/0046-gherkin-feature-pages
  - architecture/gherkin-pages
  - plans/features/gherkin-feature-pages
  - guides/authoring
  - guides/consumer-setup
---

# 2026-10-13 — Gherkin feature pages

A site can now publish its Gherkin `.feature` files as documentation. Setting
`gherkin: { sources: ['features'] }` in `defineDocKittyIntegrations` parses each
feature once with `@cucumber/gherkin` and generates one `kind: Specification`
page per feature, plus a hub per directory that holds a published feature, into
`docs/behaviour/`. The pages ride the existing pipeline, so they reach the
sidebar, sitemap, RSS, `llms.txt`, the agent API and glossary auto-linking with no
new plugins. With the option unset, the build output is unchanged apart from a
TOC target-size fix in `toc-rail.css` that every site gets (below). See
[ADR-0046](../adr/0046-gherkin-feature-pages.md) and the
[architecture page](../architecture/gherkin-pages.md).

## What ships

- **Tags become metadata.** Feature-level `@dk:<key>=<value>` tags set the glossary
  context, status, personas, mission and ADR links, `updated`, the auto-link
  opt-out and the agent priority. `@wip` and `@deprecated` set the status, and
  other tags pass through as page tags. A misspelt `@dk:` key warns with a
  suggestion. A `@dk:status` the generator cannot use (a typo in the case, no
  value, or two tags that disagree) makes the page a draft and warns, so a page
  you meant to hide does not go live.
- **Escaped, lint-clean bodies.** Steps render as list items so glossary terms in
  step text get linked. Step text, names and table cells are escaped against
  Markdown, HTML, directives and Markua attributes; descriptions pass through as
  Markdown. The output passes the repo's markdownlint config.
- **`Specification` is a new `kind` and `type` value.** Any page may use it; the
  generated feature pages do.
- **Safe ownership.** Every generated page carries
  `generated.by: "doc-kitty/gherkin"`, and `generated.at` holds a source content
  hash, not a timestamp. Pages whose source is gone are pruned. Output is
  deterministic and only changed files are rewritten, so dev-server restarts
  don't loop. These stop the build before anything is written: an authored file
  in the section (a symlink counts, and so does a symlinked section folder); two
  features that would produce the same page; a feature whose file name produces
  `log` or an index name such as `README`; a syntax error or a missing source
  directory; and, for the scenario index, a page whose `.feature` source is
  missing or has changed since generation. An index basename with a path
  separator or a leading dot is refused.
- **Gate parity and a drift gate.** `validate-frontmatter.mjs` recognises generated
  pages by their `generated.by` stamp. The new `generate-feature-pages.mjs` script,
  shipped as the `dockitty-generate-feature-pages` binary, regenerates the pages or,
  with `--check`, fails on any added, changed, stale or authored path. CI runs it
  as `pnpm validate:features`.
- **A scenario index for agents.** The new `scenarioIndexRoute` export from
  `@spec-kitty/doc-toolkit/routes`, mounted at `/api/scenarios.json`, lists every
  published feature page with its rules, scenarios, anchors, tags, steps and
  examples tables, re-parsed from the `.feature` source. Pass it the same
  `sourceRoot` and `sourceUrlPrefix` as the `gherkin` option. `llms.txt` gains a
  `Scenario index:` line only when at least one published feature page exists, so
  other sites' `llms.txt` is unchanged. Mount the route whenever `gherkin` is on,
  or `llms.txt` links to a page that does not exist.
- **Two new dependencies.** `@cucumber/gherkin` and `@cucumber/messages` are
  installed for every consumer, with the preset on or off.
- **Feature pages in the example's feed.** The example site now lists its feature
  pages in `rss.xml`. A generated page has no date unless the feature carries
  `@dk:updated=<date>`, so its item has no `<pubDate>` and sorts after the dated
  ones.
- **Drafts stay out of hubs.** A `@wip` or `@dk:status=draft` feature still gets
  its page, but no hub lists it, and a directory holding only drafts gets no hub
  at all, so its name isn't published either.

## Changes for every site

The desktop "On this page" links now have a 24px minimum target (WCAG 2.5.8,
axe `target-size`): `toc-rail.css` gives each link `min-height: 24px`. Starlight's
links were about 23px tall, which a densely nested TOC such as a feature page's
Rule → Scenario outline fails. The rule applies to every site with a TOC, with or
without the `gherkin` option, so visual baselines of pages with a TOC shift
slightly. Regenerate them with the "Update a11y baselines" workflow
(`update-a11y-baselines.yml`).

## Limits

A new `.feature` file needs a dev-server restart. Narrative detection
(`As a / I want / So that`) is English-only. Scenario Outlines render once with
their examples table, not expanded per row. Removing the option freezes the
committed pages rather than deleting them. Pass/fail results per scenario are
phase 2, under the QA portal.
