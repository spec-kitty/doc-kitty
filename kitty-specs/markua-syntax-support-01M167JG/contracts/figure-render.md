# Contract: figure render (img → `<figure>` + astro:assets)

The rehype pass that turns a Markua image into an accessible, optimised figure. It
mirrors the existing `src/lib/rehype/diagram-figure.ts` (including its `safeHref`
scheme allowlist and its hand-rolled tree walk — no `unist-util-visit` dependency)
and consumes the attributes the attribute-list plugin attached to the image
(`attribute-list-plugin.md`).

## Rewrite shape

Every image node from `![caption](src)` is rewritten to:

```html
<figure class="dk-figure {align-class} {extra-classes}">
  <img src="{optimised-or-passthrough src}" alt="{alt}" title="{title?}" style="{sizing?}" />
  <figcaption class="dk-figure__caption">{caption}</figcaption>
</figure>
```

- The `<figcaption>` is **omitted** when there is no caption text (an empty-safe
  figure), the same empty-safe rule the diagram figure uses.

## Field sources

| Output | Source | Rule |
|--------|--------|------|
| caption (`<figcaption>`) | `{caption:}` if present, else the **bracket text** of `![caption](src)` | the bracket text is the caption, not the alt (the Markua semantic, US2 sc.1–2) |
| `alt` | `{alt:}` if present, else fallback | fallback is the empty string `alt=""` when the figure already has a caption naming it (so a screen reader does not announce the caption twice); a captionless image with no `{alt:}` also gets `alt=""` and a build warning naming the file (accessibility nudge, never a build failure) |
| `title` | `{title:}` | plain pass-through to the `<img title>` |
| sizing | `{width:}` / `{height:}` percentages | percentage of content width → inline `style` (e.g. `width: 75%`); US2 sc.3 |
| layout | `{align:}` = `left` \| `right` \| `middle` | `align-class` = `dk-figure--left` / `--right` / `--center` (theme CSS); US2 sc.4 |
| extra classes | `{class:}` | appended to the `<figure>` class list |

- Unsupported image attributes (`fullbleed`, `float`, `type`, `format`) are ignored
  upstream by the attribute-list plugin and never reach this pass (C-006, FR-012).

## Ordering (load-bearing — runs BEFORE rehypeImages)

Ground-truthed against `@astrojs/markdown-remark@6.3.11`: the rehype stage order is
… USER rehype plugins → **`rehypeImages`** → `rehypeHeadingIds` → `rehypeRaw`. The
markua figure pass is a **user rehype plugin**, so it runs **before** `rehypeImages`:

- It wraps the `<img>` in the `<figure>` **keeping the `src` intact** and setting the
  markua-derived `alt`/`title`/`style` on the nested `<img>`.
- `rehypeImages` (later) still visits the nested `<img>`, matches it against
  `localImagePaths`/`remoteImagePaths`, and **folds** the `<img>`'s existing
  properties (`alt`/`title`/`style`) into the `__ASTRO_IMAGE_` optimisation marker.
- Running **before** `rehypeImages` is **required**, not merely acceptable: it is what
  lets the markua `alt`/sizing survive into the optimised image. Wrapping *after*
  optimisation would fight the `__ASTRO_IMAGE_` marker and lose those properties.
- **IC-03 spike**: assert `style="width:75%"` (and the `alt`) survive the
  `__ASTRO_IMAGE_` round-trip into the final optimised `<img>`.

## Local vs `http(s)` handling

- **Local path** (`![](palm-trees.jpg)`, `![](images/bar.png)`): the wrapped `<img>`
  is optimised by `rehypeImages` / `astro:assets` at build time. The Markua
  `resources/`-relative convention is met by the **native glob loader resolving the
  reference page-relative** the way every other doc-kitty image resolves (research
  D-05); the requirement is that local figures **optimise correctly**, not a fixed
  on-disk root (US2 sc.5). This risk is lower than first carried — the loader already
  resolves page-relative images natively.
- **Web URL** (`![](https://…)`): passed through as a plain `<img src>` (matched by
  `remoteImagePaths`, unoptimised unless configured). The `src` is validated through
  the same `safeHref` allowlist the diagram figure uses (`http:`/`https:`/`mailto:`/
  relative only) so a `javascript:`/`data:` URI can never reach the DOM as an image
  source.

## Guarantees

- **Accessibility** — every figure carries the correct alt (`{alt:}` or the
  empty-safe fallback) and a caption from the bracket text; asserted directly on the
  fixture corpus (axe + figure/caption assertions), meeting the WCAG 2.2 AA bar
  (NFR-004).
- **No client JS** — the rewrite is build-time; no script is added (NFR-005).
- **Total** — a malformed image line degrades to readable text; a page with no image
  is unchanged (FR-011, FR-012).
