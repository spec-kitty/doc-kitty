---
title: "ADR-0049: OpenAPI reference pages through an existing integration"
description: Build API reference pages from an OpenAPI definition with an existing Starlight integration that keeps DocKitty's frame, theming and gates intact.
doc_status: active
updated: 2026-10-14
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0026-glossary-source-and-generation-seam
  - adr/0046-gherkin-feature-pages
  - adr/0048-generated-page-names-and-empty-sources
  - architecture/gherkin-pages
  - architecture/glossary
---

# ADR-0049: OpenAPI reference pages through an existing integration

## Status

**Proposed** — 2026-10-14. Records the direction the project owner set in
issue #140. It becomes Accepted once a spike has evaluated at least one candidate
integration against the conditions in Decision 1 and recorded the result.

## Context

A repository that describes its API in an OpenAPI definition has two options
today. It copies the reference into Markdown by hand, where it drifts from the
definition. Or it links out to a separate Swagger site, which has none of the
docsite's navigation, search, glossary or metadata.

Issue #140 asks for the definition to be the source of truth: the site points the
toolkit at a local file or a URL, and every build produces the API reference from
it. The generated pages should behave like other docs pages: sidebar entries,
search, the glossary autolinker, metadata, and inclusion in `llms.txt`, feeds and
the sitemap.

DocKitty already generates pages from two sources, the glossary
([ADR-0026](./0026-glossary-source-and-generation-seam.md)) and Gherkin features
([ADR-0046](./0046-gherkin-feature-pages.md)). Both follow one safety pattern,
tightened in [ADR-0048](./0048-generated-page-names-and-empty-sources.md) after issue #122 emptied a section on an unchecked-out submodule.

### What we know about the first candidate

`starlight-openapi` (HiDeoo, MIT) is the obvious candidate. From its npm registry
entry and README, checked on 2026-10-14:

- Latest version 0.27.0. Its README lists support for Swagger 2.0, OpenAPI 3.0
  and OpenAPI 3.1, and for local and remote schemas. It parses with
  `@readme/openapi-parser`.
- Its peer dependencies are `astro >= 7.0.2`, `@astrojs/starlight >= 0.41.0` and
  `@astrojs/markdown-satteri >= 0.3.2`. The example site is on `astro ^5.2.0` and
  `@astrojs/starlight ^0.32.6`. The current release does not install on our stack
  without an upgrade.
- It renders the Markdown inside the definition (descriptions) by calling
  `createSatteriMarkdownProcessor()` from `@astrojs/markdown-satteri` directly
  (`libs/markdown.ts`), not through the site's Markdown pipeline.

### What the Sätteri dependency means

`@astrojs/markdown-satteri` is the Astro team's adapter for Sätteri (Bruits, MIT),
a Markdown and MDX compiler written in Rust that runs plugins in JavaScript. It
first shipped in May 2026 and is at 0.4.3. It ships prebuilt binaries per
platform, with a WebAssembly fallback.

Astro 7 made it the default Markdown processor. The Astro changelog says that
`.md` files now render with `satteri()` instead of the remark/rehype pipeline, and
that `@astrojs/markdown-remark` is no longer installed by default. Sätteri has its
own plugin API, so remark and rehype plugins do not run on it. A site keeps them by
installing `@astrojs/markdown-remark` and setting
`markdown.processor: unified()`. In Astro 7 `markdown.remarkPlugins` and
`markdown.rehypePlugins` still work, but only with that package, and the changelog
calls them deprecated.

This matters because DocKitty's Markdown features are remark and rehype plugins
registered in `src/lib/config.ts`: deck splitting, the relative-link rewrite
(ADR-0047), base-absolute links, diagram metadata, and the Mermaid and PlantUML
transforms. Taking `starlight-openapi` therefore means:

- **A framework upgrade first.** Astro 5 → 7 and Starlight 0.32 → 0.41 is its own
  piece of work. Astro 7 also makes the stricter Rust compiler the default, which
  turns invalid markup such as unclosed tags into errors.
- **A processor choice.** Keep `unified()` so the existing plugins run (the short-term
  path, on deprecated options), or port each plugin to Sätteri's API. That choice
  needs its own ADR.
- **Descriptions bypass our pipeline in either case.** Because the plugin calls
  Sätteri directly, Markdown inside the definition does not get the glossary
  autolinker, the relative-link rewrite or the link checks, even with `unified()`
  set for the site's own pages.
