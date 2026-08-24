# Quickstart: authoring a slide deck

A deck is **plain Markdown**. Drop a file under `presentations/`, set `kind: Presentation`,
and the build renders a reveal.js deck. No `<section>`s, no reveal boot code, no deck `<head>`.

## Minimal deck

```markdown
---
title: My First Deck
description: A one-line summary for the title slide and social card.
kind: Presentation
type: Presentation
doc_status: active
---

Opening remarks — this content, before the first `##`, becomes the **title slide**
(built from title / description / hero_image).

## First topic

- A point
- Another point

## Second topic

### A detail under Second topic
`###` makes a **vertical slide** (navigate down). The `##` above becomes a **stack**.

### Another detail
More down-navigation.

---

An image-only or divider slide: a body `---` forces a **headingless slide**
(it gets an `aria-label`, and does *not* render as `<hr>` on a deck).
```

## Speaker notes and per-slide controls (optional, invisible)

```markdown
## A themed slide
<!-- .slide: data-background-color="#0D0E11" -->

A bullet that appears on click
<!-- .element: class="fragment" -->

Note: Only the presenter sees this, in speaker view.
```

- `<!-- .slide: … -->` sets attributes on the slide.
- `<!-- .element: … -->` attaches classes/attributes to the **preceding** block (a
  `fragment` is a stepped reveal).
- `Note:` becomes a presenter-only note.
- A typo in a directive **warns** in the build log; it never breaks the build.

## What you get

- An interactive reveal.js deck at `/presentations/<your-file>/`, themed by the active brand.
- With JavaScript off (or reduced motion), the same deck as a readable, scrollable document.
- A `?print-pdf` export link, and the deck listed on the presentations overview page.
- The deck in sitemap, `llms.txt`, the agent API, and site search — but **not** the RSS feed.

## Rules to know

- The file must live **under `presentations/`**. A `kind: Presentation` file elsewhere is a
  build error.
- `##` = horizontal slide, `###` = vertical slide (a stack forms under a `##` with `###`
  children), `---` = headingless slide, `####`+ stay inside the current slide.
- Set `doc_status: draft` to keep a work-in-progress deck out of search, sitemap, and feeds.
