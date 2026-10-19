# Mission Specification: Gherkin authoring aids and Specification layout

**Mission Branch**: `feat/gherkin-authoring-aids`
**Created**: 2026-10-19
**Status**: Draft
**Input**: Issues #196, #197, #198 (spec-kitty/doc-kitty). The research and the operator's thirteen decisions are in `docs/architecture/research/gherkin-authoring-aids.md`, and the Intent Summary was confirmed by the operator on 2026-10-19.

## Intent Summary (confirmed)

This mission serves a DocKitty site author and the readers of the site's generated
feature pages. It delivers three things:

- **Imperative-step warning (#196).** An author who turns it on gets build
  warnings for Given and When steps that describe UI mechanics instead of
  behaviour.
- **Folder default glossary context (#197).** An author can declare a glossary
  context once per source folder instead of tagging every feature file.
- **Specification layout (#198).** A reader of a specification page sees its
  tags and its source in a header card. A reader of any
  draft page sees that it is a draft.

Features that are off by default change nothing for sites that do not use them.

Amended in the plan phase by operator decision `01M59CQM76Q0NJ3F3GM1S8BYAN`:
the card no longer repeats the ADR-0055 results summary, which stays in the
page body.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declare a glossary context per folder (Priority: P1)

A site author keeps the shipping features under `features/shipping/` and the HR
features under `features/hr/`. Today every shipping file must carry
`@dk:context=shipping`. The HR files carry nothing, so the term "policy", which
both glossaries define, is reported as an unresolved collision. The author sets
`gherkin.defaultGlossaryContext` to `{ shipping: 'shipping', hr: 'hr' }`. Every
generated page from those folders then carries the right glossary context, and
"policy" on the HR page links to the HR definition.

**Why this priority**: It fixes a live defect in the example site (the "policy"
collision), and it is the smallest slice.

**Independent Test**: Configure the map in the example site, regenerate the
pages, and confirm three things:

- the HR page's frontmatter names `hr`;
- the build no longer reports the "policy" collision for that page;
- `validate:features` with the matching flag reports no drift.

**Acceptance Scenarios**:

1. **Given** the map `{ shipping: 'shipping' }` and an untagged
   `features/shipping/a.feature`, **When** pages are generated, **Then** that
   page's frontmatter has `glossary_context: shipping`.
2. **Given** the same map and `features/shipping/eu/b.feature` with no tag and no
   `shipping/eu` key, **When** pages are generated, **Then** the page's context
   is `shipping`. **And** if a `shipping/eu: customs` key is added, the context
   is `customs`.
3. **Given** a file under a mapped folder that carries `@dk:context=customs`,
   **When** pages are generated, **Then** the context is `customs`.
4. **Given** a file under a mapped folder that carries an empty `@dk:context=`,
   **When** pages are generated, **Then** the existing empty-tag warning is
   emitted and the folder default applies.
5. **Given** `features/billing/c.feature`, which no key maps, **When** pages are
   generated, **Then** its bytes equal the output with the option unset.
6. **Given** a key `ship` and a folder `shipping/`, **When** pages are generated,
   **Then** `ship` does not match `shipping/`.
7. **Given** a map value or a `@dk:context` tag naming a context the site
   glossary does not define, **When** the site builds, **Then** a warning names
   the file, the context and its origin (map or tag), and the build still
   succeeds.
8. **Given** a key that matches no folder containing a feature, **When** pages
   are generated, **Then** a warning names the unused key.

---

### User Story 2 - Get told when a step describes UI mechanics (Priority: P2)

A site author turns on `gherkin.lint.imperativeSteps`. The build then prints one
warning for each Given or When step that names a UI action, such as `When I
click "Book"`, `And I fill in "size" with "12"` or a quoted selector like
`"#book-button"`. Each warning gives the file and line, quotes the step, names
the matched word and suggests describing the behaviour instead. The author can
silence a deliberate case with `@dk:allow=imperative` on the Feature, the Rule or
the Scenario.

**Why this priority**: ADR-0046 promised it, and the authoring guide currently
says "Nothing checks for them yet". It is advisory, so it carries no risk to
existing sites.

**Independent Test**: Enable the option on a fixture with one imperative step and
one declarative step. Exactly one warning appears, the exit code is 0, and the
generated pages are byte-identical to a run with the option off.

**Acceptance Scenarios**:

1. **Given** the option is unset, **When** a feature containing `When I click
   "Book"` is generated, **Then** no imperative-step warning is emitted.
2. **Given** the option is on, **When** that feature is generated, **Then**
   exactly one warning is emitted for that step, naming the file, the line, the
   step and the word "click". **And** the build succeeds. **And** the page bytes
   equal the option-off output.
3. **Given** the option is on, **When** the steps are `When the shipper books the
   consignment` and `Given the customer enters a contract`, **Then** no warning is
   emitted.
4. **Given** the option is on, **When** a step contains the quoted argument
   `"#book-button"`, **Then** a warning is emitted for the selector.
5. **Given** the option is on with default keyword scope, **When** a `Then I click
   …` step and an `And I click …` that follows a `When` are linted, **Then** the
   `Then` step is not flagged and the `And` step is.
6. **Given** a Scenario tagged `@dk:allow=imperative`, **When** its imperative
   steps are linted, **Then** they produce no warning. **And** an untagged sibling
   scenario in the same file still produces its warning.
7. **Given** a feature declared `# language: nl`, **When** it is linted, **Then**
   no imperative-step warning is emitted.
8. **Given** an in-page `gherkin` fence with an imperative step, **When** the page
   builds with the option on, **Then** a warning is emitted with the host page's
   path and line. **And** a `gherkin raw` fence or an included feature produces
   none.
9. **Given** the option is `{ extend: ['select'] }`, **When** a step reads `When I
   select "Rotterdam"`, **Then** it is flagged. **Given** `{ verbs: ['tap'] }`,
   **Then** `click` is not flagged and `tap` is.

---

### User Story 3 - Read a specification page with its context visible (Priority: P3)

A reader opens a generated feature page. Above the scenarios, a card shows the
feature's tags and a "View source" link to the `.feature` file. When results
exist, the summary that ADR-0055 already places in the page body (such as
"Results: 1 failed, 3 passed") stays where it is, a few lines below the card. The "On this page" sidebar lists
the rules and scenarios as it does today. If the page is a draft (for example a
`@wip` feature), a text notice says it is a draft. Draft pages of every other
kind on the site show the same notice.

**Why this priority**: It is the largest slice and the only visual one. It also
fixes a real defect: drafts look exactly like active pages.

**Independent Test**: Build the example site and confirm three things:

- the shipping feature page shows the card with its tags and source link;
- the `@wip` track-consignment page and an authored draft page both show the
  draft notice;
- the accessibility and geometry lanes pass on both feature pages.

**Acceptance Scenarios**:

1. **Given** a generated page with tags and a source, **When** it renders,
   **Then** a labelled card shows each tag as text and names the source file. The
   name is a link when the site sets `sourceUrlPrefix`, so the source resolves
   to a URL, and plain text otherwise.
2. **Given** a generated page with scenario results, **When** it renders, **Then**
   the existing body results summary appears exactly once, and the card does not
   repeat it (operator decision, plan phase).
3. **Given** a page whose `doc_status` is `draft`, of any kind, **When** it
   renders with drafts published, **Then** a visible text notice says the page is
   a draft. **And** an `active` page shows no notice.
4. **Given** an authored page with `kind: Specification` and no source, **When**
   it renders, **Then** the card renders without a source link and nothing
   errors.
5. **Given** a theme that maps `Specification` to the default layout, **When** a
   feature page renders, **Then** it uses the default layout.
6. **Given** a feature page, **When** it renders, **Then** there is exactly one
   scenario navigation list (the "On this page" sidebar), and the card is not a
   navigation landmark.

---

### Edge Cases

- **Multiple sources.** With `sources: ['features', 'specs']`, a folder key
  applies to the matching folder under every source.
- **Lint wording.** A step whose only UI word sits inside a quoted argument, a
  placeholder, a doc string or a data table is not flagged.
- **Verb inflections.** "clicks", "clicked" and "clicking" are flagged. A verb
  embedded in a longer word, as "click" is in "clickstream", is not.
- **Draft notice when drafts are not built.** With `DK_PUBLISH_DRAFTS=off`, draft
  pages are not built, so no notice appears.
- **Scenario-level `@wip`.** It still renders as a tag on that scenario. It does
  not make the page a draft.
- **Malformed map.** A non-object map, a blank context value, a non-relative or
  backslash key, or `__proto__` as a key is a configuration error at startup.
- **Option without sources.** `defaultGlossaryContext` set without `sources` is
  a configuration error, as `titles` is.
- **Suppression tag in a fence.** `@dk:allow=imperative` in an in-page fence does
  not trigger the "metadata tags have no effect" warning.
- **Malformed suppression tag.** Any value other than `imperative` warns as an
  unknown value.

## Domain Language

| Canonical term | Meaning | Avoid |
|---|---|---|
| glossary context | A bounded context in the site glossary, carried on a page as `glossary_context` | "context" on its own (it is also a section type and a step keyword type) |
| imperative step | A step that describes UI mechanics rather than behaviour | "UI step", "lint error" (it is never an error) |
| Specification page | A page with `kind: Specification`. Generated feature pages are the main case | "feature page" when an authored Specification page is meant too |
| draft page | A page whose `doc_status` is `draft` | "@wip page" (`@wip` is one way to become a draft) |

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Folder default glossary context | As a site author, I want a `gherkin.defaultGlossaryContext` map from source folder to glossary context so that generated pages in a folder carry that context without a tag. | High | Open | [build] | no |
| FR-002 | Nearest-folder matching | As a site author, I want a key to apply to its folder and every subfolder, with the most specific key winning and whole folder names matched, so that nested bounded contexts work. | High | Open | [build] | no |
| FR-003 | Tag precedence | As a site author, I want a `@dk:context` tag to override the folder default, and an empty tag to fall back to it, so that exceptions stay explicit. | High | Open | [build] | no |
| FR-004 | Unmapped folders unchanged | As a site author, I want files in folders the map does not list to generate exactly as today so that adopting the option is safe. | High | Open | [ratchet] | yes, paired with the FR-001 positive case on the same fixture |
| FR-005 | CLI parity for the context map | As a maintainer, I want `validate:features` to accept a matching repeatable `--default-glossary-context dir=ctx` flag so that the drift gate reproduces the generated pages. | High | Open | [build] | no |
| FR-006 | Unknown glossary context warning | As a site author, I want a build warning when a map value or a `@dk:context` tag names a context the glossary does not define so that typos are caught. | Medium | Open | [build] | no |
| FR-007 | Unused folder key warning | As a site author, I want a warning for a map key that matches no feature folder so that stale keys are visible. | Low | Open | [build] | no |
| FR-008 | Opt-in imperative-step warning | As a site author, I want `gherkin.lint.imperativeSteps`, off by default, to warn about Given and When steps that name UI actions or quote CSS selectors so that my scenarios read as behaviour. | High | Open | [build] | no |
| FR-009 | Warn-only and output-neutral | As a site author, I want the imperative-step warning never to fail a build or change generated pages so that turning it on is risk-free. | High | Open | [build] | yes, paired with FR-008's warning assertion on the same fixture |
| FR-010 | Configurable verb list and scope | As a site author, I want to replace (`verbs`) or extend (`extend`) the documented default list and choose keyword types (`keywords`) so that the check fits my domain. | Medium | Open | [build] | no |
| FR-011 | Lint surfaces | As a site author, I want feature files and in-page `gherkin` fences checked, and included features and `gherkin raw` fences not checked, so that each step is warned about once. | Medium | Open | [build] | no |
| FR-012 | Suppression tag | As a site author, I want `@dk:allow=imperative` on a Feature, Rule or Scenario to silence the warning for that scope so that deliberate UI scenarios stay quiet. | Medium | Open | [build] | no |
| FR-013 | English only | As a site author, I want non-English features skipped, and the skip documented, so that a silent result is never mistaken for a clean one. | Low | Open | [build] | no |
| FR-014 | Specification header card | As a reader, I want Specification pages to show their tags and a source link in a labelled card above the content so that I can see where a spec came from. The ADR-0055 results summary stays in the body and is not repeated. | High | Open | [build] | no |
| FR-015 | Table of contents stays the scenario list | As a reader, I want the existing "On this page" sidebar to remain the only scenario navigation so that there is one outline. | Medium | Open | [ratchet] | yes, paired with FR-014's card assertion on the same page |
| FR-016 | Draft notice on every draft page | As a reader, I want every page whose status is draft to show a visible text notice so that I never mistake a draft for an authoritative page. | High | Open | [build] | no |
| FR-017 | Layout on by default with a theme opt-out | As a theme author, I want the Specification layout to apply to `kind: Specification` by default and to be replaceable through the existing per-kind layout mapping so that sites can opt out without a new option. | Medium | Open | [build] | no |
| FR-018 | Feature pages in the test lanes | As a maintainer, I want the generated and draft feature pages covered by the geometry lane, and the draft page by the accessibility lane, so that "passes the lanes" proves something. | Medium | Open | [build] | no |
| FR-019 | Documentation and decisions | As a maintainer, I want the consumer setup guide, the authoring guide, the Gherkin architecture page, two ADRs and the CHANGELOG updated so that the contract changes are recorded. | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Dormancy | With neither new option set, the generated pages of the example site are byte-identical to `main`. The only HTML changes are the draft notice on draft pages and the card on Specification pages | Compatibility | High | Open |
| NFR-002 | Lint false positives | With the lint on, the example site's committed `.feature` files and in-page fences produce 0 warnings on steps the authoring guide counts as declarative | Quality | High | Open |
| NFR-003 | Accessibility | Feature pages (active and draft) pass the axe lane with 0 violations in light and dark modes | Accessibility | High | Open |
| NFR-004 | Layout geometry | Feature pages have no horizontal overflow at every viewport width in the geometry lane | Usability | Medium | Open |
| NFR-005 | Token-only styling | New CSS contains 0 literal colour or spacing values; every such value is a `--dk-*` custom property, enforced by a test | Maintainability | Medium | Open |
| NFR-006 | Build cost | Turning the lint on adds under 5% to the example site's feature generation time | Performance | Low | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | One resolution point | The folder default resolves where generated-page frontmatter is built, not in the glossary, fence or include paths | Technical | High | Open |
| C-002 | One lint core | Generation and fences call one shared check, with no second rule set | Technical | High | Open |
| C-003 | Strict options | New option keys are validated under the existing unknown-key policy. The lint key is not a page key; the context map is | Technical | High | Open |
| C-004 | No new tokens required | Layout styling uses only today's `--dk-*` tokens. An optional semantic alias is allowed | Technical | Medium | Open |
| C-005 | Order and shape | One mission and one PR, delivered in the order #197, #196, #198 | Process | Medium | Open |
| C-006 | Never merge | The PR is left ready for review; the maintainer merges | Process | High | Open |

### Key Entities

- **Folder default map**: folder key (relative to a source) → glossary context
  name. It is a site setting, mirrored by a CLI flag.
- **Imperative-step rule set**: a default phrase list, an optional replacement or
  extension, a keyword-type scope, and a selector signal.
- **Suppression tag**: `@dk:allow=imperative`, scoped to a Feature, Rule or
  Scenario.
- **Specification card**: the tags and source link shown above a Specification
  page's content. The draft notice is rendered by the shared page-title carrier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The example HR feature page links "policy" to the HR definition with
  no unresolved-collision warning, and the three shipping features no longer
  need their context tag. — [build] · no-op passable: no
- **SC-002**: An author who enables the warning on a feature containing the
  authoring guide's two "reads badly" steps sees exactly two warnings, one per
  step, and a successful build. — [build] · no-op passable: no
- **SC-003**: 100% of draft pages in the example site show a draft notice, and 0
  active pages do. — [build] · no-op passable: no
- **SC-004**: On a site that sets `sourceUrlPrefix`, a reader can reach a
  generated feature's source file from its page in one click. — [build] · no-op passable: no
- **SC-005**: Sites that set neither new option see no change in generated
  feature pages (byte-identical), proven against the example site. — [ratchet] ·
  no-op passable: yes, paired with SC-001 on the same example site

## Assumptions

- **Collision warning.** Glossary linking already reports an unresolved
  cross-context collision. The new unknown-context warning is an additional,
  direct line.
- **Example-site changes.** The example site may change in two ways to
  demonstrate the features: shipping tags replaced by the map, and the HR
  mapping added. This changes committed generated pages, which is intended and
  drift-checked.
- **Issue #104.** #104 (token migration) stays blocked. The new layout is added
  to its migration list in the ADR.
