---
title: "ADR-0061: Gherkin authoring aids: a folder default glossary context and an imperative-step lint"
description: gherkin.defaultGlossaryContext sets a generated page's glossary context by folder, and an opt-in, warn-only lint flags steps that script the UI.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0046-gherkin-feature-pages
  - adr/0028-glossary-frontmatter-fields
  - adr/0051-gherkin-in-any-page
  - adr/0054-gherkin-draft-hubs-titles-and-scenario-route
  - adr/0062-specification-layout-and-draft-notice
  - architecture/research/gherkin-authoring-aids
  - architecture/gherkin-pages
  - guides/consumer-setup
  - guides/authoring
---

# ADR-0061: Gherkin authoring aids: a folder default glossary context and an imperative-step lint

## Status

**Accepted** on 2026-10-19. It was introduced by the gherkin-authoring-aids
mission and settles issues
[#197](https://github.com/spec-kitty/doc-kitty/issues/197) and
[#196](https://github.com/spec-kitty/doc-kitty/issues/196). The research and the
operator's decisions D1 to D8 are in
[Gherkin authoring aids (research)](../architecture/research/gherkin-authoring-aids.md).

It amends these statements and leaves both ADRs as written:

- **[ADR-0046](./0046-gherkin-feature-pages.md) decision 5** gives `@dk:` tags
  meaning at Feature level only. Decision 3 below adds `allow`, the first key
  that is also read on a Rule and a Scenario.
- **The ADR-0046 risk** "Imperative, UI-level scenarios read poorly as docs.
  Mitigated by authoring guidance; a lint is a follow-up." Decision 2 below is
  that follow-up, so the risk is closed.
- **[ADR-0028](./0028-glossary-frontmatter-fields.md) decision 1** says
  `glossary_context` is "not inherited". Decision 1 below lets a generated
  feature page take it from its source folder. Authored pages are unchanged.

The rest of ADR-0046, ADR-0028 and [ADR-0051](./0051-gherkin-in-any-page.md)
stands. [ADR-0062](./0062-specification-layout-and-draft-notice.md) records the
layout half of the same mission.

## Context

Two authoring gaps were left open by the Gherkin work.

- **The same glossary context is repeated on every feature.** A generated page
  gets `glossary_context` only from a `@dk:context` tag. In the example site all
  three shipping features carried `@dk:context=shipping`. The HR feature carried
  nothing, and `policy` is a term in both the `shipping` and the `hr` contexts.
  So "leave policy" on the HR page was an unresolved collision.
- **Nothing checks for imperative steps.** ADR-0046 promised a lint, and the
  authoring guide said "Nothing checks for them yet". A step such as
  `When I click "#book-button"` publishes as written.

Facts that shape the design:

- Generated pages are committed and drift-gated. Any option that changes their
  bytes needs a twin flag on `generate-feature-pages`, or `validate:features`
  cannot reproduce them. A parity test enforces this for every page key.
- `gherkin.titles` (ADR-0054) already maps source folders to a value, with a
  repeatable `--titles <dir>=<title>` flag and a warning for an unused key.
- Warnings are callbacks on each path. The fatal error sink is for errors only.
- `warnDuplicates` already runs from the feature-page renderer and from the
  fence stage, so a view-level check has a known place on both surfaces.
- The CLI is plain `.mjs`. It cannot import the TypeScript glossary loader,
  whose `.js` specifiers resolve to `.ts` sources only under Vite.

## Decision

### 1. A folder default glossary context

- **The option.** `gherkin.defaultGlossaryContext` maps a source-relative
  directory to a glossary context, for example
  `{ shipping: 'shipping', hr: 'hr', 'shipping/eu': 'customs' }`. It is a page
  key, so it needs `sources` and is validated like `titles`. A non-object, a key
  that is not a plain relative path (absolute, `..`, backslash, empty segment),
  or a blank value fails at startup.
- **One resolution point.** The context is resolved where generated-page
  frontmatter is built (`resolveGlossaryContext` in `feature-core.mjs`) and
  written into the page's `glossary_context`. The auto-linker, the scenario
  index, `/api/pages` and `llms.txt` read it from there, so no reader changes.
  Fences and includes do not resolve it.
- **Matching.** A feature takes the key that names its longest directory
  prefix, compared by whole path segment. `ship` never matches `shipping/`, and
  `shipping/eu` wins over `shipping` for `shipping/eu/b.feature`. One key space
  applies to every source, as with `titles`.
- **Precedence.** A non-empty `@dk:context` tag wins, then the folder default,
  then none. An empty `@dk:context=` still warns, and the folder default applies.
  A feature in an unmapped folder generates exactly as before.
- **CLI twin.** `--default-glossary-context <dir>=<context>`, repeatable. Each
  value splits on its first `=`. A missing `=` or a repeated `<dir>` is a usage
  error, and the CLI exits 1, as it does for `--titles`.
- **Unused key.** A key that matches no directory holding a feature, or one
  beneath it, warns: `gherkin.defaultGlossaryContext key "<key>" matches no
  source directory with a feature; ignored`. The build and the CLI both report
  it.
- **Unknown context, in the build only.** When `.contextive/definitions.yaml`
  is present, the build warns once per page whose resolved context is not a
  context in it. The warning names the file, the context and its origin: the
  `@dk:context` tag, or the map key. The CLI does not run this check (research
  R-02): it cannot load the glossary, and a second definitions parser is ruled
  out.

### 2. An opt-in, warn-only imperative-step lint

- **The option.** `gherkin.lint.imperativeSteps` is off by default. It is not a
  page key: it never changes a generated page, so it has no CLI flag.
  - `true` checks the built-in phrase list on `context` (Given) and `action`
    (When) steps.
  - `{ verbs, extend, keywords }`: `verbs` replaces the list, `extend` appends
    to it, and `keywords` replaces the scope with any of `context`, `action` and
    `outcome`. Entries are plain words or phrases, never regular expressions.
  - An unknown key, a blank entry, an unknown keyword type, an empty
    `keywords` list or an empty effective verb list fails at startup.
- **Warn-only.** Every finding goes through the existing `warn` callback. It
  never fails a build and never changes a page.
- **One core, two callers.** `lintSteps` in `src/lib/gherkin/imperative.mjs` is
  called from `renderFeatureBody`, for generated pages, and from the fence
  stage, for in-page fences. Includes and `gherkin raw` fences are never
  linted. `validate:features` does not lint.
- **What is matched.** Only a step's prose: text segments as written, an
  outline placeholder as `<…>` and a quoted argument as `"…"`. Argument
  contents, doc strings, data tables and Examples cells never match. The first
  word of a phrase matches in any common inflection (`clicks`, `clicked`,
  `tapping`), and only as a whole word, so `clickstream` does not match.
- **The default list is narrow.** click (with double-click and right-click),
  tap, hover, scroll, drag, `fill in`, `fill out`, `navigate to`, `type … into`,
  `press … button|key`, `refresh|reload … page`, `check|uncheck|tick …
  box|checkbox` and `visit … page|url|link`. The known-ambiguous verbs `enter`,
  `select`, `submit` and `open` are left out, for a site to add with `extend`.
- **The selector signal.** A quoted argument that starts with `#` or `.` and then
  a letter, `_` or `-`, or holds both `[` and `=`, is flagged as a CSS selector.
- **Keyword scope.** `And`, `But` and `*` take the type of the step before them
  within the same Background or Scenario. A leading conjunction stays `unknown`
  and is never linted.
- **One warning per step.** A phrase match wins over the selector signal. The
  warning gives the file and line (a fence: the host page and its line), quotes
  the step, names the match and suggests describing the behaviour instead.
- **English only.** The phrase list is English, so a feature whose
  `# language:` is neither `en` nor `en-*` is skipped. The language comes from
  the parsed document.

### 3. A suppression tag, `@dk:allow=imperative`

- On a Feature it covers every step. On a Rule it covers that Rule's Background
  and scenarios. On a Scenario or Scenario Outline it covers that scenario.
- `allow` is the first `@dk:` key read below Feature level. At Feature level
  it is a known, repeatable metadata key that feeds no frontmatter. At Rule and
  Scenario level the lint reads it directly.
- Any other value warns once, `unknown @dk:allow value "<v>" (expected
  imperative); ignored` (an empty value reads `metadata tag @dk:allow= has no
  value`), and suppresses nothing. One formatter in `feature-core.mjs` serves
  the frontmatter parse and the lint.
- In a fence, `@dk:allow` does not trigger the "metadata tags have no effect"
  warning, because the lint reads it there.

## Consequences

### Positive

- One map replaces the repeated tags. The example site's shipping features drop
  `@dk:context=shipping`, and the HR page resolves `policy` to `hr`.
- The resolved context is in committed frontmatter, so the data path stays
  visible. That answers ADR-0028's "hidden data path" objection for generated
  pages.
- A typo in a context name is now reported, closing a promise the schema
  comment made and nothing kept.
- Authors get a pointer to UI-scripted steps at no risk. With both options
  unset, every generated page and every build log is unchanged.

### Negative

- The context map is written twice in a site that runs the drift gate: in the
  config and as CLI flags. The parity test pins this, as it does for `titles`.
- **The generator stamp ignores config-only changes.** `content_hash` covers
  the source bytes only, so changing only the map rewrites `glossary_context`
  but keeps `generated.at`. `sourceUrlPrefix` has the same gap already; this
  ADR does not fix it.
- **Fence warnings can be lost on a cache hit.** A fence is linted when its page
  renders. A page that the content layer serves from its cache, as on a
  dev-server restart, prints no warnings. Generated pages are linted on every
  run and are the authoritative surface.
- The lint skips non-English features. A silent run on a Dutch feature is not a
  clean result.
- `validate:features` neither lints nor checks contexts, so CI sees these
  warnings only in the site build log.

### Risks

- **False positives on domain language.** A docs site's own domain may use a
  listed verb ("the student hovers over a term"). The lint is off by default,
  the list is narrow, and `@dk:allow=imperative` or a `verbs` list fixes a case.
- **Warning fatigue.** A large suite turned on at once may print many warnings.
  They never fail the build, and `keywords` narrows the scope.

## Alternatives considered

### Contextive `contexts[].paths` as the folder default

The glossary schema already maps paths to contexts. Rejected (D5): Contextive's
`paths` give many-to-many visibility, while a page needs exactly one context. It
would need a tie-break rule, glob matching and a loader change.

### Exact folder matching, like `titles`

Simpler, and the same rule as `titles`. Rejected (D6): bounded contexts nest,
and a subfolder should inherit its parent's context without its own key.

### A Vale rule

Vale already runs in CI. Rejected: the CI gate filters out warning-level rules,
Vale reports Markdown lines rather than `.feature` lines, and it cannot see
keyword types, placeholders or quoted arguments.

### A lint flag on the CLI

It would let `validate:features` lint in CI. Rejected for now (D1): the setting
would be duplicated as flags, and the drift gate is not a lint. It can be added
later without breaking anything.

### A broad default list

Including `enter`, `select` and `submit` catches more. Rejected (D2): each fires
on the example site's own domain language ("submit the declaration"), so they
are documented for `extend` instead.

## References

- Issues [#196](https://github.com/spec-kitty/doc-kitty/issues/196) and
  [#197](https://github.com/spec-kitty/doc-kitty/issues/197).
- [Gherkin authoring aids (research)](../architecture/research/gherkin-authoring-aids.md),
  decisions D1 to D8.
- [Gherkin feature pages](../architecture/gherkin-pages.md), the architecture.
- [ADR-0046](./0046-gherkin-feature-pages.md),
  [ADR-0028](./0028-glossary-frontmatter-fields.md),
  [ADR-0051](./0051-gherkin-in-any-page.md),
  [ADR-0054](./0054-gherkin-draft-hubs-titles-and-scenario-route.md).
