# Findings E — Doctrine & Style-Guide Discovery for doc-kitty

Read-only discovery of (1) the generic style-guide artefacts bridged into a
client project's `.kittify/doctrine/styleguide`, and (2) the wider Spec-Kitty
("spk") doctrine tree, assessed for authoring a software-development /
project-documentation docsite. All org/client/product/domain specifics are
redacted to `<client>`/`<term>`; only generic, portable mechanisms are captured.

## Top takeaways

- **A near-complete docsite doctrine already exists** in Spec-Kitty's built-in
  packs: a Divio-typed **documentation mission** (discover → audit → design →
  generate → validate → publish), a **Common Docs** information architecture
  (single root, 13 sections, ADR eras), plus styleguides for plain language,
  accessibility, freshness, publication authority, citation discipline, and
  glossary writing. doc-kitty should adopt rather than reinvent.
- **"Teach, then link" progressive disclosure** is the strongest reusable
  writing doctrine: hubs/landings open with 1–2 sentences answering the reader's
  question, link jargon at first meaningful use to a canonical glossary, and
  leave catalogues to owning pages.
- **Divio type discipline is the single highest-leverage structural rule**: one
  page = exactly one of Tutorial / How-To / Reference / Explanation, declared in
  frontmatter. "Wrong quadrant" is called the most common documentation defect.
- **Accessibility is a design input, not a post-hoc checklist** — semantic HTML
  first, one H1 + unbroken heading outline, meaningful alt/link text,
  keyboard-operable with visible focus, 4.5:1 contrast, reduced-motion honoured,
  and "accessibility must survive composition." Automated a11y catches only ~57%;
  a named manual checklist is mandatory.
- **Design tokens as single source of truth + BEM naming + no override sprawl**
  is the portable core of the frontend styleguides (org-specific token prefixes
  and design-system authority are not portable and are redacted).
- **Living documentation is enforced, not aspirational**: code is source of
  truth; every behaviour-changing change updates its docs in the same commit;
  generatable reference is generated, never hand-copied; a freshness SLA
  (`updated:` date + tiered staleness) backstops silent drift.
- **Frontmatter is the per-page contract**: `doc_status`
  (draft|active|deprecated|superseded, never bare `status`), `updated:
  YYYY-MM-DD`, bounded SEO `description` (50–180 chars), `related:` list of
  resolvable paths — all machine-checkable at build time.
- **Diagram-as-code doctrine ("show me") is available and audience-aware** (C4
  progressive zoom, Mermaid/PlantUML toolguides): pick the smallest checkable
  visual, keep durable docs as diagram-as-code, and never let a diagram replace
  accessible prose.

---

## PART 1 — Style guide (generic guidance extracted)

Three artefacts: an architecture-description **prose** styleguide
(project-authored, generic), and two **frontend** styleguides (a portable
HTML/SCSS+a11y one and an org-concrete slide one). A design-review **procedure**
and a quality-tooling **toolguide** bind them into a gate.

### Writing / tone

- **Teach, then link.** A hub/landing MUST open with 1–2 sentences answering the
  reader's question, then point to the owning page. A bare list of child
  filenames ("inventory-only landing") is insufficient.
- **Progressive disclosure & progressive mental-model build.** Introduce one
  layer at a time in causal order (motivation/goals → context → response →
  capabilities → decisions/tools/delivery → outcomes/evidence); each section
  depends only on concepts already introduced. Never front-load the whole
  taxonomy. Prefer a short explanation + one deliberate link over a dense
  qualified paragraph.
- **Link jargon at first meaningful use** to its canonical glossary definition;
  link the term itself, not a trailing "see glossary"; later uses on the same
  page stay unlinked.
- **One question per heading, answered immediately.** A heading MAY be introduced
  by a short italic question the reader would actually ask; the next paragraph
  answers it in domain language, not by restating the heading.
- **Define the term, then use the canonical name.** First mention matches the
  glossary lock; an everyday gloss may appear once but must not replace the
  canonical name later.
- **Plain language, calibrated to a named audience** (not a fixed reading grade):
  prefer the short common word ("use" over "utilise"), one idea per sentence,
  short paragraphs, bottom-line-up-front. A tutorial assumes no jargon; a
  reference for working developers may use precise terms without redefining them.
