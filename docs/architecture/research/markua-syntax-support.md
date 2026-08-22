---
title: Supporting Markua syntax
description: "How doc-kitty could support a curated subset of Markua (images, ids, asides, blurbs, icons) through remark, rehype, and Starlight."
status: active
updated: 2026-08-22
type: Architecture
tags: [markua, markdown, remark, starlight, images, asides]
related:
  - architecture/research/astro-markdown-extensions
  - adr/0008-swappable-theme-layer
  - adr/0009-finalize-metadata-contract
---

# Supporting Markua syntax

Markua is the book- and course-authoring Markdown dialect used by Leanpub,
written by Peter Armstrong and built on CommonMark. This note looks at whether a
curated subset of Markua could render inside doc-kitty's Astro + Starlight
pipeline, and what it would take. It builds on the general picture in
[Astro Markdown extensions](./astro-markdown-extensions.md); the mechanisms there
(remark-directive, `astro:assets`, Starlight asides, MDX components) are the
building blocks, so this note does not re-explain them.

The syntax below is quoted from the Markua spec (`master`, Markua 0.30) and the
Markua manual (`v_0_10`). See References. One structural fact shapes everything:
Markua 0.30 generalised callouts into a single blurb block with a `class`
attribute, while the manual still documents the single-letter shorthands. Both
are in the wild, so the subset has to accept the union.

## The parsing problem up front

Two Markua constructs are not CommonMark, so remark will not parse them natively:

- **Line-prefix blocks.** `A>`, `B>`, `W>`, and the rest start a line with a
  letter followed by `>`. CommonMark blockquotes require `>` at line start, so
  remark reads `W> text` as a paragraph whose literal text is "W> text". Nothing
  turns it into a block.
- **Attribute lists.** `{width: "75%"}`, `{#id}`, `{class: warning}` on their own
  line, or `[span]{#id}` after a span. remark treats a `{...}` line as an
  ordinary paragraph.

So supporting Markua is mostly about getting these two into the AST. Everything
downstream (asides, callouts, images, ids, icons) reuses mechanisms doc-kitty
already plans to have.

## Image handling

Markua syntax (quoted):

```
![](palm-trees.jpg)
![Palm Trees](palm-trees.jpg)
![alt text for accessibility](image.png "Figure Title")
```

```
{alt: "a red apple", title: "The Original Mac"}
![](mac.jpg)
```

```
{width: "75%"}
![Palm Trees](palm-trees.jpg)
```

```
{float: right}
![Palm Trees](palm-trees.jpg)
```

Key points from the spec and manual:

- Text in the square brackets is the **figure caption**, not the alt text. Alt
  text is set only in the attribute list (`{alt: "..."}`), or from the caption
  when the `alt-title` document setting allows it.
- Images are always inserted as figures. Local resources are referenced relative
  to a `resources/` directory (`![](images/bar.png)` resolves under
  `resources/`); web `http(s)` URLs are also allowed.
- Image attributes: `width` and `height` are a percentage of the content area
  (`{width: 75%}`, quotes optional); `align` is `left | right | middle`; `float`
  is `left | right | inside | outside`; `fullbleed` is `true | false`. `caption`,
  `class`, `title`, `type`, `format` apply to any figure.

Support mechanism: a remark attribute-list plugin (see recommendation) attaches
`{...}` values to the following image node. A rehype pass then rewrites the
`img` into a `<figure>` and hands the source to `astro:assets` `<Image>` /
`<Picture>` for optimisation, mapping `width`/`height` percentages to inline
style, `align`/`float` to theme CSS classes, the bracket text to `<figcaption>`,
and `{alt:}` to the real `alt`. There is no real npm plugin that does the Markua
image contract; `astro:assets` and a small rehype step do.

Effort: medium. Risks: `astro:assets` optimises local paths at build time, so the
`resources/`-relative convention must be reconciled with Astro's asset resolution
(imported assets versus `public/`). `float` is layout-only and, per the manual,
best avoided; `fullbleed` has no clean web analog and is a candidate to drop.

## Crosslinks

Markua syntax (quoted):

```
{id: foo}
# Chapter Foo
```

```
{#bar}
# Chapter Bar
```

```
Here [is lorem]{id: lorem}.

This is ipsum{#ipsum}.
```

Markua sets an explicit id with the `{#id}` shorthand or `{id: foo}`, either
above a block (heading, figure, aside, blurb) or after a span. Linking to that id
uses ordinary Markdown links; the manual links to its own anchors this way, for
example `[table](#resource-types-and-formats)`. So the crosslink itself is
CommonMark; only the id-setting syntax is the extension.

Support mechanism: `rehype-slug` already generates heading ids, which covers the
common "link to a heading" case with no Markua syntax at all. The `{#id}` /
`{id:}` forms need the same attribute-list plugin as images, writing `id` onto
the target node's `hProperties`; `[span]{#id}` writes an `id` onto a `<span>`.
Standard `[text](#id)` links then resolve.

