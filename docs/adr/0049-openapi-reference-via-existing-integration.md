---
title: "ADR-0049: OpenAPI reference pages through an existing integration"
description: Build API reference pages from an OpenAPI definition with an existing Starlight integration that keeps DocKitty's frame, theming and gates intact.
doc_status: active
updated: 2026-10-29T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0026-glossary-source-and-generation-seam
  - adr/0046-gherkin-feature-pages
  - adr/0048-generated-page-names-and-empty-sources
  - architecture/gherkin-pages
  - architecture/glossary
---

# ADR-0049: OpenAPI reference pages through an existing integration

## Status

**Accepted** — 2026-10-29, on the spike result recorded in
[Addendum 2026-10-29](#addendum-2026-10-29-spike-result-244). Proposed
2026-10-14 from the direction the project owner set in issue #140.

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
p='0049-openapi-reference-via-existing-integration.md';s=open(p).read()
old="""**Proposed** — 2026-10-14. Records the direction the project owner set in
issue #140. It becomes Accepted once a spike has evaluated at least one candidate
integration against the conditions in Decision 1 and recorded the result."""
new="""**Accepted** — 2026-10-29, on the spike result recorded in
[Addendum 2026-10-29](#addendum-2026-10-29-spike-result-244). Proposed
2026-10-14 from the direction the project owner set in issue #140."""
assert old in s; s=s.replace(old,new).replace("updated: 2026-10-14T00:00:00Z","updated: 2026-10-29T00:00:00Z")
s=s.rstrip('\n')+"\n"+open('/dev/stdin').read()
open(p,'w').write(s)

## Addendum 2026-10-29: spike result (#244)

The spike evaluated `starlight-openapi@0.27.0` against the mission's exit
criteria (C-006) on Astro 7.4, Starlight 0.42.6 and the `unified()` processor
of ADR-0060. Two fixtures, `example/openapi/v1.yaml` and
`example/openapi/main.yaml`, drove it. The candidate passes with two thin
adapters and one narrow waiver, so this ADR is Accepted.

### Verdicts

| # | Criterion | Verdict |
|---|---|---|
| 1 | Builds on Astro 7.4 / Starlight 0.42.6 with `unified()` | Pass, with the description adapter (below). DocKitty's remark plugins still run on ordinary pages. |
| 2 | Several specs, each with its own base and sidebar group | Pass, through `createOpenAPISidebarGroup()` placeholders. |
| 3 | Pages render inside the DocKitty frame | Pass: header, sidebar, TOC rail and footer. |
| 4 | No plugin stylesheet; `--dk-*` tokens style the markup | Pass, with the stylesheet filter (below). There is no config switch. |
| 5 | Operation and schema text in the static HTML | Pass. |
| 6 | No request console | Pass: code samples are `<pre>` text, with no form and no fetch. |
| 7 | Byte-identical rebuilds | Pass (`diff -r` of two builds). |
| 8 | NFR-002 as first worded (no inline additions) | Fail. Waived narrowly (below). |
| 9 | Site surfaces | Sitemap and Pagefind: yes. `llms.txt`, agent API, content graph, glossary autolinker: no. Frontmatter gate: not applicable. |
| 10 | Build cost, 2 fixtures | +0.78 s (median of 3: 5.26 s against 4.48 s). |

### NFR-002 waiver

The operator waived NFR-002 narrowly (decision `plan.security.nfr002-waiver`).
API pages may add only the pinned plugin's known inline scripts. Code samples
are off (`snippets.operation`, `snippets.requestBody` and `snippets.response`
set to `false`), which leaves one script. A gate pins the hashes and fails on
any other addition. The hashes change only when the pin changes, and the
how-to publishes them.

Measured on the example build with snippets off, against the union of every
ordinary page:

| Where | Addition | CSP hash |
|---|---|---|
| Every operation page | Inline module script defining `starlight-openapi-content-picker` | `sha256-28IjJBwKnS9sgb0aB8YXgnUhJmV3Az7aJiw6QBthXmo=` |
| Each version's overview page | Style attribute `--sl-icon-size: 1.333em;` | `sha256-XlpZgcpFaLbPrgzm4PHCiD/OJXhR+DZxGuVpy2P4Cq0=` |

A style attribute needs `'unsafe-hashes'` to match a hash in `style-src`.
With snippets on, operation pages add two more scripts
(`sl-openapi-snippet-picker` and `sl-openapi-snippets`) and Expressive Code
style attributes. The waiver does not cover them. External origins: no
additions.

### Adapters

- **Description adapter.** The plugin's page props carry only `title`, so the
  DocKitty docs schema rejects them (`description: Required`). The adapter
  supplies a description for the generated pages.
- **Stylesheet filter.** A follow-on Starlight plugin removes
  `starlight-openapi/styles` from `customCss`, so theming comes from `--dk-*`
  only (Decision 1). The markup hooks are the `sl-openapi-*` classes and the
  `--sl-openapi-*` custom properties. The options used are `base`,
  `sidebar.{label,group,collapsed,operations,tags}` and `snippets.*`. The
  plugin has no slots or component overrides, so version links and the badge
  need route middleware or a wrapper.

### Default section

The default section is `reference/api`, so pages are at
`/reference/api/<label>/` (decision `plan.routes.default-section`). The
shorter `api/` collides with the agent API (`/api/index.json`,
`/api/pages/*`). A configured section is checked against reserved and
authored routes.

### Surfaces

The plugin injects routes. It does not add content entries (operator
decision 01M631YA75R7DR57DS8MV0HGNV accepts this).

- Sitemap and Pagefind: reached as-is.
- `llms.txt`: DocKitty wires the lines.
- Frontmatter gate: does not apply to the generated pages.
- Agent API, content graph and glossary autolinker: follow-ups.

### Known limit

Markdown in descriptions is rendered by the plugin. It bypasses the glossary
autolinker, the relative-link rewrite and the link checks.

### Supply chain (DIRECTIVE_051)

- Both packages are exact-pinned optional peers of `@spec-kitty/doc-toolkit`
  (`peerDependenciesMeta.optional`), and exact devDependencies of the toolkit
  and the example. Only opting-in sites carry them.
- The pnpm 11 lockfile records integrity hashes, not tarball URLs. Both match
  `dist.integrity` on registry.npmjs.org:
  - `starlight-openapi@0.27.0`:
    `sha512-M8oZ7CEgQ1d+lyyBHPin44HrBgpVLVzJhTQ+O7SCdUhMfgg6Zj2t6kgQb1BVs/e/HnZbKlWFZuOdKeHqh9jaYw==`
  - `@astrojs/markdown-satteri@0.4.4`:
    `sha512-Byhe9CAiGFJrhMACKpgN/FPf4lcwapqwFQAB7E1sPELTEJINfBIpgnEYOBTXzr//fvSSNhfp/X3AqN4mUV9p+A==`
- The install adds 30 packages. None has a `preinstall`, `install` or
  `postinstall` script; `@humanwhocodes/momoa` and `openapi-types` declare
  `prepare` only, which does not run on install. No `onlyBuiltDependencies`
  entry was added.
- Sätteri (`@astrojs/markdown-satteri@0.4.4`) and its per-platform `@bruits/*`
  binaries were already in the tree through Starlight. The pin is 0.4.4, not
  0.4.6, which was less than 24 hours old at the time.
- The transitive `event-stream` is 4.0.1, not the compromised 3.3.6.