- **Voice discipline:** second person ("you can read…") is for orientation/
  teaching a map, not for policy ("you must"); state the architecture rather than
  issuing imperatives. No hedged vocabulary ("so-called", scare-quotes around
  locked terms), no bold-as-urgency (bold only the locked element type at first
  use), no emoji, sentence-case headings.
- **Minimal, rationale-backed edits; preserve the author's voice and facts.**
  When editing, make the smallest change that fixes the problem and say why; do
  not introduce new facts or alter conclusions without approval.
- **Evidence discipline (research/explanatory prose):** every factual claim is
  traceable to a named source; separate what a source states from the author's
  inference; tier evidence (primary/reproducible > secondary > anecdotal) and
  name the tier when material.

### Structure / information architecture

- **Divio type discipline** — one page is exactly one of Tutorial / How-To /
  Reference / Explanation, declared in frontmatter. Match type to reader
  *situation*, not authoring convenience. Tutorials are learning-oriented and
  MUST NOT branch (no alternatives/caveats/edge cases — those go in
  how-tos/reference).
- **Single documentation root, sectioned IA.** One Common Docs root with a fixed
  section set (index, context, architecture, adr, plans, api, configuration,
  integrations, security, guides, operations, migrations, changelog); each
  directory carries its own `index.md`. No second root, no per-version shadow
  tree.
- **Hubs are navigation, not a second source of truth.** After a definition, one
  sentence may send the reader to the hub; do not duplicate the child-page
  inventory the hub already owns, nor add a tautology repeating the heading.
- **Keep why / what / how on separate layers** (motivation = why, response =
  high-level what, engineering/plans = how); a layer must not claim to contain
  another layer's content.
- **Counts must match the living corpus.** If prose says "N value streams", the
  table has N rows with authored pages (or an explicit candidate status).
- **Tables explain**: inventory/comparison tables include a short "what is this?"
  column, not only a path; link names only where a page exists.
- **Drill-down consistency:** capture decisions/docs/architecture at a consistent
  abstraction level per audience; don't hop between strategic rationale and
  implementation minutiae on one page.
- **Curate by delete-stale:** one concern per file; distil stale/deprecated docs
  into a decision (ADR) or design and retire them rather than accumulating a
  wiki.

### Astro / frontend / components

*(Portable HTML/SCSS + component conventions. Org-specific token prefixes and a
proprietary design-system's authority are redacted; the mechanisms below are the
generic residue.)*

- **Semantics lead, styling follows.** Choose the native element whose *meaning*
  matches the content, then style it. No styling methodology (utility-first, CSS
  Modules, `@scope`) may justify rebuilding a native element from `<div>`/
  `<span>`.
- **Native interactive elements** (`<button>`, `<a href>`, `<input>`,
  `<details>`) over reconstructed ones. First rule of ARIA: if native HTML gives
  the semantics, use it; misused ARIA is worse than none.