Relationship to doc-kitty's `related` frontmatter: that field is page-level and
lives in metadata (per ADR-0009). Markua crosslinks are in-content anchors to
headings, figures, and spans within or across pages. They are complementary, not
a replacement; `related` connects documents, Markua ids connect points inside
them.

Effort: low. Risks: id collisions between `rehype-slug` output and explicit
`{#id}` values need a defined precedence (explicit wins).

## Asides

Markua syntax (quoted):

```
A> This is a short aside.
```

```
A> # A Longer Aside
A>
A> This is a longer aside.
A>
A> It can have multiple paragraphs.
```

```
{aside}
# A Note About Asides

This is a longer aside.
{/aside}
```

An aside is `A>` per line, or an `{aside}` ... `{/aside}` wrapper for long ones.
Headings inside an aside stay out of the table of contents.

Support mechanism: preprocess the `A>` run and the `{aside}` wrapper into a
remark container directive (`:::aside`), then render it as a Starlight
`<Aside>` (the `note` variant is the closest default) or a doc-kitty aside
component owned by the theme (ADR-0008). This reuses the remark-directive path
the prior note already recommends.

Effort: low to medium. Risks: `A>` runs must be detected without consuming
adjacent blockquotes or fenced code that happens to contain a `>`; the wrapper
form is nestable and needs balanced open/close handling.

## Callout blocks

Markua syntax (quoted). Generic blurb, and the class form:

```
{class: warning}
B> This is a warning!
```

```
{blurb, class: warning}
This is a warning!
{/blurb}
```

Single-letter shorthands, quoted from the manual's own table:

| Sugar | Equivalent to a `B>` with |
|-------|---------------------------|
| `D>`  | `{class: discussion}`     |
| `E>`  | `{class: error}`          |
| `I>`  | `{class: information}`     |
| `Q>`  | `{class: question}`       |
| `T>`  | `{class: tip}`            |
| `W>`  | `{class: warning}`        |
| `X>`  | `{class: exercise}`       |

The de facto blurb classes are `center`, `discussion`, `error`, `information`,
`tip`, `warning`. `C>` is sugar for a centered blurb (`{class: center}`). `B>` is
the generic blurb with no class.

Mapping to Starlight, which ships four aside types (`note`, `tip`, `caution`,
`danger`):

| Markua                    | Target                                  |
|---------------------------|-----------------------------------------|
| `T>` tip                  | Starlight `tip`                         |
| `W>` warning              | Starlight `caution`                     |
| `E>` error                | Starlight `danger`                      |
| `I>` information          | Starlight `note`                        |
| `A>` aside                | Starlight `note` or theme aside style   |
| `D>` discussion           | doc-kitty callout component (no Starlight type) |
| `Q>` question             | doc-kitty callout component             |
| `X>` exercise             | doc-kitty callout component             |
| `B>` generic / `C>` center | theme callout, `center` as a CSS class  |

Markua has more callout types than Starlight has aside types. The three without a
Starlight equivalent (discussion, question, exercise) need a doc-kitty callout
component in the curated theme surface (ADR-0008), which is also the cleaner home
for the whole set so that styling and icons stay consistent.

Support mechanism: the same preprocessing step normalises every shorthand
(`W>`, `{class: warning}` + `B>`, and `{blurb, class: warning}`) to one directive
per class (`:::warning`), which then renders to a Starlight aside or the theme
callout via the mapping above.

Effort: medium. Risks: three-way syntactic redundancy for the same output means
the normaliser must treat all three input forms identically; the extra classes
need theme styling that Starlight does not provide.

## Icon usage

Markua syntax (quoted from the spec):

> For example, Leanpub supports an `icon` attribute on blurbs.

`icon` is an extension attribute on blurbs, carrying a Font Awesome name; an
unsupported attribute is silently ignored. Separately, Markua supports Font
Awesome via the emoji shorthand with a mandatory `fa-` prefix: the Leanpub logo
is `:fa-leanpub:`.

Support mechanism: map `{icon: fa-name}` to Starlight's `<Icon>` or a theme icon
component. Starlight ships its own icon set, not Font Awesome, so a name-mapping
table is required, with a defined fallback (drop the icon, or use a default per
callout class) when a Font Awesome name has no Starlight equivalent. The
`:fa-name:` inline form would need an emoji-style remark replacement against the
same table.

Effort: medium to high, driven by the size and upkeep of the name map rather than
the wiring. Risks: Font Awesome has thousands of names; only a small curated
subset is worth mapping, and the two icon vocabularies do not line up one to one.

## Options and recommendation

The realistic ways to get the two non-CommonMark constructs into the AST:

- **(a) Custom remark plugins that parse Markua directly.** A micromark syntax
  extension for the line-prefix blocks plus a remark plugin for attribute lists.
  Most faithful and robust against edge cases, and the most work; micromark
  extensions are non-trivial to write and maintain.
