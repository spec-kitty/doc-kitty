---
title: Astro Markdown extensions
description: How Astro and Starlight support custom Markdown syntax — callouts, rich images, and components.
doc_status: active
updated: 2026-08-22
type: Architecture
kind: Explanation
tags: [markdown, mdx, remark, rehype, starlight, images]
related:
  - context/convention
  - adr/0008-swappable-theme-layer
  - adr/0009-finalize-metadata-contract
---

# Astro Markdown extensions

This note records how Astro handles "shortcodes" and custom Markdown syntax
(callouts, rich images, embeds), so the theme and content decisions can cite it.
It is research, not the present-state design.

Astro has no Hugo-style shortcodes as a named feature. It offers two layers that
together cover the same ground, and Starlight adds a ready-made set on top.

## The two mechanisms

### MDX components

`@astrojs/mdx` lets you use real components inside Markdown: `<Callout
type="warning">…</Callout>`, `<Figure>`, `<YouTube id="…" />`. This is the closest
thing to rich shortcodes and the most powerful option. The cost is portability: an
`.mdx` file no longer renders as plain Markdown on a repository host, and the
content couples to the component set.

### remark / rehype plugins

Astro's Markdown pipeline is unified: remark works the Markdown AST, rehype works
the HTML AST. Plugins register in `astro.config` as `remarkPlugins` /
`rehypePlugins`. This is where syntax is extended without MDX.

The key plugin is **`remark-directive`**, the shortcode analog for plain `.md`. It
parses a generic directive syntax; a small plugin maps each directive to HTML
(with classes the theme styles) or to a component:

- container: `:::warning` … `:::`
- leaf: `::figure{src=… caption=…}`
- inline: `:abbr[HTML]{title="…"}`

GFM (tables, task lists, strikethrough, autolinks) is on by default.

## Callouts and warning blocks

- **Starlight ships asides**: `:::note`, `:::tip`, `:::caution`, `:::danger`, with
  optional custom titles (`:::note[Heads up]`), plus an `<Aside>` component for
  MDX. On a Starlight site these are the built-in quote and warning blocks.
- For plain `.md` with project-specific types and styling, `remark-directive` plus
  a small mapping plugin renders `:::warning` to a styled `<aside>`.

## Rich images

- **`astro:assets`** provides `<Image>` and `<Picture>` (responsive, format
  conversion, lazy loading). Local images written with plain `![]()` in Markdown
  are optimized automatically; MDX gives explicit control for art direction and
  `srcset`.
- Figures, captions, lightbox, and galleries are not built in. Two routes: an MDX
  `<Figure>` component, or a rehype plugin that rewrites `![alt](src "title")` into
  `<figure><img><figcaption>`. Zoom and lightbox are a small client component or a
  rehype pass over any `img`/`svg`.

## Starlight's ready-made components (MDX)

`<Card>` / `<CardGrid>`, `<Tabs>` / `<TabItem>`, `<Steps>`, `<FileTree>`,
`<LinkCard>`, `<Badge>`, `<Icon>`, and Expressive Code for rich code blocks
(titles, line highlighting, diffs, frames).

## `.md` versus `.mdx`

- Plain `.md`: no components; syntax is extended only through remark/rehype
  (directives, GFM, custom AST transforms). Stays portable and renders on the
  repository host.
- `.mdx`: full component power, but content couples to the component set and does
  not render as plain Markdown on the host.

## Implications for doc-kitty

The tension is portability. The convention leans on `.md` that renders on the
repository host (README-as-index, human-first). The convention-friendly path:

- **Plain `.md` + `remark-directive`** for callouts and lightweight rich blocks,
  so pages stay portable and agent-readable.
- **`astro:assets`** for image optimization; a directive or a theme-provided
  `<Figure>` for captions and lightbox.
- **MDX reserved** for pages that genuinely need interactivity, kept behind the
  theme layer.

This connects to two existing decisions. The theme's curated component surface
([ADR-0008](../../adr/0008-swappable-theme-layer.md)) is the natural home for a
doc-kitty callout and figure component set, and `kind`-drives-layout
([ADR-0009](../../adr/0009-finalize-metadata-contract.md)) is where per-kind rich
rendering lives. A supported rich-content syntax is a small addition to the theme
and metadata contract, best specified with the component system (M2).

## Caveat

Astro and Starlight move quickly. Confirm version-sensitive specifics against the
pinned versions when M2 builds this: GitHub alert syntax (`> [!NOTE]`) support, the
current Starlight component list, and the `astro:assets` API.

## References

- Astro Markdown and MDX guides (docs.astro.build).
- Starlight components and asides (starlight.astro.build).
- `remark-directive` (the directive syntax and plugin API).
