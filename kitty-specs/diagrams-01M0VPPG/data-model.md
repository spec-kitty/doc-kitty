# Data Model: Diagrams (Mermaid) — M5

M5 adds **no persisted store** and **no new frontmatter field**. The "data" is the
`` ```mermaid `` fence (an existing code node in a `docs`-collection page or a deck) and the
in-memory mdast/hast the transform annotates + wraps at build. Entities are structural.

## Diagram (the umbrella)

- **What**: a `` ```mermaid `` fenced code block in a `docs`-collection Markdown page or a
  deck. Rendered client-side to an SVG.
- **Parts**: diagram source (the fence text) · metadata block (leading `%%` lines) ·
  diagram figure (the `<figure>` wrapper) · rendered SVG (the browser-drawn picture).
- **Invariants**: `docs/**` fences (toolkit's own tree) are doc-sanity only, never built;
  only `example/docs/**` diagrams are rendered/asserted.

## Metadata block (build input)

- **Shape**: a leading run of `%% key: value` lines (Mermaid comment syntax; a space after
  `%%`, never the reserved `%%{ … }%%` init directive). Ends at the first non-`%%`,
  non-blank line.
- **Fields (closed set, all optional)**: `title`, `description`, `attribution`, `source`.
  Unknown keys are left as ordinary comments (no error). Multiline values not supported v1.
- **Consumed by**: the remark plugin (below).

## Accessibility statements (`accTitle` / `accDescr`)

- **What**: the two Mermaid a11y lines the remark plugin **injects** into the diagram source,
  after the diagram-type declaration line (skipping a leading init directive / frontmatter).
- **Mapping**: `accTitle` ← `title` **or `description`** (fallback so the accessible **name**
  is set whenever any metadata exists); `accDescr` ← `description`.
- **Effect**: Mermaid emits `<title>`/`<desc>` + `aria-labelledby`/`aria-describedby` on the
  rendered `<svg>` — the SVG names itself.

## Diagram figure (build output)

- **What**: `<figure role="group">` wrapping the `<pre class="mermaid">`, emitted by the
  rehype plugin from the caption fields on `file.data`.
- **Caption**: `<figcaption>` with the `description` text + an `attribution` credit line
  (linking to `source` when present). The inner named SVG is **not** `aria-hidden`.
- **No-JS**: with JS off, the figure shows the raw diagram source + the caption (document
  order preserved).

## Render owner (client)

- **What**: the single exported client module (`diagram-render.client.ts`) that draws every
  `.mermaid` node. Reads `--dk-diagram-*` off `:root` into a `theme:'base'` `themeVariables`
  object, renders, and re-renders on `[data-theme]` via a `MutationObserver`.
- **Invariant**: exactly one render loop per `pre.mermaid` (astro-mermaid `autoTheme` off).
- **Surfaces**: imported by the doc pipeline and by `DeckLayout` (out-of-frame deck).

## Diagram tokens

- **What**: `--dk-diagram-*` — node fill/border/text, edge, subgraph-title, cluster.
- **Where**: promoted to the Default catalog (`DEFAULT_BASE`/`DEFAULT_DARK`, `theme.css`
  `:root`/`[data-theme=dark]`, `emitTokenSheet`) with **light + dark** values, **and** the
  brand `tokens.css`; the orphan `diagram-tokens.css` is retired.
- **Mapped** to Mermaid `themeVariables` by the render owner (see the token-map contract).

## Build/verify surfaces (per diagram)

| Surface | Included? | Mechanism |
|---|---|---|
| static HTML | `<pre class="mermaid">` + `<figure>` + injected `accTitle`/`accDescr` | remark+rehype transform; asserted in assert-build-artifacts |
| rendered SVG (JS on) | named (`aria-labelledby`) | render owner; direct name assertion in the a11y lane |
| no-JS | diagram source + caption | built HTML |
| contrast | AA both modes | vitest on `--dk-diagram-*` pairs (not axe) |
| footprint | mermaid chunk on diagram pages only | Playwright network capture |
| deck | on the active first slide | DeckLayout imports the render module |
