---
title: M5 shipped — diagrams (client-side Mermaid)
description: Author diagrams as ```mermaid fences that render client-side as themed, accessible figures on doc pages and slide decks. Opt-in.
doc_status: active
updated: 2026-08-25
type: Changelog
kind: Changelog
tags: [diagrams, mermaid, accessibility]
related:
  - plans/features/diagrams
  - architecture/diagrams
  - plans/roadmap
---

# 2026-08-25 — M5 shipped: diagrams (client-side Mermaid)

You can now write a diagram as a `` ```mermaid `` fenced code block and have it render
in the browser as a **themed, accessible figure** — on documentation pages and inside
slide decks. Diagrams are **opt-in**: turn them on with
`defineDocKittyIntegrations({ diagrams: true })`, and a site that doesn't use them ships
no diagram code.

## What you get

- **Plain-language metadata.** A small block at the top of the fence, in Mermaid's own
  `%%` comment syntax, carries four optional non-technical fields — `title`,
  `description`, `attribution`, `source`. `description` becomes the figure caption and the
  diagram's accessible description; `title` (or `description`, if you omit `title`) becomes
  the accessible name. A typo in a field name stays a harmless comment.
- **Accessible by construction.** The toolkit injects Mermaid `accTitle`/`accDescr` so the
  rendered SVG names itself, and wraps it in a `<figure role="group">` with a `<figcaption>`.
  The figure and its names are server-rendered, so the meaning is present before — and
  without — JavaScript. Verified against WCAG 2.2 AA on both doc pages and decks, in light
  and dark mode.
- **Themed to your site.** Diagrams pick up the `--dk-diagram-*` colours (now in the Default
  catalog and the brand theme, light and dark) and re-colour on a light/dark toggle.
- **In slide decks too.** The same fence works on a deck's first slide.
- **Light footprint.** Mermaid is bundled (no CDN, no external service) and its code loads
  **only** on pages that actually contain a diagram. With JavaScript off, you still get the
  diagram source and the caption.

## Good to know

- Guaranteed-accessible diagram types in v1: **flowchart, sequence, class**.
- Put a deck diagram on the deck's **first slide** — later slides are hidden until you
  navigate to them, and a hidden diagram can't size itself.
- An `attribution` links to its `source` only when the source is a normal web link
  (`http`/`https`/`mailto` or a relative link); other URL schemes are dropped, so a diagram
  can't smuggle a script link into the page.
- A build-time static-SVG render (zero runtime JavaScript) and PlantUML are a tracked
  follow-up — issue **#13**, "Enhanced diagram support".

## Under the hood

Two decisions of record: **ADR-0023** (a single client render owner; the metadata transform;
the deck render path) and **ADR-0024** (promoting the `--dk-diagram-*` tokens). The
integration owns its own fence transform and is the sole renderer — `astro-mermaid` cannot be
run transform-only, so the ADR-0023 fallback was taken and its runtime dropped.

The mission passed post-spec and post-tasks adversarial squads during planning, and a
post-merge adversarial review before landing — which hardened the source-link handling (URL
scheme allowlist), retired the now-unused `astro-mermaid` dependency, and tightened render
error handling and the light/dark re-render.
