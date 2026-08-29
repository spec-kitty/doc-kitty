# Data Model: Markua syntax support (subset)

This mission adds **no persisted store** and **no new frontmatter field**. The
"data" is Markua text inside a `docs`-collection Markdown page and the in-memory
mdast/hast the transform annotates and rewrites at build time. The entities below
are structural — the shapes the normaliser, the attribute-list plugin, the callout
mapping, and the figure rehype pass carry between stages.

## Markua construct (the umbrella)

- **What**: an opt-in syntax unit the subset recognises — aside, callout, figure
  image, crosslink id, or callout icon — with one or more author input forms and a
  single canonical rendered target.
- **Fields**: `kind` (`aside` | `callout` | `figure` | `crosslink-id` | `icon`) ·
  `input-forms` (the accepted author syntaxes) · `rendered-target` (the one output).
- **Invariants**: a page using **no** construct renders byte-identically to today
  (FR-011); an unrecognised or malformed construct degrades to readable text, never
  broken markup, and never fails the build (FR-012, NFR-002); the three input forms
  of one callout class produce identical output (FR-004).

| kind | input forms | canonical target |
|------|-------------|------------------|
| aside | `A>` run · `{aside}…{/aside}` | theme callout hast `dk-callout--aside`; internal headings out of the ToC |
| callout | `T>W>E>I>D>Q>X>C>B>` shorthand · `{class: …}`+`B>` · `{blurb, class: …}…{/blurb}` | Starlight native aside (4 mapped classes, no attributes) or theme callout hast `dk-callout--{variant}` (the rest, and any mapped class carrying `{#id}`/`{icon:}`) |
| figure | `![caption](path)` (+ attribute list) | `<figure>`+`<figcaption>` via `astro:assets` |
| crosslink-id | `{#id}`/`{id: …}` above a block · `[span]{#id}` · `word{#id}` | `id` on the target's `hProperties` |
| icon | `{icon: fa-name}` on a callout | Starlight icon on the callout, or graceful drop + warning |

## Callout class

- **What**: the class that selects a callout's rendered target and styling.
- **Fields**: `class` (one of the nine below) · `target` (`starlight-aside` |
  `theme-callout`) · `starlight-variant` (for the mapped four) · `theme-modifier`
  (CSS class for the theme-callout four) · `default-icon` (optional).
- **Invariant**: every class resolves to exactly one target; an unknown class in a
  `{class: …}` value degrades to the generic `B>` behaviour rather than erroring.

### Callout-class → target mapping (full table)

| Markua class | Shorthand | Target | Rendered as |
|--------------|-----------|--------|-------------|
| tip | `T>` | Starlight native aside | `containerDirective` `tip` → Starlight `remarkAsides` renders `tip` |
| warning | `W>` | Starlight native aside | `containerDirective` `caution` → Starlight `caution` |
| error | `E>` | Starlight native aside | `containerDirective` `danger` → Starlight `danger` |
| information | `I>` | Starlight native aside | `containerDirective` `note` → Starlight `note` |
| aside | `A>` / `{aside}` | theme callout hast | `<aside class="dk-callout dk-callout--aside">` + `--dk-callout-*` (`:::aside` is **not** a native Starlight type); headings kept out of ToC |
| discussion | `D>` | theme callout hast | `<aside class="dk-callout dk-callout--discussion">` + `--dk-callout-*` |
| question | `Q>` | theme callout hast | `<aside class="dk-callout dk-callout--question">` + `--dk-callout-*` |
| exercise | `X>` | theme callout hast | `<aside class="dk-callout dk-callout--exercise">` + `--dk-callout-*` |
| center | `C>` / `{class: center}` | theme callout hast | `<aside class="dk-callout dk-callout--center">` + `--dk-callout-*` |
| generic | `B>` (no class) | theme callout hast | `<aside class="dk-callout dk-callout--generic">` + `--dk-callout-*` |

