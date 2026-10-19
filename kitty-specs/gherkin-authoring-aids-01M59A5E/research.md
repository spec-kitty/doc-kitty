# Research: Gherkin authoring aids and Specification layout

The pre-spec research is
[`docs/architecture/research/gherkin-authoring-aids.md`](../../docs/architecture/research/gherkin-authoring-aids.md).
It covers prior art, design options, the operator's decisions D1–D13 and the
squad findings. This file holds only the plan-phase decisions that refine or
extend it. Each entry gives the decision, its rationale and the alternatives.

## R-01 Where the folder default resolves

- **Decision**: resolve it in `buildFrontmatter` (feature-core), with the
  folder default looked up in `generate.mjs` from `FeatureFile.relPath`. The
  precedence is a non-empty `@dk:context` tag, then the longest folder key by
  path segment, then none.
- **Rationale**: there is one resolution point (C-001). The value lands in
  committed frontmatter, so every existing reader (auto-linker, scenario index,
  `/api/pages`, `llms.txt`) sees it unchanged. That answers ADR-0028's
  "hidden data path" objection for generated pages.
- **Alternatives**:
  - Resolve in the auto-linker. Rejected: it creates a second reader and hides
    the data path.
  - Use Contextive `paths`. Rejected by the operator (D5).

## R-02 Where the unknown-context check runs

- **Decision**: the check lives in `generate.mjs` and takes an optional set of
  known context names. The build integration passes the names from
  `loadGlossary(root)` when the glossary is present. The CLI passes none, so it
  does not check.
- **Rationale**:
  - The CLI is plain `.mjs` and cannot import the TypeScript glossary loader:
    its `.js` specifiers resolve to `.ts` sources only under Vite.
  - Reading `definitions.yaml` again in the CLI would be a second parser, which
    C-001 and the reuse rule forbid.
  - FR-006 asks for a *build* warning, and `validate:features` is a drift gate,
    not a lint.
- **Alternatives**:
  - A context-name reader in `.mjs` for the CLI. Rejected: it duplicates the
    parser.
  - Run the CLI under a TypeScript loader. Rejected: it changes how a public
    script runs.
- **Deviation from alignment A1**: A1 said "in both the build and the CLI".
  This narrows it to the build. It is recorded here and reported to the operator
  at the end of the plan phase.

## R-03 What a warning reports for an unknown context

- **Decision**: one warning per page, naming the file, the context and its
  origin: `[dk-gherkin] <relPath> glossary context "<ctx>" (from <@dk:context
  tag | gherkin.defaultGlossaryContext key "<key>">) is not a context in
  .contextive/definitions.yaml; terms on this page cannot be disambiguated by
  it`.
- **Rationale**: naming the origin lets the author fix the right place. Keep the
  existing `[dk-gherkin] <file>` prefix style.
- **Alternatives**: one summary line per context. Rejected: it loses the file.

## R-04 Default phrase list and matcher

- **Decision**: entries are case-insensitive regular expressions over the step's
  `text` segments, joined with placeholders shown as `<…>` and quoted arguments
  shown as `"…"`. A word boundary sits on both sides.
  - **Default heads** (each inflected): click (plus double-click and
    right-click), tap, hover, scroll, drag, `fill in`, `fill out`,
    `navigate to`, `type "…" into`, `press … button|key`,
    `refresh|reload the page`, `check|uncheck|tick … box|checkbox`,
    `visit … page|url|link`.
  - **Selector signal**: a quoted argument that matches `^[#.][A-Za-z_-]` or
    contains `[` plus `=`.
  - `verbs` and `extend` take plain words or phrases. These compile to the same
    boundary-anchored, inflection-tolerant pattern. Raw regex is not accepted in
    v1, to keep the configuration safe and documentable.
- **Rationale**: these choices follow the wording-lens findings and avoid
  substring traps of the kind cuke_sniffer has. Plain words keep the option
  documentable.
- **Alternatives**: user-supplied regex (gplint style). Deferred: it can be
  added later without breaking changes.

## R-05 Keyword-type resolution

- **Decision**: `StepView.keywordType` is one of `context`, `action`, `outcome`
  or `unknown`, from `@cucumber/messages` `keywordType`. A `Conjunction` or
  `Unknown` step inherits the previous step's type within the same section.
  Background steps start their own chain. The first step stays `unknown` when
  there is nothing to inherit, and `unknown` steps are never linted.
