# Quickstart: Markua syntax support

For an author writing Markua-flavoured Markdown, and for a verifier checking the
feature renders and stays accessible. Everything below is opt-in: a page that uses
none of it renders exactly as plain Markdown.

## Enable the feature

In the site's `astro.config.mjs`, turn the Markua seam on the same way diagrams are
turned on:

```js
integrations: defineDocKittyIntegrations({
  title: 'Doc Kitty Example',
  // …
  markua: true, // opt-in; a Markua-free site keeps zero cost when this is absent/false
}),
```

## An example page exercising every in-scope construct

Save as `example/docs/guides/markua-showcase.md` (doubles as the author doc, FR-014,
and the fixture, NFR-003):

```markdown
---
title: Markua showcase
description: Every in-scope Markua construct on one page.
doc_status: active
updated: 2026-08-29
type: Guide
kind: How-to
---

# Markua showcase

## Asides

A> This is a short aside.

A> # A longer aside
A>
A> It can have multiple paragraphs, and this heading stays out of the table of contents.

{aside}
# A wrapped aside

Wrappers are nestable and take multi-block bodies.
{/aside}

## Callouts — the same warning three ways (identical output)

W> Be careful.

{class: warning}
B> Be careful.

{blurb, class: warning}
Be careful.
{/blurb}

## Callouts with no Starlight equivalent

D> A discussion callout renders through the theme component.

Q> A question callout.

X> An exercise callout.

C> A centered blurb.

## A callout with an icon (mapped) and one that drops gracefully

{icon: fa-lightbulb}
T> A tip with a mapped icon. (A mapped class carrying an icon routes through the theme callout so the icon survives.)

{icon: fa-obscure-name}
T> A tip whose icon is unknown — it drops, with a build warning, and the tip still renders.

## Figures

{alt: "a palm-lined beach", width: "75%"}
![Palm Trees](palm-trees.jpg)

![The original Mac](https://example.com/mac.jpg)

## Crosslink ids

{#intro}
## Introduction

This is ipsum{#ipsum}. See the [introduction](#intro) or the [span](#ipsum).
```

What the reader gets: the two asides and the wrapper render as aside blocks (internal
headings out of the ToC); the three warning forms render as one identical Starlight
`caution`; discussion/question/exercise/center render through the theme callout;
the mapped tip shows its icon and the unmapped one renders without an icon (build
warning); the palm-trees figure is optimised, 75% wide, with "Palm Trees" as its
caption and the `{alt:}` value as its alt text; the Mac web image renders as a figure;
and the two crosslinks resolve to the heading and the span.

## Verify it

Match the gate style already used in this repo (diagrams / glossary):

- **Unit (Vitest, Astro-free):** `pnpm test` — the `markua-*` `*.internal.ts` suites
  cover block detection (adjacent-blockquote, fence-with-`>`, fence-inside-aside),
  the three-way callout equivalence, the `{…}` attribute parse, the class → target
  mapping, the id-precedence rule, and the icon-map lookup (mapped hit + unmapped
  miss-with-warning).
- **Build the example:** `pnpm build` — must exit 0 even with the unmapped icon and
  any deliberately-malformed fixture present (NFR-002). Then `pnpm assert:artifacts`
  asserts the figure/aside/callout markup and that no new client script was added.
- **Accessibility + render (Playwright):** `pnpm test:a11y` — the showcase route is
  added to the a11y lane; axe reports zero new violations, and the figure/caption and
  aside/callout assertions confirm alt text, captions, and that headings inside an
  aside are absent from the on-this-page nav (NFR-004).
- **Base-render fidelity:** the existing Markua-free baselines stay green — a page
  with no Markua construct is byte-identical (NFR-001).

## Portability check

Open the same source on a plain-Markdown host (e.g. the repository view), or build it
with the `markua` preset **off**: the Markua lines (`A>`, `{blurb}`, `{…}`) show as
literal text, never broken markup — no raw `:::` or `{…}` leaks (SC-003). With the
preset **on**, they render as intended. A Markua-free page is byte-identical either way.