> **One emission owner, two vehicles.** The markua remark plugin (WP04) emits **all**
> callout DOM. The four mapped classes emit a `containerDirective` Starlight's native
> `remarkAsides` consumes (doc-kitty does **not** reimplement aside markup); the six
> theme classes emit **raw hast** (`<aside class="dk-callout dk-callout--{variant}">`,
> mirroring `diagram-figure.ts`), styled by `--dk-callout-*` tokens in `theme.css` —
> **not** a `.astro` component (the Starlight `components` map is frozen at four
> carriers, ADR-0013/0015, so no directive→component seam exists; a `Callout.astro`
> would be dead code and a split-brain second DOM copy). The native path works only
> because markua plugins run **before** Starlight's `remarkAsides` (config-ordering, C).
>
> **Attribute tradeoff (pinned).** Starlight's `remarkAsides` rebuilds a mapped
> directive as a fresh aside, **discarding** its attributes/`hProperties`. So a
> mapped-class callout that carries `{#id}` or `{icon: …}` **routes to the theme-callout
> hast instead** of the native aside, so the id/icon survives (see
> `contracts/callout-mapping.md` and `contracts/icon-map.md`). A mapped callout with
> no attributes takes the native-aside path.
>
> Normalisation: `W>`, `{class: warning}`+`B>`, and `{blurb, class: warning}` all
> normalise to the single `warning` class before mapping (FR-004). The same holds
> for every class with a shorthand.

## Attribute list

- **What**: a `{key: value}` / `{#id}` block written on its own line **above** a
  block-level element, or a `{…}` set trailing an inline **span** (`[span]{…}` or
  `word{#id}`), whose values attach to that target.
- **Fields**: `raw` (the source `{…}`) · `entries` (parsed key→value pairs, plus a
  bare `#id` shorthand) · `target` (`image` | `block-id` | `span` | `callout`).
- **Invariants**: only the keys honoured for the target apply; an unsupported key is
  **silently ignored** (matching Markua's own behaviour — FR-012 edge case,
  e.g. `fullbleed`); an unbalanced or malformed `{…}` degrades to literal text.

### Attribute → behaviour, for images

| Attribute | Honoured on | Behaviour |
|-----------|-------------|-----------|
| `alt` | image | the real `alt` text on the `<img>` (US2 sc.2) |
| `caption` | image | overrides the bracket text as `<figcaption>` |
| `title` | image | `title` attribute on the `<img>` |
| `width` | image | percentage of content width → inline sizing (US2 sc.3) |
| `height` | image | percentage of content width → inline sizing |
| `align` | image | `left`/`right`/`middle` → figure layout class (US2 sc.4) |
| `class` | image | extra CSS class(es) on the `<figure>` |
| `id` (`{#id}`/`{id:}`) | image / any block | explicit anchor id (see id precedence) |
| *anything else* (`fullbleed`, `float`, `column-widths`, …) | — | silently ignored (out of scope, C-006) |

- **Caption vs alt (the semantic that differs from plain Markdown)**: the bracket
  text in `![caption](path)` is the **caption**, not the alt. `alt` is set only by
  `{alt: …}`; when absent, the `<img>` alt falls back per
  [`contracts/figure-render.md`](./contracts/figure-render.md) (empty for a
  decorative figure whose caption already names it, so it is never announced twice).

## Icon map entry

- **What**: a curated Font Awesome name → Starlight icon name pair.
- **Fields**: `fa` (the `fa-…` name authors write) · `starlight` (the Starlight
  `<Icon>` name it maps to).
- **Invariant**: **absence** of an entry triggers graceful drop — the callout renders
  without an icon and the build emits a warning naming the unmapped `fa-` name; the
  build exits 0 (FR-010, NFR-002). The map is a small seed set designed to grow
  ([`contracts/icon-map.md`](./contracts/icon-map.md)).

## Id precedence rule

- **Rule**: an explicit `{#id}`/`{id: …}` (block) or `[span]{#id}`/`word{#id}` (span)
  id **deterministically wins** over the auto-generated heading id on collision
  (C-005, US3 sc.3). The attribute-list plugin writes `id` onto the target's
  `hProperties`; Astro's built-in `rehypeHeadingIds` (which runs **last**, after the
  user rehype plugins) assigns a slug **only when `node.properties.id` is not already
  a string** (`rehype-collect-headings.js:52`), so a heading with `{#overview}` keeps
  `overview` even when the slugger would also produce `overview`. This is **native
  and proven** against `@astrojs/markdown-remark@6.3.11` — no `rehype-slug`
  dependency and no ordering shim is required.
- **No-syntax case**: a heading with no Markua id syntax still receives its
  auto-generated anchor exactly as today (FR-008).
- **Resolution**: standard `[text](#id)` Markdown links resolve to whichever id
  (explicit or auto) landed on the target; the crosslink syntax itself is CommonMark.

## Structural flow (per page)

