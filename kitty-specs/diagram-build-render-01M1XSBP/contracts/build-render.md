# Contract: build-time diagram render (#13)

## Mode selection (FR-005)
- A single resolved flag selects build vs client render per build,
  deterministically and observably (gates read it). Build mode requires a
  resolvable Playwright Chromium; absence → client fallback (never a hard fail).

## Mermaid build stage (FR-001/002/003)
- `@beoe/rehype-mermaid` (exact-pinned) renders `code.language-mermaid` → inline
  `<svg>` at build. The `diagram-meta` remark pass runs BEFORE it so the SVG
  carries `<title>`/`<desc>` from the `%%` metadata. A theme-rewrite maps EVERY
  render sentinel → `var(--dk-diagram-*)`; `diagram-figure` wraps the `<svg>` in
  `<figure class="dk-diagram" role="group" aria-labelledby>` + `<figcaption>`.

## PlantUML build stage (FR-006/007/008)
- `astro-plantuml` (exact-pinned) against a self-hosted `serverUrl` (never
  plantuml.com, C-001) renders `code.language-plantuml`/```plantuml → inline
  `<svg>`. A `'`-comment metadata parser (twin of `diagram-meta.internal.ts`,
  same closed field set) names it; the SAME figure/caption + var-rewrite apply.

## Gates are mode-aware (FR-010, C-005)
- Every diagram gate branches on the mode: build mode asserts inline `<svg>` +
  `var()` fills + accessible name + NO runtime chunk / NO diagram request; client
  mode keeps the pre-#13 assertions. No gate is weakened.

## Invariants preserved (C-003)
- The `%%`/`'` field set {title,description,attribution,source}; the
  `<figure role=group>`/`<figcaption>` structure; the six `--dk-diagram-*` tokens
  and their contrast ratios.