- **Design tokens are the single source of truth.** Colour, spacing, type, radius
  via CSS custom properties; raw hex/magic numbers MUST NOT appear outside the
  token layer; components consume tokens, never re-derive values. (Org variant:
  tokens single-sourced in SCSS, bridged to custom properties; a hardcoded
  fallback may only equal the token's real value.)
- **Specificity strategy first, methodology second.** Keep specificity low→high:
  zero-specificity base with `:where()`, utilities as the last-word layer,
  `!important` confined to a documented, inline-justified override surface.
  `@layer` may make ordering deterministic — but unlayered CSS beats all layered
  CSS, so vendor CSS must be imported into a layer first.
- **One documented class-naming convention** (BEM `block__element--modifier` or a
  declared equivalent); nesting depth ≤ 2; state/variant as a modifier class,
  never an ad-hoc descendant selector or inline style. Each component declares its
  block in a header comment.
- **No override sprawl:** a parent MUST NOT restyle a child block by targeting the
  child's element from outside; ad-hoc inline `style=` is the dominant recurrent
  defect and is banned.
- **Modern build hygiene:** Sass `@use`/`@forward`, never deprecated `@import`;
  reach for a preprocessor only for authoring-time value (module system,
  maps/loops), not for what the platform now ships.
- **Declared browser-support floor** (a Baseline maturity level), enforced at
  build; emerging features guarded with `@supports`; non-evergreen render targets
  (print/PDF) get a separate support policy.
- **Overflow discipline:** content must not be clipped/lost on overflow, at 200%
  zoom, or under WCAG 1.4.12 text-spacing; a single named container is the
  canonical overflow boundary, targeted by both the containment rule and the
  overflow test.
- **Layout lives on an inner wrapper, never on the outermost section/surface
  element** (generic form of the slide/canvas DOM-contract rule).

### Metadata / frontmatter

- **Frontmatter is the per-page source of truth**; rollup inventories are
  regenerated *from* frontmatter as a freshness-gated lockfile, never
  hand-maintained in parallel.
- **Lifecycle key is `doc_status`** with controlled vocabulary `draft | active |
  deprecated | superseded` — bare `status` is prohibited (collides with
  work-package lane status).
- **`updated: YYYY-MM-DD`** = date content was last verified against reality (not
  an incidental typo fix); the input to every staleness check. A page without one
  is stale by default.
- **`description`** string bounded to **50–180 characters** for SEO
  post-processing; out-of-band descriptions are rejected.
- **`related:`** = list of repo-relative `.md` paths that each resolve to an
  existing file (validated at build). Purely associative links move to
  `related:`; only the reader's natural next step stays inline.
- **Body serves the reader; frontmatter carries bookkeeping.** A landing must not
  reproduce its `related:` list as an in-body table, nor narrate corpus mechanics
  the reader didn't ask about.
- **Naming:** lowercase kebab-case files/dirs, section-scoped; ADR filenames keep
  a dated prefix; one concern per file. ADRs filed under `adr/<era>/` with YAML
  frontmatter so the docsite can index them.

### Accessibility

- **Exactly one `<h1>`; headings descend by one with no skipped ranks** — no
  document-outline algorithm exists, AT reads literal rank, so `<section>`
  nesting never demotes a heading (WCAG 1.3.1 A, 2.4.6 AA).
- **Landmark structure:** one `<main>`; named regions (a `<section>` needs an
  accessible name to be a region); unique labels for repeated landmarks.
- **Images & tables:** every `<img>` has `alt` (decorative → `alt=""`/
  `aria-hidden`; informative → meaningful alt conveying the same information,
  describing what it says not that it's an image); real data tables use
  `<table>`+`<caption>`+`<th scope>`, never `<div>` grids.
- **Contrast & colour:** text 4.5:1 (3:1 large), non-text indicators 3:1; meaning
  never by colour alone.
- **Keyboard & focus:** all functionality keyboard-operable, visible focus
  indicator, logical order, no keyboard trap, no positive `tabindex`; focused
  element not obscured by sticky chrome (reserve `scroll-padding`); theme must not
  strip focus outlines.
- **Honour `prefers-reduced-motion: reduce`.**
- **Meaningful link text out of context** — states destination/action; "click
  here", "this", "read more", bare URLs prohibited.
- **Accessibility must survive composition:** injectable heading rank (not
  hard-coded per component), composable accessible names, collision-free `id`s for
  reused components, no nested interactives, slotted content keeps its own
  semantics.
- **Automated a11y is a ~57% floor, never proof** — closed by a defined,
  non-optional manual checklist (focus order, meaningful alt, text-over-image
  contrast, reflow, screen-reader spot-check).

### Other — design-review gate & quality tooling (portable process)

- **Design-review procedure** (runs *between* planning and task decomposition):
  (1) confirm scope + WCAG conformance target (default WCAG 2.2 AA); (2) draft the
  semantic DOM outline; (3) settle CSS-architecture decisions (specificity
  strategy, naming, tokens, support floor, overflow boundary); (4) set the
  MUST/SHOULD/manual quality gate and name BDD/acceptance scenarios traced to
  specify-step acceptance criteria; (5) accessibility-composition check; (6) human
  sign-off. Anti-patterns: deferring a11y to code review; decomposing before the
  DOM outline is settled; an all-automated gate; deferring behavioural-scenario
  definition to implementation.
- **Frontend quality toolguide — six categories (portable by category, no package
  mandated):** (1) linters (catch invalid *and* valid-but-disallowed patterns; a
  rule with no CI gate is only a suggestion); (2) formatters; (3) build
  integration / Baseline support floor; (4) a11y + HTML validation on rendered DOM
  at component *and* composed-document granularity (~57% ceiling); (5) visual
  regression; (6) functional/behavioural testing (ATDD/BDD/e2e — every other
  category is blind to behaviour). Concrete packages/versions pinned in the
  project's own charter/repo.

---

## PART 2 — Doctrine packs relevant to docsite authoring

Doctrine is stored as typed artefacts under `packs/built-in/<kind>/`
(styleguides, paradigms, tactics, directives, procedures, toolguides, missions,
assets) plus `.kittify/doctrine/<kind>/` for project layers.

| Pack / artefact (kind) | One-line purpose | Relevance | How to apply in doc-kitty |
|---|---|---|---|
| **documentation mission** (mission) | Divio-typed workflow: discover→audit→design→generate→validate→publish; initial / gap-filling / mission-specific modes | Core | Backbone mission type; reuse its state machine, Divio scaffolds, and generator configs (JSDoc/Sphinx) |
| **divio-type-discipline** (styleguide) | One page = one Divio quadrant, declared in frontmatter | Core | Enforce a `divio_type` frontmatter field + build check; drive per-type templates |
| **common-docs** (styleguide) + **DIRECTIVE_042** + **DIRECTIVE_037 living-docs-sync** | Single-root 13-section IA, frontmatter contract, ADR eras, delete-stale; behaviour change updates docs same-change | Core | Adopt IA + frontmatter schema as doc-kitty's build-validated contract |
| **docs-accessibility** (styleguide) | Screen-reader-first: alt text, unbroken heading outline, meaningful link text | Core | Build-gate + manual checklist for every published page |
| **docs-freshness-sla** (styleguide) | `updated:` date + tiered staleness thresholds by volatility | High | Staleness report in the audit action; tutorials/how-tos tightest, ADRs slowest |
| **publication-authority** (styleguide) | Code is source of truth; generatable reference is generated; same-change doc updates | High | Prefer generated API/CLI reference; flag hand-copied signatures as drift |
| **plain-language** (styleguide) | Calibrate prose to a named audience; short words, one idea/sentence, BLUF | High | Pair with audience personas; apply in generate/validate actions |
| **professional-communications** (styleguide) + **writing-audience personas** (assets: engineer, automation agent, framework team, line manager, non-tech educator) + audience directive | Persona-first authoring; starter persona library | High | Select target audience at discover time; personas set tone/depth per page |
| **kitty-glossary-writing** (styleguide) + **glossary-curation-interview** (tactic) | Clear, functional, one-concept definitions; HiC candidate→canonical flow | High | Glossary authoring rules + term-intake workflow; feeds first-use linking |
| **domain-driven-design** (paradigm, Ubiquitous Language) + **contextive** / **terminology-guard** (toolguides) | One language across code/model/docs; guard superseded terms in prose/CI | High | Contextive-managed glossary + CI terminology guard to prevent drift |
| **DIRECTIVE_003 decision-documentation** + **adr-drafting-workflow** / **traceable-decisions** (tactics) | Capture decisions with alternatives + rationale as durable ADRs; link changes to decision | High | ADR section + templates; the "why" layer of Explanation pages |
| **c4-incremental-detail-modeling** (paradigm) + **spk-doctrine-show-me** + **mermaid/plantuml** (toolguides) | Progressive-zoom architecture diagrams; smallest checkable visual; diagram-as-code | High | Architecture/Explanation pages; durable docs as diagram-as-code |
| **drill-down-documentation** (procedure) | Keep each doc layer at a consistent abstraction/audience; no level-hopping | Medium | Guides the design action's outline; complements Divio typing |
| **documentation-gap-prioritization** (procedure) | Triage doc gaps by user impact, fill in priority order | Medium | The audit→design bridge for gap-filling mode |
| **research-citation-discipline** (styleguide) | Every claim sourced; evidence vs inference; tier evidence | Medium | Research/explanatory and reference-heavy pages |
| **reasons-canvas-writing** (styleguide) | Summary-first sections; capture intent not code; link don't duplicate | Medium | Optional for design/decision narrative pages |
| **planning-and-tracking** (styleguide) | Functional epics own work; meta-trackers only reference; collapse passthrough tiers | Low–Med | If doc-kitty tracks a docs backlog/roadmap |
| **frontend-design-review** (procedure) + **frontend-quality-tooling** (toolguide) + **frontend-authoring** (styleguide) | Semantic/a11y/CSS gate before decomposition; six tool categories; token+BEM+a11y authoring | High (the Astro theme itself) | Govern doc-kitty's own Astro/React/TS build and component library |
| **atomic-design** (paradigm) | Component composition floor (atoms→molecules→organisms) | Low–Med | Structuring the docsite's own component library |
| **semantic-compression** (paradigm + tactics) | Behaviour-preserving reduction of over-expanded implementations | Low (meta) | Applies to doc-kitty's own codebase, not authored docs |

### Recommended doctrine set for doc-kitty

- **Adopt as the spine (Core):** the **documentation mission** +
  **divio-type-discipline** + **common-docs** IA/frontmatter contract (with
  **DIRECTIVE_042** and **DIRECTIVE_037 living-documentation-sync**) +
  **docs-accessibility**. Gives a typed workflow, a validated file/frontmatter
  contract, and an a11y gate out of the box.
- **Layer on (High):** **docs-freshness-sla**, **publication-authority**,
  **plain-language** + **professional-communications** + **audience personas**,
  **kitty-glossary-writing** + **glossary-curation** + **contextive**/
  **terminology-guard**, **DIRECTIVE_003** ADR doctrine (+
  **adr-drafting-workflow**), and **c4** + **show-me** + **mermaid/plantuml** for
  visuals. For doc-kitty's own Astro theme, adopt **frontend-authoring** +
  **frontend-design-review** + **frontend-quality-tooling** (redacting
  org-specific token/design-system authority).
- **Optional (Medium/Low):** drill-down-documentation,
  documentation-gap-prioritization, research-citation-discipline,
  reasons-canvas-writing, planning-and-tracking, atomic-design.

---

## Summary

**(a) Most useful style-guide rules to encode in doc-kitty:**

1. Divio type discipline — one page = one of Tutorial/How-To/Reference/Explanation, in frontmatter.
2. "Teach, then link" progressive disclosure — landings answer the question first, then link jargon at first use to a canonical glossary.
3. A build-validated frontmatter contract — `doc_status` (draft|active|deprecated|superseded, never bare `status`), `updated: YYYY-MM-DD`, `description` 50–180 chars, `related:` resolvable paths.
4. Single documentation root with a fixed sectioned IA + ADRs under `adr/<era>/`; kebab-case, one concern per file, curate by delete-stale.
5. Accessibility as a design input — one H1 + unbroken heading outline, meaningful alt/link text, keyboard + visible focus, 4.5:1 contrast, reduced-motion, "survives composition"; automated a11y is a ~57% floor needing a manual checklist.
6. Living docs / publication authority — code is source of truth, generatable reference is generated, behaviour change updates docs same-change; a freshness SLA backstops drift.
7. Plain language calibrated to a named audience; design tokens as single source of truth + BEM + no override sprawl for the theme.

**(b) Doctrine packs most worth adopting:** the built-in **documentation
mission**; **divio-type-discipline**, **common-docs** (+ living-documentation-sync
and common-docs directives), **docs-accessibility**, **docs-freshness-sla**,
**publication-authority**, **plain-language** styleguides; **audience personas** +
**professional-communications**; **kitty-glossary-writing** +
**contextive**/**terminology-guard** for ubiquitous language; **DIRECTIVE_003** +
**adr-drafting-workflow** for decision records; **c4** + **show-me** +
**mermaid/plantuml** for diagram-as-code. For doc-kitty's own Astro theme:
**frontend-authoring** + **frontend-design-review** gate + **frontend-quality-tooling**.

---

## Source locations (sanitized)

Client-specific absolute paths and org pack names redacted. The reusable doctrine
lives in the Spec-Kitty doctrine tree:

- A project-authored, generic **architecture-writing prose styleguide** bridged
  into the client's `.kittify/doctrine/styleguide/` (org-specific filename
  redacted).
- Portable **frontend-authoring** styleguide + **frontend-design-review**
  procedure + **frontend-quality-tooling** toolguide, sourced from an
  org-specific factory pack (org pack name redacted).
- Built-in Spec-Kitty doctrine (generic, non-client): the richer/newer set at
  `SDD/fork/spec-kitty/packs/built-in/` — notably `missions/documentation/`,
  `styleguides/` (divio, plain-language, docs-accessibility, docs-freshness-sla,
  publication-authority), and `assets/audiences/`.
