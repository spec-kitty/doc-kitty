# Contract: attribute-list plugin

The small remark plugin that attaches Markua `{…}` attribute lists to their target.
It is the shared substrate for figures (US2) and crosslink ids (US3), and it also
supplies the `{class: …}` / `{icon: …}` / `{#id}` attributes a callout carries. It
operates on mdast and delegates the `{…}` string parse to a pure `*.internal.ts`
helper (the repo's `diagram-meta` / `deck-split` split), so the grammar is
vitest-covered Astro-free.

## Accepted grammar

Two positions, both quoted from the Markua manual:

- **Block form** — an attribute list on its **own line, immediately above** a
  block-level element (image, heading, aside, blurb, figure):

  ```text
  {alt: "a red apple", title: "The Original Mac"}
  ![](mac.jpg)

  {width: "75%"}
  ![Palm Trees](palm-trees.jpg)

  {#bar}
  # Chapter Bar

  {id: foo}
  # Chapter Foo
  ```

- **Inline span form** — an attribute set trailing a span:

  ```text
  Here [is lorem]{#lorem}.
  This is ipsum{#ipsum}.
  ```

  `[text]{…}` attaches to the bracketed text; `word{#id}` (no brackets) attaches to
  the immediately preceding word/token. Both become a `<span>` carrying the id.

### `{…}` syntax accepted

- `{key: value}` pairs, comma-separated: `{alt: "a palm-lined beach", width: "75%"}`.
- Quoted (`"…"`) or bare values; quotes are optional and stripped. Percentages keep
  their `%`.
- The `{#id}` shorthand is equivalent to `{id: id}`.
- Whitespace around keys, `:`, and commas is tolerated.
- A `{…}` line whose content does not parse as an attribute list is **left as
  literal text** (it is ordinary paragraph content) — never an error.

## Keys honoured, per target

The plugin does **not** apply every key everywhere; it honours only the keys valid
for the resolved target and **silently ignores** the rest (FR-012; matches Markua's
own silently-ignored-attribute behaviour).

| Target | Keys honoured | Ignored (examples) |
|--------|---------------|--------------------|
| image (block above an `![]()`) | `alt`, `caption`, `title`, `width`, `height`, `align`, `class`, `id`/`#id` | `fullbleed`, `float`, `type`, `format`, `column-widths` |
| block id (heading / figure / aside / blurb) | `id`/`#id` | everything else |
| span (`[text]{…}` / `word{#id}`) | `id`/`#id` | everything else |
| callout (attached `{class:}` / `{icon:}` / `{#id}`) | `class`, `icon`, `id`/`#id` | everything else |

- Image key behaviour is specified in [`figure-render.md`](./figure-render.md);
  callout `class`/`icon` in [`callout-mapping.md`](./callout-mapping.md) and
  [`icon-map.md`](./icon-map.md).

## Value → `hProperties` mapping

- The plugin writes onto the target node's `data.hProperties` (the mdast → hast
  projection the rest of the pipeline and the figure rehype read), consistent with
  how `mermaidFenceTransform` and `diagram-figure` already drive hast output.
- `id`/`#id` → `hProperties.id` (see the id-precedence rule in `data-model.md`:
  explicit wins; Astro's built-in heading-id pass applies its slug only when no id is
  already set).
- `width`/`height` percentages, `align`, `class` are carried for the figure rehype to
  turn into sizing/layout/class (they are **not** applied to a bare heading).
- The consumed attribute-list paragraph is **removed** from the tree so it never
  renders as literal `{…}` text.

## Span handling

- `[text]{#id}` → a `<span id="…">text</span>` replacing the `[text]` + `{#id}` run.
- `word{#id}` → a `<span id="…">word</span>` around the preceding token.
- Only `id`/`#id` is honoured on a span (per the table); other keys on a span are
  ignored.

## Attribute list above a wrapper container

An attribute list immediately above a `{aside}` / `{blurb}` open line attaches to the
**container directive** the normaliser emits for that wrapper, not to a stranded
preceding paragraph. Because the normaliser runs first (it turns the wrapper lines
into a `containerDirective`), this plugin — running after on the same mdast — sees the
attribute-list paragraph immediately followed by that container and writes its
`id`/`class` onto the container's `hProperties`. The `{#id}` case gives the whole
aside/blurb an explicit anchor; a `{class: …}` above a `{blurb}` supplies its callout
class (reconciled with `normaliser-block-detection.md`'s three-way-equivalence rule).

## Guarantees

- **Silently-ignored unknown keys** — an unsupported attribute never errors and never
  fails the build (NFR-002); `{fullbleed: true}` above an image applies nothing.
- **Total and local** — a malformed `{…}` degrades to text; a page with no attribute
  list is unchanged (FR-011).
- **Deterministic id precedence** — an explicit id always wins over the auto-generated
  one (C-005).