- **Rationale**: this matches the pickle compiler's semantics and is
  dialect-neutral.

## R-06 Suppression tag semantics

- **Decision**:
  - `@dk:allow=imperative` is accepted on a Feature, Rule, Scenario or Scenario
    Outline. It is inherited downward, so a Feature tag covers everything.
  - At Feature level `allow` is a known metadata key. It is repeatable and does
    not feed frontmatter.
  - At Rule and Scenario level the lint reads it directly.
  - Any other value warns once: `unknown @dk:allow value "<v>" (expected
    imperative)`.
  - `hasMetadataTag` (the fence "no effect" warning) ignores `@dk:allow`.
  - `displayTags` already hides it from rendered chips.
- **Rationale**: the key/value grammar already exists. Naming the intent
  ("allow") fits ADR-0046 better than a tool word ("lint-off").

## R-07 Draft notice placement and markup

- **Decision**: `PageTitle.astro` renders `<DraftNotice/>` after the metadata
  band position for any page whose `doc_status` is `draft`. It is a static
  `<p class="dk-draft-notice">` with a visually hidden "Document status:" lead
  and the visible text "Draft. This page is work in progress and may change."
  It has no landmark role and no `role=alert`. It is styled with
  `--dk-color-warning` and `--dk-color-warning-bg`.
- **Rationale**: one carrier for all kinds (D10, A4). Starlight's own `draft`
  notice keys on a different field, and its `banner` is outside the token
  bridge.
- **Note**: the notice text is generic ("page"), because it shows on every kind.
  The Specification card does not repeat it.

## R-08 Specification card content and degradation

- **Decision**: `Specification.astro` renders, before the content slot, a
  `<section class="dk-spec-card" aria-labelledby>` with a visually hidden heading
  "Specification details". It contains:
  - **Tags**: `displayTags`-equivalent frontmatter `tags`, as a `<ul>` of text
    chips. Omitted when empty.
  - **Source**: from `sources[0].resource`. The generator already writes it as
    `sourceUrlPrefix + relative path` (the scenario index inverts exactly that),
    so an absolute `http(s)://` resource renders as a link, and anything else as
    plain monospace text. Omitted when absent. The decision lives in a pure
    helper (`src/lib/spec-card.ts`) so both forms are unit-tested.

  An authored `kind: Specification` page with none of these renders no card, and
  the content renders as with `Default`.
- **Rationale**: FR-014 and FR-017, with the degradation in acceptance scenario 4.
- **Results summary (operator decision `01M59CQM76Q0NJ3F3GM1S8BYAN`)**: the
  card does not show one. The ADR-0055 overlay already renders
  `p.dk-gherkin__results` in the body after the scenario count. Moving it would
  need a new data path from the remark overlay to the layout and would change
  ADR-0055 output, so it stays in the body only.

## R-09 Example site demonstration

- **Decision**: `example/astro.config.mjs` sets `defaultGlossaryContext: {
  shipping: 'shipping', hr: 'hr' }` and `lint: { imperativeSteps: true }`.
  - The three shipping features drop `@dk:context=shipping`.
  - The root `validate:features` script gains
    `--default-glossary-context shipping=shipping --default-glossary-context hr=hr`.
  - An `hr` context must exist in `example/.contextive/definitions.yaml`. It
    does (line 39).
- **Rationale**: it shows SC-001 live and fixes the "policy" collision. With the
  lint on and zero warnings, the example proves NFR-002.

## R-10 Squad findings carried into the plan

Each finding from the pre-spec squad has a disposition:

| Finding | Disposition |
|---|---|
| Geometry lane never visits a feature page | Accepted: FR-018, IC-08 |
| Draft pages show no status | Accepted: FR-016, IC-06 |
| Generator stamp ignores config-only changes | Deferred with rationale: pre-existing (`sourceUrlPrefix`); documented in `gherkin-pages.md` Limits by IC-07 |
| Fence lint lost on content-layer cache hits | Accepted as a documented limit (IC-05) |
| Double `<h1>` on pages | Deferred with rationale: site-wide, not this mission; issue to be filed (side finding) |
| Stale "#113" pointer | Accepted: fixed in IC-07 |
| `convention.md` vs `AGENTS.md` on `kind` | Deferred with rationale: unrelated contract drift; issue to be filed |
| "hover" is domain language in the consumer fixture | Accepted: the lint is off by default and the consumer fixture does not enable it |