- It exports its own `styles` stylesheet and ships static and SSR route
  components (`routes/static`, `routes/ssr`).

To confirm in the spike: whether an older release supports Starlight 0.32 (and
which Markdown processor it needs); whether
its pages are content-collection entries or injected routes (which decides whether
the remark stack, glossary autolinker, metadata and machine surfaces see them at
all); whether its stylesheet can be dropped or mapped onto `--dk-*` tokens; and
whether its Swagger 2.0 support is complete enough for our fixtures.

## Decision

1. **Use an existing Starlight or Astro OpenAPI integration.** We do not write our
   own generator. The integration must meet all of these, through configuration
   or a thin adapter:
   - Its pages render inside the DocKitty frame: header, sidebar, TOC rail,
     footer, and the Persona and Hub layouts where they apply.
   - Its styling comes from the `--dk-*` token catalog and follows branding and
     theme overrides in light and dark mode. No hard-coded colours or fonts, and no
     stylesheet of its own that overrides ours.
   - The existing gates stay green: a11y baselines, link integrity, the remark
     stack, byte-stable determinism and the consumption test.

   If no candidate meets these, the spike records that finding first. Only then
   may we fall back to our own generator, through a new ADR.
2. **OpenAPI 3.0 and 3.1 are required. Swagger 2.x is wanted.** Swagger 2.x comes
   either natively from the integration or by converting 2.x to 3.x before
   rendering. If 2.x adds disproportionate cost or a heavy dependency, we ship 3.x
   first and track 2.x as a follow-up issue.
3. **The definition is the source of truth, and the reference regenerates on
   build.** A local file or a URL is accepted. Regeneration follows the pattern of
   ADR-0026, ADR-0046 and ADR-0048:
   - generated pages carry a generated marker;
   - pages the definition no longer produces are pruned;
   - an authored file at a generated path stops the build, with the path named;
   - a `--check` mode fails CI when committed pages are out of date;
   - an empty or unreachable definition stops the build when generated pages
     exist. It never deletes them (#122).

   If the chosen integration renders without writing files, the parts of this
   pattern that guard written files apply to whatever DocKitty writes around it.
   The empty-or-unreachable stop applies either way.

## Open questions

- **Build time or committed pages?** Generate at build time only, write pages to
  the docs tree and commit them (as Gherkin does), or offer both modes.
- **Try-it console?** Offer an interactive request console, or a static reference
  only.
- **Reproducible remote fetch.** How a remote definition is pinned, cached and
  used offline, so two builds of the same commit produce the same bytes.

## Consequences

### Positive

- Adopters get an API reference that cannot drift from the definition.
- We reuse a maintained parser and renderer instead of owning one.
- The generated-page rules adopters already know apply to one more source.

### Negative

- The first candidate needs a newer Astro and Starlight than DocKitty uses. Taking
  it may mean a framework upgrade, or pinning an older release of the plugin. The
  upgrade brings Astro 7's switch to Sätteri, which forces a decision on our
  remark and rehype plugins (see "What the Sätteri dependency means").
- A third-party renderer can change its markup between releases, which affects
  a11y baselines and byte-stable output.

### Risks

- If the integration injects routes rather than content entries, the glossary
  autolinker, metadata and machine surfaces may not see the pages. The spike must
  answer this before acceptance.
- A remote definition makes the build depend on the network until the fetch
  question is settled.
- Markdown in the definition's descriptions is rendered by the plugin's own
  Sätteri call, so glossary links and our link checks do not reach it. If that is
  unacceptable, this weighs toward the own-generator fallback, which would emit
  ordinary Markdown pages through our full pipeline.
- Sätteri is young (0.x, first released in 2026) and ships native binaries. Expect
  breaking minor releases and possible install trouble on uncommon CI images.

## Alternatives considered

### Our own generator

Not chosen. The project owner prefers an existing integration. This stays the
fallback, and only after a spike finding records why no candidate fits.

### Link out to a separate Swagger site

Rejected. It is what adopters do today, and it loses navigation, search, the
glossary and metadata.

## References

- Issue #140: OpenAPI support, with the owner's decisions.
- [ADR-0026](./0026-glossary-source-and-generation-seam.md), [ADR-0046](./0046-gherkin-feature-pages.md) and [ADR-0048](./0048-generated-page-names-and-empty-sources.md): the generated-page pattern.
- `starlight-openapi` on npm and its README (version 0.27.0, read 2026-10-14).