- **(b) A preprocessing transform that compiles the Markua subset into
  remark-directive syntax (and attribute handling) before the remark pass.**
  Convert `A>` / `W>` / `{blurb}` runs into `:::` container directives, and keep a
  small remark plugin for `{key: value}` attribute lists (images and ids). Then
  everything flows through the directive and attribute mechanisms the prior note
  already recommends.
- **(c) Existing Markua-to-mdast tooling.** There is none that is mature. The
  closest, `@humanwhocodes/markdown-it-markua-aside`, handles only asides and
  blurbs and targets markdown-it, not remark, so it does not fit Astro's
  pipeline. `remark-directive` and `remark-attributes` are generic building
  blocks, not Markua parsers. The Markua tools that do exist (`leanpubgen`,
  `ox-leanpub`, `markua-docs-addon`) all *write* Markua as output; none read it
  into an AST. So the direction we need is unserved.

Recommendation: **(b)**. Split the work: a preprocessing normaliser for the
line-prefix and wrapper blocks that emits remark-directive containers, plus one
small remark attribute-list plugin for `{...}` on images and ids. This keeps the
blast radius small, reuses the remark-directive and `astro:assets` mechanisms
doc-kitty already intends to adopt, and lets the extra callout types and icons
live in the theme's curated component surface (ADR-0008), with per-kind rendering
governed by ADR-0009. Reserve option (a) for later if the preprocessing proves
too fragile against code blocks and nesting.

## Portability and fit

Markua is superimposed on Markdown: it is a superset of CommonMark and GFM. A page
written in plain CommonMark or GFM never touches Markua and renders everywhere,
including the repository host, exactly as before. The support is invisible until an
author opts into a Markua construct.

The portability cost is therefore opt-in and local, not blanket. Only the
Markua-specific lines (`A>`, `{blurb}`, `{...}`) are pipeline-only; on the host they
show as raw text, as any non-CommonMark syntax would. Markua does not lower the
portability of base content; it adds richer constructs that render through the
doc-kitty pipeline when used, and fall back to plain text when they are not.

This is a neater fit than the alternatives. Inline HTML clutters the source and is
easy to get wrong; MDX couples content to a component set and stops the file being
plain Markdown. Markua stays Markdown-native and degrades to readable text rather
than to broken markup. That graceful degradation, plus the opt-in portability
profile, is the case for adopting the subset.

## Scope (in / out)

Positioning: doc-kitty supports Markua for **docsites and presentations only**. It
gives authors Leanpub syntax compatibility through syntax alignment, but it does
not build a book or document pipeline; that would compete with Leanpub. See
[Example content from ars-rethorica](./ars-rethorica-book-example.md).

In scope (the subset that matches doc-kitty's needs):

- Images: `![caption](path)`, `{alt:}`, `{title:}`, `{width:}`, `{height:}`,
  `{align:}`, `{caption:}`, `{class:}`, figure and caption rendering via
  `astro:assets`.
- Crosslink ids: `{#id}` / `{id:}` on blocks, `[span]{#id}` on spans, and
  standard `[text](#id)` links plus `rehype-slug` heading ids.
- Asides: `A>` and `{aside}` ... `{/aside}`.
- Callouts: `B>` and the `D> E> I> Q> T> W> X>` shorthands, `{class: ...}` and
  `{blurb, class: ...}`, mapped to Starlight asides and theme callouts.
- Icons: `{icon: fa-name}` on callouts, via a curated Font Awesome to Starlight
  name map.

Out of scope (Markua's wider book-authoring dialect):

- Resources other than images: audio, video, math figures, and external code
  samples via `![](hello.rb)`.
- Quizzes and interactive exercises, and definition lists.
- Document settings blocks, directives (`{default lang: ...}`, audio voice), and
  the `soft-breaks` behaviour.
- Parts and multi-file manuscript concatenation.
- Layout-only image attributes with no clean web analog: `fullbleed`, and
  `float: inside | outside`.
- Table attributes such as `column-widths`, and inline `:fa-name:` icons (revisit
  only if the mapping table already exists).

## References

- Markua spec (`master`, Markua 0.30): <https://github.com/markuadoc/markua-spec>,
  spec text <https://raw.githubusercontent.com/markuadoc/markua-spec/master/spec.txt>
- Markua manual (`v_0_10`):
  <https://raw.githubusercontent.com/markuadoc/markua-manual/v_0_10/manuscript/manuscript.txt>
- Markua directives with attributes:
  <https://raw.githubusercontent.com/markuadoc/markua-spec/master/directives-with-attributes.md>
- `remark-directive`, `remark-attributes`, and
  `@humanwhocodes/markdown-it-markua-aside` on npm (ecosystem building blocks and
  the closest existing Markua tooling).
