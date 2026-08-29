---
title: Markua syntax support (subset) — Leanpub-authored Markdown renders in the docsite
description: Opt-in rendering of a curated Leanpub Markua subset — asides, callouts, figures, crosslink ids, icons — via Astro remark/rehype; plain Markdown is unchanged.
doc_status: active
updated: 2026-08-29
type: Changelog
kind: Changelog
tags: [markua, markdown, remark, rehype, callouts, asides, figures, accessibility]
related:
  - architecture/research/markua-syntax-support
  - architecture/markua
  - adr/0030-markua-preprocess-to-directive
---

# 2026-08-29 — Markua syntax support (subset)

[Markua](https://leanpub.com/markua) is the Markdown dialect Leanpub uses for books and
courses. It is a superset of CommonMark, so a plain-Markdown page never touches it — but
authors bringing Leanpub-authored Markdown into doc-kitty hit a handful of constructs
(asides, callouts, figure images, crosslink ids, callout icons) that plain Markdown
ignores or shows as literal text. This slice renders a **curated subset** of those
constructs so those pages read as their authors intended.

Support is **opt-in**: a page renders Markua only when the site enables the `markua: true`
preset (the same shape as the existing `diagrams` preset). With the preset off, Markua
lines degrade to plain readable text and every page is byte-identical to before — the
feature costs nothing until a site opts in.

## What renders

- **Asides and callouts.** `A>` asides and the `B>`/`C>`/`D>`/`E>`/`I>`/`Q>`/`T>`/`W>`/`X>`
  callout shorthands, plus the longer `{aside}…{/aside}` and `{blurb, class: …}…{/blurb}`
  wrapper forms and the `{class: …}` + `B>` form. All three input forms for a class render
  identically. `tip`/`warning`/`error`/`information` map to Starlight's native asides;
  the six classes with no Starlight equivalent (`aside`, `discussion`, `question`,
  `exercise`, generic, `center`) render as a doc-kitty theme callout, styled by a new
  `--dk-callout-*` token family.
- **Figure images.** `![caption](src)` renders as a `<figure>` whose bracket text is the
  caption; `{alt: …}` sets the real alt text; `{width:}`/`{height:}`/`{align:}`/`{class:}`
  apply. Local images are optimised through `astro:assets` and web URLs pass through.
- **Crosslink ids.** `{#id}` / `{id: …}` above a block and `[span]{#id}` on a span set
  explicit anchor ids that ordinary `[text](#id)` links resolve to; an explicit id wins
  over an auto-generated heading id.
- **Callout icons.** `{icon: fa-name}` shows a mapped icon via a curated Font Awesome →
  Starlight seed map; an unmapped name drops the icon (the callout still renders) and logs
  a build warning — an unknown icon never fails the build.

## How it works

Ratified in [ADR-0030](../adr/0030-markua-preprocess-to-directive.md): a preprocessing
normaliser compiles Markua's line-prefix runs and `{aside}`/`{blurb}` wrappers into
`remark-directive` containers at the mdast level, and a small remark attribute-list plugin
attaches `{…}` values to images and ids. Everything downstream reuses machinery the site
already has — `remark-directive`, `astro:assets`, Starlight's own `remarkAsides`, and
Astro's built-in heading-id pass — so **no new dependencies** were added.

The theme callouts are emitted as raw hast (mirroring how diagrams emit a `<figure>`),
not as an Astro component: the Starlight components map is fixed at four carriers
(ADR-0013/0015), so a remark/rehype plugin cannot mount a component on a plain `.md`
page. A single `remark-directive` owner is shared between the glossary and Markua seams,
and the Markua integration is registered before Starlight so its directives reach the
native aside renderer. Headings inside a callout are demoted to `<p role="heading">` so
they stay out of the on-this-page nav while remaining accessible.

## Verification

116 unit tests (vitest) cover the normaliser (including the load-bearing fence- and
blockquote-safety cases), the callout mapping, the attribute-list plugin, figures, the
icon seed map, crosslink precedence, and ToC demotion. A full construct × input-form
showcase corpus builds with `markua: true` (35 pages, clean build), and a Playwright a11y
lane asserts three-form equivalence, every callout variant, the figure `astro:assets`
round-trip, and ToC exclusion — passing axe in both colour modes. Build-artifact gates
lock the load-bearing behaviours: the ordering that keeps native asides working, the
figure sizing surviving optimisation, an unknown icon leaving the build green with a
warning, and a 35-row coverage matrix. A late integration check caught (and fixed) a
paragraph-handling defect that would have dropped figures and inline links on any page
that also used a callout — the kind of gap that only surfaces once the whole seam runs
together.

## Scope

- **Out of scope (unchanged):** full Markua and any book/manuscript content type;
  non-image resources (audio, video, math, external code samples); quizzes and definition
  lists; document-settings blocks; multi-file manuscript concatenation; layout-only image
  attributes with no web analog (`fullbleed`, `float: inside|outside`); table attributes;
  and inline `:fa-name:` icons.
- Author-facing documentation of the supported subset and its limits lives at
  [Markua support](../architecture/markua.md).
