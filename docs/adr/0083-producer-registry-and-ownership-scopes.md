---
title: "ADR-0083: A producer registry with an ownership scope per producer"
description: "Every generator that stamps its pages is registered once, with a role and an ownership scope; the gates read the registry instead of naming producers."
doc_status: draft
updated: 2026-11-22T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - adr/0046-gherkin-feature-pages
  - architecture/metadata-model
  - architecture/packs
---

# ADR-0083: A producer registry with an ownership scope per producer

## Status

**Proposed**, 2026-11-22. Issue #330, epic #328. It extends
[ADR-0079](0079-kitty-packs-through-a-charter-contract-reader.md) decision 6 and
leaves that ADR's text unchanged.

## Context

doc-kitty writes generated pages into the docs tree: Gherkin feature pages
([ADR-0046](0046-gherkin-feature-pages.md)) and glossary pages. Each stamps what it
writes with `generated: {by: <producer>/<version>, at, content_hash}`. Three places
decided whether a page was generated, and each named the producers itself:

- `PRODUCERS` in `src/lib/generator-stamp.mjs` listed Gherkin and glossary.
- `isGeneratedPage` in `src/scripts/validate-frontmatter.mjs` exempted a page with
  a Gherkin stamp anywhere, or a `kind: Glossary` or `kind: Hub` page under
  `glossary/`.
- The Gherkin generator's output scan recognised its own stamp.

ADR-0079 D6 asked for one producer registry with an ownership scope per producer,
because pack pages own directories inside a section, not a whole section. More
producers are coming: pack pages (#338), the missions and Ops pages
(#413), and the generated-section contract (#359). Each would otherwise edit the
three places again.

## Decision

1. **One registry.** `src/lib/producers.mjs` holds every producer. The gates,
   the stamp helpers and the generators' output scans read it. It is fs-free, so
   the bare-Node gates and build-time code share it.
2. **Two roles.** An *ownership* producer generates, and so owns, the pages it
   stamps. A *provenance* producer (the scaffold) records where a page started and
   never owns it. Only ownership producers make a page generated.
3. **Two scope types.**
   - `{type: 'section', section?, kinds?}`: a whole section.
   - `{type: 'directories', section, dirs, kinds?}`: directories inside one
     section, as pack pages need (`<section>/<dir>/**` per pack).
   `kinds` restricts either scope to those page kinds. A root page is never in a
   scope. The registry refuses a malformed entry when it is built: a section or
   directory that is not one path segment, kinds that are not strings, or an
   unknown role or recognition.
4. **Recognition is the stamp and the scope.** A page is generated when it is
   inside an ownership producer's scope and carries that producer's versioned
   stamp. A stamp alone never exempts a page, so an authored page cannot opt out
   of the contract by claiming one. The glossary is the one producer recognised by
   its scope alone (`glossary/` and `kind: Glossary` or `Hub`), which is the rule
   it had before the registry. A producer recognised by its scope alone must name
   its section, or it would own every page in the tree.
5. **A configurable section.** The Gherkin section is configurable
   (`gherkin.section`), and the frontmatter gate does not evaluate the site
   config. Gherkin's registered scope is therefore a section scope with no named
   section, which means any one top-level section. A caller that knows the
   resolved section passes it through the `producerScopes` option of
   `validate()` and `isGeneratedPage()`. That option replaces a producer's
   registered scope for the call; it is meant to narrow it, to the one configured
   section. An override is held to the rules the registry applies at
   registration (decisions 3 and 4): it must name an ownership producer and be
   well formed, and a producer recognised by its scope alone may not be widened
   to every section. A breach is an error, not a silent match.
6. **A generic output scan.** `scanProducerOutput(outDir, producer)` in
   `src/lib/producer-output.mjs` classifies a generator's output as owned (the
   producer's stamp, or its retired stamp so a regeneration replaces a legacy
   page) or authored. The Gherkin generator delegates to it.
7. **Adding a producer** is one registry entry: its id (the stamp prefix), its
   role, its scope, and the hint that tells an author how to regenerate its pages.

## Consequences

### Positive

- Pack pages, the missions and Ops pages and later generators register once and
  inherit the frontmatter exemption, ownership and pruning rules.
- In the frontmatter gate, the rule that a stamp alone never exempts a page now
  holds for every producer, not only the glossary.
- Existing sites see no change, except that a Gherkin-stamped root page is no
  longer exempt (below). Every existing test passes unedited.

### Negative

- In the frontmatter gate, a Gherkin stamp is still accepted in any one section,
  unless the caller passes the configured section. That is narrower than before
  only at the root: a Gherkin-stamped root page used to be exempt from the
  metadata contract and no longer is. Inside the sections it is as wide as before.
- A `directories` scope needs its directories when the registry is built, but
  pack directories are known only from site config. The bare-Node frontmatter
  gate does not read site config, and no caller passes `producerScopes` yet. So
  until #338 adds that seam, a pack producer can only be registered with a
  section scope, and in the gate its stamp would be accepted in any one section.
  #338 must resolve the scopes from site config before the gate runs, through the
  site-config evaluation ADR-0079 D5 already plans for the CLIs, and pass them as
  `producerScopes`. Until then ADR-0079 D6's "stamp and scope" holds for packs
  only where a caller resolves the scope.
- Three readers outside the gate still recognise a page by an ownership stamp
  alone, with no scope: the edit link (`sourceLink` in `src/lib/page-formats.ts`),
  the RSS hub filter (`src/lib/metadata.ts`) and the OKF export (`okfGenerated`).
  They read `PRODUCERS`, so every registered producer joins them. Routing them
  through `ownerOfPage` belongs with the uniform generated-section contract (#359).

### Risks

- A producer registered with too wide a scope would exempt authored pages in
  that scope that carry its stamp. Scopes are reviewed with the producer's ADR.

## Alternatives considered

### Keep the special cases

Each new generator would edit the stamp module, the gate and its own scan. That is
the drift ADR-0079 D6 asked to remove.

### Evaluate the site config in the frontmatter gate

The gate could read `gherkin.section` through the site-config evaluation, and
narrow Gherkin's scope to the one section. That costs a child process per run and
changes the gate's two-argument contract, which many tests and callers use. The
scope narrowing hook gives callers that already know the section the same result.

### Recognise by stamp alone

Simplest, but any authored page could exempt itself from the metadata contract by
claiming a producer's stamp.

## References

- Issue #330; epic #328; ADR-0079 D6; ADR-0046 decision 4; #338, #359, #413
- `src/lib/producers.mjs`, `src/lib/producer-output.mjs`,
  `src/lib/generator-stamp.mjs`, `src/scripts/validate-frontmatter.mjs`
