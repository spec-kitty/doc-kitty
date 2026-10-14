---
title: "ADR-0051: Render Gherkin in any page, from a fence or an include"
description: A gherkin fence renders as a structured scenario and a ::gherkin directive includes a .feature file or chosen scenarios, via one remark stage whose errors fail the build.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - ivan@spec-kitty.ai
related:
  - adr/0046-gherkin-feature-pages
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - adr/0030-markua-preprocess-to-directive
  - adr/0021-deck-routing-seam-out-of-frame-override
  - adr/0014-upgrade-starlight-for-route-data-api
  - adr/0050-route-collisions-and-single-index-setting
  - architecture/gherkin-pages
---

# ADR-0051: Render Gherkin in any page, from a fence or an include

## Status

Accepted. Delivers slices A and B of
[issue #120](https://github.com/spec-kitty/doc-kitty/issues/120), which
[ADR-0046](./0046-gherkin-feature-pages.md) left open as its options E and F.
**Amends ADR-0046 decisions 1, 2, 6, 8 and 9** (see
[Amendments to ADR-0046](#amendments-to-adr-0046)).

It is sequenced ahead of #119 (Astro 7). The stage is a plain unified plugin, which
the Astro 7 port must keep working anyway; only the content-layer freshness of
includes (decision 11) depends on Astro 5 loader internals.

## Context

ADR-0046 turns a configured directory of `.feature` files into generated pages. It
does not serve an author who wants to show one scenario inside a guide, or to embed
a feature that already lives in the repository without pasting it. Today such an
author writes a ```` ```gherkin ```` fence, which renders as a code block, and the
pasted copy drifts from the executable file.

Several facts about the pipeline shape the design:

- **Order.** `doc-kitty` integrations append remark plugins through `updateConfig`.
  A stage registered after the glossary and before `starlight()` runs after
  `remark-smartypants` and glossary auto-linking, and before Starlight's
  `remarkDirectivesRestoration`, Expressive Code and `deckSplit`.
- **Directives always parse.** Starlight registers `remark-directive` on every site
  and restores an unhandled directive as literal text, so a `::gherkin{…}` line is
  stable whether or not anything consumes it.
- **A throwing remark stage does not fail an Astro build.** The content-layer
  `glob()` loader renders each entry inside a `try`, logs
  `Error rendering <entry>: <message>`, and stores the entry with no rendered HTML
  (`astro/dist/content/loaders/glob.js`, Astro 5.18). The page builds empty and the
  build exits 0. No doc-kitty remark stage throws today, so there was no precedent
  for build-fatal page errors.
- **Decks.** `guardDeck` turns a whole transformer into a no-op on a deck page, so a
  directive guarded that way would leak onto the slide as literal text.
- **The loader caches by page contents.** A page that includes a `.feature` file is
  not re-rendered when only that file changes.

## Decision

1. **Config shape.** The option widens to
   `gherkin?: true | { fences?, includeRoots?, sources?, section?, sourceUrlPrefix?, sourceRoot? }`.
   - `fences` defaults to `true` in both forms: turning Gherkin on turns in-page
     Gherkin on.
   - `sources` present ⇒ generated pages (ADR-0046): the codegen integration, the
     `behaviour` sidebar section. `gherkin: true`, or an object without `sources`,
     adds none of them. Index names are set once on `defineDocKittyIntegrations`
     and validated there whether or not `gherkin` is on, and generated pages follow
     the route rules of [ADR-0050](./0050-route-collisions-and-single-index-setting.md)
     (a colliding route is fatal, and `index.feature` is rejected on any setting).
   - `includeRoots` are project-root-relative directories, defaulting to
     `sources ?? []`. An absolute path, drive letter or URL scheme is refused.
     A root that does not exist is not a config error: it is reported, as
     configured, by each include whose `src` lies below it (decision 4), and
     skipped for every other include, so a site whose roots are created later,
     or that has no include yet, still builds.
   - An unknown key, a non-boolean `fences`, `section` without `sources`, and any
     value other than `true` or an object (including `false`) are config errors.
   - The rules live once in `gherkin/options.mjs`: `normalizeGherkinOptions` for the
     integration, and `validateGherkinPages` for the generated-pages rules, which
     the bare-Node `generate-feature-pages.mjs` calls directly, so `--sources` stays
     required there.
2. **One remark stage, `doc-kitty:gherkin-fence`.** It is a separate integration
   from the `doc-kitty:gherkin` codegen hook, registered after the glossary and the
   codegen hook and immediately before Starlight. It handles both fences and
   includes. Step text is therefore not auto-linked (decision 6 amended), and the
   stage is an `inert` exclusion in the re-derive parity test.
3. **Fences (slice A).** A `code` node with `lang === 'gherkin'`, at any depth, is
   replaced by a node retyped `dkGherkin` (`<div class="dk-gherkin">`), so Expressive
   Code never wraps it. The info-string word `raw` opts a fence out. A fence without
   `Feature:` is wrapped in a synthetic, untitled Feature only when the parser's
   first error says a `Feature:` line was expected, never by scanning for keywords
   (a `Feature:` line inside a doc string would fool a scan). Steps with no
   `Scenario:` are no parser error (the grammar reads them as the Feature's
   description), so the synthetic Scenario is added when the first content line
   is a step line, classified exactly as the parser's token matcher classifies
   one. The synthetic levels render no heading. Around that:
   - An empty or comment-only fence has no Feature and stays a code block.
   - A fence whose content only becomes the synthetic Feature's description
     (prose, a bare table, `Examples:` and a table) would render as nothing, so
     it is build-fatal, pointing at `gherkin raw`.
   - Steps written under a real `Feature:` line with no `Scenario:` render as
     the description the parser makes of them, with a build warning. A first
     line that starts with `*` and a space is read as a Markdown bullet and not
     warned about.
   - Errors are reported at the page's absolute line.
4. **Includes (slice B).** A leaf directive,
   `::gherkin{src="…" scenario="…" tags="…"}`, renders a `.feature` file through the
   same markup, with a source line.
   - `src` is required, project-root-relative and must end in `.feature`: an
     include root may hold other files (`.` holds `.env`), and a parse error
     quotes the line it fails on, so a non-Gherkin file is refused before it is
     read.
   - `scenario` selects by exact, case-sensitive name.
   - `tags` is a space-separated **any-of** list over inherited tags, evaluated per
     pickle. A tag expression is refused rather than misread: the words `and`,
     `or` and `not` (any case) and parentheses are build-fatal, since
     `@a and @b` would otherwise select `@a`, `@and` or `@b`.
   - `scenario` and `tags` together, any other attribute, the container form
     (`:::gherkin`) and a text form with attributes or a label (`:gherkin{…}`,
     `:gherkin[…]`) are build-fatal. A bare `:gherkin` in prose (`lang:gherkin`) is
     not an include and is restored as literal text.
   - `@dk:*` metadata tags in an included file are dropped silently (the file may
     also feed a generated page); in a fence they draw a warning.
   - Includes are not recursive.
5. **Errors are build-fatal through an error sink.** Because the loader only logs a
   render error (see Context), the stage records every fatal message for a page in
   a process-wide sink (`gherkin/errors.mjs`) and then throws, so the page never
   renders half-transformed. The integration's `astro:build:done` hook throws one
   aggregated error, listing every page and message in source order, so the build
   exits non-zero. The loader persists the failed entry in its data store
   (`<cacheDir>/data-store.json`) with no HTML and skips any entry whose digest is
   unchanged, so a second build of the same broken page, or a build after
   `astro sync` or `astro check` (which render into the same store but never run
   `astro:build:done`), would record nothing and exit 0. Two mechanisms close
   this:
   - Primary, for collections on `docKittyDocsLoader`: the loader notes each
     entry whose render throws and stores it, when its body mentions `gherkin`,
     under a digest that never matches, so every later sync renders it again and
     refills the sink; a fixed page is stored under its plain digest again. It
     covers a second build, a build after `astro sync`/`astro check`, and a
     build that died before `astro:build:done`. Only the broken pages are
     re-rendered, and the dev store (`.astro/data-store.json`) benefits the same
     way: after a dev restart a broken page logs its error again.
   - Fallback, for every other collection (a plain `glob()` loader, which the
     stage still renders): when `astro:build:done` fails the build it first
     deletes `<cacheDir>/data-store.json`, so the next build re-renders every
     page and fails again. The build after a failure is a full one. It does not
     cover `astro sync` or `astro check` before a build, which never reach the
     hook: for such a collection that build can exit 0 with the page empty.

   In dev the sink is only logged. It is reset in `astro:config:setup`, so a
   long-lived dev process does not carry errors across config reloads. A
   real-build exit-code test proves it, building twice, building after
   `astro sync`, and building twice with the broken page in a plain `glob()`
   collection.
6. **Decks.** The stage branches on `isPresentationFile` instead of using
   `guardDeck`. On a slide a fence stays a code block, and a `::gherkin` directive
   is build-fatal ("includes are not supported in decks").
7. **Generated pages are skipped.** A page whose frontmatter carries
   `generated.by: doc-kitty/gherkin` is left as emitted, so a `gherkin` doc string on
   a generated page never grows a nested structured scenario.
8. **Markup.** The stage builds mdast directly from a view model shared with
   `render.mjs`. The `.dk-gherkin*` rules live in the global component sheet and
   ship to every site, preset on or off, as the `.dk-diagram*` rules do.
   - Heading levels follow the host outline (`max(2, preceding heading depth + 1)`,
     capped at 6).
   - Inside a container (list item, blockquote, aside, callout) the headings become
     `p[role=heading]`, so they stay out of the TOC.
   - No heading carries a preset id, so the slugger keeps ids unique.
   - **Steps are an unordered list** on both surfaces, with the keyword in `strong`.
     That matches `render.mjs`'s `- **Kw** text`, so generated pages, embeds and the
     agent Markdown agree and slice C output does not move.
   - `remark-smartypants` runs over the emitted subtree, so prose typography
     matches the page. A double-quoted step argument (`"spec-kitty init --force"`)
     is a code span with its quotes, on generated pages, in embeds and in the
     agent Markdown alike, so smartypants never curls its quotes or turns its
     `--` into a dash and a reader can copy it. A quoted argument in a
     data-table or Examples cell is a code span too. Unquoted text is still
     typeset: `--force` outside quotes becomes a dash.
   - The agent Markdown of an include is laid out as the HTML: the Feature's
     tags in a whole-file header, each tag list directly after its heading,
     `@dk:*` tags dropped (one `displayTags` filter in `view.mjs`), and bold lines
     instead of headings inside a container.
   - The narrative and descriptions are parsed as Markdown with the page's own
     extensions, as `render.mjs` passes them through on generated pages.
9. **Trust boundary.** An include is read only if `realpath(src)` lies inside
   `realpath` of one of `includeRoots`. Symlinks are resolved first, so a link that
   points out of a root is refused, whether its target exists or not (a missing
   file answers "outside" when it would resolve outside, so the refusal is no
   existence oracle). Only a regular file of at most 1 MiB is read
   (a device, FIFO or larger file is refused before a byte is read). `src` and
   `includeRoots` follow one rule: a non-blank relative path with `/` separators
   (`isRelativePosixPath` in `text.mjs`), and `src` names a `.feature` file. This
   is enforced in the stage. The docs loader, which runs first and never sees
   `includeRoots`, applies the same rules and limit before it hashes a file for
   decision 11, and never follows an absolute `src`. It is also part of every
   site, preset on or off: on a site without the stage, a `::gherkin{src}` line
   still makes the loader hash (and in dev watch) the `.feature` file it names,
   within those limits, though nothing renders it. As on generated pages, raw HTML
   in a feature description reaches the page.
10. **Agents.** The stage records each include's rendered Markdown and its source
    offsets in the page's render-time frontmatter (`dkGherkinIncludes`, which Astro
    keeps apart from the validated `entry.data`), and the agent page route splices
    it into the raw body. The payload also lists the includes as
    `includes: [{ src, scenario?, tags? }]`, with `tags` as the attribute string
    (not split). The route needs no filesystem, roots or parser. An `.mdx` page,
    which Astro 5 renders outside the loader, keeps the directive line.
11. **Content-layer freshness.** The docs loader folds a hash of each included file
    into the page digest and re-emits a `change` for a page when a file it includes
    changes. This is the only part tied to Astro 5's `glob()` internals.

## Amendments to ADR-0046

- **Decision 1 (opt-in preset).** An absent preset still means unchanged pages. A
  present preset now also transforms fences and includes, unless `fences: false`.
  Generated pages need `sources`, which becomes optional.
- **Decision 2 (parse once, errors fatal).** A fence or include that fails to parse
  is build-fatal at `page:line:col`, delivered through the error sink (decision 5).
  `raw` opts a fence out.
- **Decision 6 (steps as prose).** Step text is auto-linked on generated pages only,
  until #113 lets the in-page stage run before the glossary.
- **Decision 8 (shared pure core).** The core grows to cover parse, fragment, view,
  mdast, select and errors. A second document walk alongside the shared view model
  is a review finding. `select.mjs` is the one exception: it walks the AST to
  PRUNE a document before the view is built (a selection is a different document,
  not a different rendering of one), so the view still makes the only rendering
  walk.
- **Decision 9 (scenario index).** Embedded scenarios are never in
  `/api/scenarios.json`; the index lists generated pages only.

## Consequences

### Positive

- An author shows a scenario in a guide by writing a fence, and embeds a real
  feature without copying it. A changed scenario name or tag that an include
  depends on stops the build.
- Generated pages and embeds share one view model, so titles, narrative, tags and
  outline placeholders agree.
- Embedded scenarios are indexed by Pagefind with no extra work, because it indexes
  rendered HTML.
- The error sink is the first doc-kitty mechanism that makes a page-level remark
  error fail the build. Later stages can reuse it.

### Negative

- Existing `{ sources }` sites see their ```` ```gherkin ```` fences become
  structured once they upgrade. `fences: false` or the `raw` opt-out keep them as
  code. 0.2.0 shipped generated pages without the in-page stage, so this is a
  breaking change for those sites, and the changelog says so.
- Embeds are not glossary-linked while generated pages are, until #113.
- Quoted step arguments are code spans on generated pages too. That changes slice
  C output once (the example pages and goldens were regenerated) and takes the
  argument out of glossary auto-linking.
- Content-layer freshness depends on Astro 5 loader internals and must be redone
  for Astro 7 (#119).
- A second remark integration for Gherkin, which `config-invariants.test.ts` and the
  parity test have to pin.

### Risks

- **Silent empty pages.** If the `astro:build:done` check is dropped, a broken fence
  builds an empty page and exits 0. The real-build exit-code test guards it.
- **Include paths pulling in unintended files.** Mitigated by realpath containment
  and by refusing absolute paths and schemes; descriptions remain a trust note.
- **Heading clashes** with the host outline. Mitigated by relative levels capped at
  6; identical embeds get the slugger's position-dependent `-1`/`-2` suffixes.

## Alternatives considered

### Stage position: before the glossary

Steps would be auto-linked, matching generated pages. The stage would then have to
be mirrored in the re-derive plugin list, and the re-derive would resolve includes
at render time in `OnThisPage.astro`, outside the build: the same gap #113 describes
for Markua. Revisit with the #113 fix.

### Config shape: `fences` off by default in the object form

`{ sources }` would keep meaning exactly "generated pages", reading ADR-0046
decision 1 literally. Rejected because most sites would have to set a flag to get
the feature they opted into; `fences: false` keeps the old behaviour on request.

### Config shape: keep the codegen gated on the option's presence

`gherkin: true` would then need `sources` to mean anything. Rejected: in-page
Gherkin needs no source directory, and an empty `behaviour` section would follow.

### Include syntax: fence meta

```` ```gherkin src="…" ```` with an empty body needs no directive, but with the
preset off it renders as an empty code block, and markdownlint and authors read it
as a mistake. The leaf directive always parses and degrades to readable text.

### Error delivery: wrap `context.logger.error` in the docs loader

It would catch every render error from every stage, a broader policy change, and it
depends on Astro's log text. The sink is scoped to this stage.

### Error delivery: throw only, or render the error inline

Throwing alone builds an empty page and exits 0 (see Context). Rendering the error
on the page ships a broken page that nothing flags.

### Decks: `guardDeck`

It no-ops the whole stage on a deck, so a `::gherkin` directive leaks onto the slide
as literal text. Structured scenarios on slides need markup without headings and
are left for later.

### Fragments: require a full `Feature:` in every fence

Simpler, but the steps-only examples in `docs/guides/authoring.md` would fail, and
"one scenario inside a guide" would need boilerplate. Detecting fragments by
scanning lines was rejected too: a `Feature:` line inside a doc string fools it.

### Tag selection: full tag expressions

`@smoke and not @wip` through `@cucumber/tag-expressions` needs a new exact-pinned
dependency that meets the ADR-0014 supply-chain bar. It waits for a real request.
Allowing `scenario` and `tags` together as an intersection can be added later
without breaking anything.

### Markup: re-parse `render.mjs` Markdown, emit raw HTML, or a rehype stage

Re-parsing turns `render.mjs`'s whole-document escapes into stray `html` nodes and
offers no container hook. Raw HTML keeps headings out of the TOC slugger. A rehype
stage runs after Expressive Code has claimed `pre > code`, and cannot parse
descriptions with the page's own micromark extensions.

### Steps as an ordered list

Numbered steps read well, but `render.mjs` emits bullets, and changing it would move
every slice C golden. Both surfaces use bullets.

## References

- [ADR-0046](./0046-gherkin-feature-pages.md): generated feature pages, amended here.
- [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md): auto-link eligibility.
- [ADR-0030](./0030-markua-preprocess-to-directive.md): the single `remark-directive` owner.
- [ADR-0021](./0021-deck-routing-seam-out-of-frame-override.md): deck pages.
- [ADR-0014](./0014-upgrade-starlight-for-route-data-api.md): the dependency bar.
- [Gherkin feature pages](../architecture/gherkin-pages.md): the architecture page.
- [Issue #120](https://github.com/spec-kitty/doc-kitty/issues/120), [#113](https://github.com/spec-kitty/doc-kitty/issues/113), [#119](https://github.com/spec-kitty/doc-kitty/issues/119).
