# Contract: chrome rendering + build-artifact assertions

What the built `example/dist` MUST prove. Verified by
`src/scripts/assert-build-artifacts.mjs` (extended) and the build.

## Carriers + substrate (ADR-0013)

- Starlight's `components` map (from `defineDocKittyIntegrations`) MUST point at
  doc-kitty's four carriers: `Head`, `PageTitle`, `MarkdownContent`, `Footer`.
- Carriers MUST read `Astro.locals.starlightRoute` (Starlight ≥0.30), never
  `Astro.props`.
- The emitted stylesheet MUST declare the complete neutral `--dk-*` catalog and
  the `--dk-* → --sl-*` bridge assignments, positioned before Starlight override
  sheets (tokens-before-overrides).
- `kind → layout` resolves in the `MarkdownContent` carrier; unknown/absent
  `kind` → `Default`.

## Metadata slots

- `dk:metadata-band` (below `<h1>`, published pages): a **text-labelled**
  `doc_status` indicator (text label present in HTML, not colour-only), `updated`,
  `description`.
- `dk:page-hero` (above `<h1>`, when `hero_image` set): `<img>` whose `src` matches
  Astro's processed-asset pattern (`/_astro/…` hashed or `srcset`) and carries the
  required `alt`.
- `Head`: `og:title`, `og:description`, `og:image`, `og:image:alt`,
  `twitter:card=summary_large_image`, `twitter:image`, canonical URL. `og:image`/
  `twitter:image` resolve by `social_thumb` → `hero_image.src` → shipped
  site-default asset; the resolved value differs per branch (three fixtures).

## Hub layout (FR-016) + search

- A `kind: Hub` page renders a lead paragraph + a named `<nav>`/list of described
  links to child pages, card-wide targets ≥24px, in the Starlight frame (sidebar
  present).
- The Hub page's lead/link text MUST appear in the built `dist/pagefind/` fragment
  index (NFR-004).

## Accessibility (NFR-001, M1-verifiable)

- Text label + `alt` presence: HTML assertion.
- ≥24px targets, visible focus: emitted CSS declares `min-height`/`min-width ≥24px`
  on interactive targets and a `:focus-visible` rule; chrome uses only AA `--dk-*`
  state/`-bg` token pairs. Residual pixel checks: manual checklist (Playwright M2).

## Agent-index + sitemap (updated pins)

- `api/index.json`: matches `EXPECTED_INDEX_SHAPE`; `count === pages.length === 12`.
- `EXPECTED_PAGE_KEYS = ['slug','route','section','title','doc_status','kind']`
  (each a string).
- The single `draft` page absent from `api/index.json`, `rss.xml`, **and** the
  sitemap (draft URL absent; loc count == published set).
- The stale "M1 metadata-model chrome is out of scope (C-010)" header note is
  removed/corrected.

## Green-boundary invariant (C-010)

No committed/merged state in the mission leaves `doc-sanity` or `build-example`
red. The contract cutover lands atomically; chrome fans out after.
