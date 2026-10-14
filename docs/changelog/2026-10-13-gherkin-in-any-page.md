---
title: Gherkin in any page
description: "A gherkin fence renders as a structured scenario on any page, and a ::gherkin directive includes a .feature file or chosen scenarios; errors fail the build."
doc_status: active
updated: 2026-10-13
type: Changelog
kind: Changelog
authors:
  - ivan@spec-kitty.ai
tags: [gherkin, bdd, living-documentation, authoring]
related:
  - adr/0051-gherkin-in-any-page
  - adr/0046-gherkin-feature-pages
  - architecture/gherkin-pages
  - guides/authoring
  - guides/consumer-setup
---

# 2026-10-13 — Gherkin in any page

Gherkin is no longer limited to generated feature pages. With the `gherkin`
option on, a ```` ```gherkin ```` fence in any guide renders as a structured
scenario, and a `::gherkin{src="…"}` directive embeds a `.feature` file that
already lives in the repository, whole or by scenario name or tag. An embed
shows the file the test suite runs, so it cannot drift from it, and a renamed
scenario that a page depends on stops the build. This delivers slices A and B of
[#120](https://github.com/spec-kitty/doc-kitty/issues/120). See
[ADR-0051](../adr/0051-gherkin-in-any-page.md), the
[architecture page](../architecture/gherkin-pages.md#in-page-scenarios) and
[Gherkin in any page](../guides/authoring.md#gherkin-in-any-page).

## What ships

- **Structured fences.** A fence renders like a generated page: headings for the
  feature and each scenario, nested under the page's outline; steps as a bulleted
  list with the keyword in bold; data tables and Examples as tables with column
  headers; doc strings as highlighted code blocks; `#` comments hidden. A fence
  may hold a whole feature, scenarios without a `Feature:` line, or bare steps.
  Inside a list, quote or aside the headings become `role="heading"` paragraphs,
  so the "On this page" list is unchanged. `gherkin raw` keeps a fence as code.
- **Includes.** `::gherkin{src="features/x.feature"}` embeds a whole file;
  `scenario="<exact name>"` picks one scenario; `tags="@smoke @edge"` keeps every
  scenario or Examples row that carries any of the tags, inherited ones included.
  Each include ends in a source line naming the file. Includes read only from
  `includeRoots` (default: `sources`), with symlinks resolved first.
- **`gherkin: true`.** In-page Gherkin needs no source directory, so the option
  now also takes `true`. `sources` turns on generated pages, `fences: false` turns
  the in-page stage off, and `includeRoots` lists where includes may read.
- **Errors fail the build.** A fence that does not parse, or an include whose file,
  scenario or tag is not found, stops `astro build` with one error that lists
  every broken page and line. Astro's content loader on its own only logs such an
  error and builds the page empty. A broken page is never served from the content
  layer's cache, so the next build, or a build after `astro sync`, fails again.
- **Fresh pages.** A page that includes a file is re-rendered when that file
  changes, in a build and in the dev server.
- **Agents see the scenarios.** `/api/pages/<slug>.json` carries each include
  expanded as Markdown and lists it under `includes`.
- **A demonstrator.** The example site's
  [Scenarios in pages](https://spec-kitty.github.io/doc-kitty/guides/scenarios-in-pages/)
  shows every case, including Spec Kitty's own `init.feature` embedded whole. The
  accessibility lane scans it in light and dark mode, and `assert:artifacts`
  fails if a fence leaks as code or an include as text.

## Upgrading

A site that already sets `gherkin: { sources }` will see its ```` ```gherkin ````
fences on authored pages render as scenarios. Mark the ones that should stay code
`gherkin raw`, or set `fences: false`. Sites without the option are unaffected.

## Limits

Step text in a fence or an include is not glossary-linked yet (#113). Quoted step
arguments are code on every surface, generated pages included; text outside
quotes is typeset like the rest of the page. Slide decks
keep fences as code and refuse includes. Includes in `.mdx` pages are not expanded
for agents. Re-rendering on an included file's change rests
on Astro 5 loader internals and is to be re-checked for Astro 7 (#119).