| Stage | Reads | Writes |
|-------|-------|--------|
| normaliser | Markua line-prefix + wrapper blocks | `:::directive` containers (one per class), attributes carried as directive attributes |
| attribute-list plugin | `{…}` paragraphs / inline spans | `hProperties` on the following block / a `<span id>` |
| remark-directive | the directive containers | directive mdast nodes |
| callout-mapping | directive nodes | Starlight native aside (4, no attributes) or theme-callout hast `<aside class="dk-callout dk-callout--{variant}">` (rest + any mapped class with `{#id}`/`{icon:}`), icon resolved via seed map |
| figure rehype | `img` nodes + attached attributes | `<figure>`+`<figcaption>`, `astro:assets` sizing/align/alt |

## Coverage matrix {#coverage-matrix}

The authoritative denominator for SC-005 / NFR-003 "100% of in-scope constructs".
Each row is one construct × input-form pairing that the fixture corpus must exercise
with a render + accessibility assertion. Coverage is measured against this list, not
a self-declared percentage.

| # | Construct | Input form | Fixture asserts |
|---|-----------|-----------|-----------------|
| 1 | aside | `A>` single-line run | one aside block |
| 2 | aside | `A>` multi-paragraph run (blank `A>` lines, internal heading) | one aside; internal heading absent from ToC |
| 3 | aside | `{aside}…{/aside}` wrapper | one aside; nestable |
| 4 | aside | `{aside}` wrapper body containing a fenced `>` code block | aside boundaries correct, code intact (US1 sc.5) |
| 5–14 | callout (tip) | `T>` · `{class: tip}`+`B>` · `{blurb, class: tip}` | identical Starlight `tip` (×3 forms) |
| " | callout (warning) | `W>` · `{class: warning}`+`B>` · `{blurb, class: warning}` | identical Starlight `caution` (×3, US1 sc.3) |
| " | callout (error) | `E>` · `{class: error}`+`B>` · `{blurb, class: error}` | identical Starlight `danger` (×3) |
| " | callout (information) | `I>` · `{class: information}`+`B>` · `{blurb, class: information}` | identical Starlight `note` (×3) |
| " | callout (discussion) | `D>` · `{class: discussion}`+`B>` · `{blurb, class: discussion}` | theme callout `discussion` (×3, US1 sc.4) |
| " | callout (question) | `Q>` · `{class: question}`+`B>` · `{blurb, class: question}` | theme callout `question` (×3) |
| " | callout (exercise) | `X>` · `{class: exercise}`+`B>` · `{blurb, class: exercise}` | theme callout `exercise` (×3) |
| " | callout (center) | `C>` · `{class: center}`+`B>` · `{blurb, class: center}` | theme callout `center` (×3) |
| " | callout (generic) | `B>` · `{class:}`-absent `B>` · `{blurb}` | theme callout `generic` (×3) |
| 15 | callout (mapped + attr) | `T>` carrying `{#id}` or `{icon:}` | routes to theme-callout hast `<aside class="dk-callout dk-callout--tip">` (mapped-name fallback variant); the `{#id}`/`{icon:}` survives on the `<aside>` |
| 16 | figure | `![caption](local.jpg)` | `<figure>`, caption = bracket text, local optimised |
| 17 | figure | `![](https://…)` web URL | `<figure>`, passthrough `src` |
| 18–25 | figure attrs | `{alt:}` · `{caption:}` · `{title:}` · `{width:}` · `{height:}` · `{align:}` · `{class:}` · `{#id}` | each applied per `figure-render.md`; `{width:}` proven to survive the `__ASTRO_IMAGE_` round-trip |
| 26 | figure attr (ignored) | `{fullbleed: true}` above an image | silently ignored, no error |
| 27 | crosslink id | `{#id}` / `{id: …}` above a heading + `[text](#id)` | link resolves (US3 sc.1) |
| 28 | crosslink id (collision) | `{#overview}` on a heading whose slug is also `overview` | explicit wins (US3 sc.3) |
| 29 | crosslink id (auto) | heading with no Markua syntax | keeps auto id (US3 sc.4, FR-008) |
| 30 | span id | `[span]{#id}` + `[text](#id)` | `<span id>`, link resolves |
| 31 | span id | `word{#id}` trailing form | `<span id>`, link resolves (US3 sc.2) |
| 32 | icon (mapped) | `{icon: fa-lightbulb}` | mapped Starlight icon renders (US4 sc.1) |
| 33 | icon (unmapped) | `{icon: fa-obscure-name}` | icon dropped, build warning, build exits 0 (US4 sc.2) |
| 34 | attr-above-wrapper | `{#id}` / `{class:}` immediately above `{aside}`/`{blurb}` | id/class lands on the container (H) |
| 35 | malformed / portability | unbalanced wrapper; preset-off render of the corpus | degrades to text; no raw `:::`/`{…}` leak (SC-003, SC-004) |
