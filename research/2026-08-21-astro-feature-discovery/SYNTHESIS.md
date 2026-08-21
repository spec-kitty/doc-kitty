# Synthesis — doc-kitty feature roadmap from the discovery run

Date: 2026-08-21. Inputs: findings A–F (this directory). Purpose: turn the
desiderata into concrete, mission-sizeable changes to doc-kitty. No customer data
— all evidence is genericized/structural.

## How to read this

Each desideratum maps to: **what** the user wants → **evidence** (which findings
show a proven pattern) → **recommended approach for doc-kitty** → **effort** →
**dependencies**. A proposed mission slicing and a list of decisions-to-confirm
follow.

Baseline reminder: doc-kitty today is Astro + Starlight, static build, reads a
repo-root `docs/` Common-Docs — Kitty tree (README-as-index with frontmatter),
required frontmatter `title/description/status/updated/type`, optional `agent`
block, and emits `sitemap.xml` / `rss.xml` / `llms.txt` / `/api/*.json`.

---

## 1. Desideratum → change map

### 1.1 Metadata-driven headers/descriptions (content stays user-facing)

- **Evidence:** A§3, B§3 — the client renders status/description/audience/OG tags
  by **overriding Starlight's `MarkdownContent` and `Head`** components, injecting
  a metadata band *around* the authored body. Body Markdown never restates chrome.
  E confirms this as doctrine (frontmatter is the per-page contract).
- **Recommended:** Add Starlight component overrides to the toolkit:
  `MarkdownContent.astro` (mounts a status/description band + slots for
  audience/related/external-refs) and `Head.astro` (OG/Twitter/canonical from
  frontmatter + site origin). Keep them in the toolkit so every consumer site
  gets them.
- **Effort:** Low–Medium. **Deps:** none (foundation).

### 1.2 Audience descriptions (audience-oriented-writing + stakeholder links)

- **Evidence:** A§4, B§4 — `audience: [{ profile, guidance_text }]`; each
  `profile` is a kebab slug that **must resolve to a persona page** under
  `context/audience/<profile>.md`; rendered as a calm "Who is this for" `<aside>`
  (persona link + page-local guidance), mounted only when non-empty. E provides
  the doctrine (audience personas asset library + professional-communications +
  plain-language).
- **Recommended:** Adopt the field verbatim: `audience: [{ profile, guidance_text }]`
  (strict two-key), validated so `profile` resolves to a persona file; ship an
  `AudienceFor.astro` component + a seed persona template under
  `context/audience/`. Persona pages are the "stakeholder descriptions" link
  target.
- **Effort:** Medium. **Deps:** 1.1 (chrome injection), schema change.

### 1.3 Related pages — rendered, with reference **and** description

- **Evidence:** A§2, B§2 — client `related: string[]` is validated as a
  build-failing graph edge but **reference-only and never rendered on-page**.
  C (Hugo) shows the better pattern: related resolves to the **target page's own
  live `description`**, rendered as "title: description" — so the description need
  not be hand-copied. User refinement wants ref **+ description** and on-page
  display.
- **Recommended:** Two-part change:
  1. Allow `related` entries to be either a bare ref *or* `{ ref, note }` (Zod
     union). Resolve `ref` via Astro `reference()`/`getEntry`; render the target's
     own `description` by default, overridden by `note` when present.
  2. Ship a `RelatedLinks.astro` organism that renders the resolved list; validate
     refs at build (fail on dangling), matching the client's integrity guarantee.
- **Effort:** Medium. **Deps:** 1.1.

### 1.4 External references as metadata, rendered on the page

- **Evidence:** C (Hugo, the model) — pages carry a typed `further_exploration`
  array; `{type:"biblio"|"tool", id}` entries resolve against **shared catalog
  data files** (bibliography/tools), `{type:"raw", ...}` are inline citations; one
  catalog record drives inline list + index + detail page. A§7/B§7 confirm the
  client has **no** external-ref field (net-new for doc-kitty).
- **Recommended:** Add an `external_references` frontmatter field:
  `Array<{ url, title, note? } | { type:'biblio'|'tool', id }>`. Model
  `bibliography` and `tools` as **their own Astro content collections** keyed by
  `id`; a `<FurtherReading>` component resolves catalog entries via `getEntry` and
  renders `raw`/`url` entries inline. Optionally generate per-source detail pages
  (Hugo's "one record, three renderings").
- **Effort:** Medium (Large if detail-page generation included). **Deps:** 1.1.

### 1.5 Glossary — .contextive source, search, and term auto-linking

- **Evidence:** D (the how) — Contextive `.contextive/definitions.yaml` is plain
  YAML (`contexts[] → terms[] → {name, definition, aliases, examples, meta}`),
  parseable with any YAML lib; **one file feeds both the IDE (hover/autocomplete)
  and the docsite**. No official docsite generator exists → doc-kitty owns a small
  loader + page generator + a remark auto-linker (first-occurrence per node,
  alias-aware) + optional `<Term>` escape hatch. C (Hugo) shows the opt-in
  `{{< term >}}` popover + glossary data-file baseline. A§1/B§1: client glossary is
  bounded-context folders, no auto-linking, no contextive (net-new). E: glossary +
  DDD ubiquitous-language + terminology-guard doctrine backs this.
- **Recommended (staged):**
  1. **Source:** parse `.contextive/definitions.yaml` into a `glossary` collection
     (keep the file at the conventional path so IDEs light up).
  2. **Pages:** generate glossary page(s) with deterministic anchors
     (`#glossary-<term>`), grouped by bounded context.
  3. **Search:** Starlight Pagefind already indexes the generated pages; add a
     glossary index/filter view.
  4. **Auto-link:** a Starlight-native remark plugin fed by the term/alias→anchor
     map; link first occurrence per node, skip code/headings; optional hover
     tooltip; `<Term>` component for explicit control / false-positive suppression.
- **Effort:** Medium–Large (auto-linker is the bulk). **Deps:** none hard, but
  benefits from 1.1 component work.

### 1.6 Mermaid + PlantUML (live, build-time)

- **Evidence:** D (tools) — **Mermaid:** `@beoe/rehype-mermaid` → build-time
  static SVG, dark-mode, disk cache (needs Playwright/Chromium at build).
  **PlantUML:** `astro-plantuml` (remark, build-time SVG); default hits
  plantuml.com so **self-host** for privacy/offline. A§5/B§5: client pre-renders
  SVGs manually (a maintenance pain) — doc-kitty improves on it. Both unify as
  fenced code blocks → static SVG, no runtime JS. B/A also show a reusable,
  dependency-free `DiagramLightbox` worth lifting.
- **Recommended:** Wire `@beoe/rehype-mermaid` + `astro-plantuml` (self-hosted
  server in CI) into the toolkit's Astro preset; ship a `DiagramLightbox`
  component; document the Playwright-in-CI requirement + a client-side fallback
  for constrained deploy targets.
- **Effort:** Low–Medium. **Deps:** none (mostly build config).

### 1.7 Atomic Design component structure

- **Evidence:** A§6, B§6 — explicit split: `components/docs/` (atoms/molecules,
  plain props, never call `getCollection`) vs `components/starlight/` (Starlight
  slot-override organisms); "resolve data above the organism, pass plain props
  down"; **token-only styling** with one dark-theme remap file; single `SECTIONS`
  contract drives the sidebar. E: atomic-design paradigm + frontend-authoring
  styleguide (tokens as single source of truth, BEM, no override sprawl, a11y).
- **Recommended:** Establish the toolkit's component library with this layering
  and the data-resolution rule; token-only theme (extend the existing
  `styles/theme.css` into a token layer + dark remap); adopt the
  frontend-authoring/accessibility doctrine as the component contract.
- **Effort:** Medium (foundational; grows as 1.1–1.6 add components). **Deps:**
  none; underpins the UI in 1.1–1.6.

### 1.8 Reveal.js slide decks (Markdown → preprocess → render, Hugo-style)

- **Evidence:** F — Hugo `reveal-hugo` is the **target**: one Markdown file per
  deck, frontmatter config, templates split rendered HTML on `<hr/>` (from `---`)
  into `<section>`s at build time, vendored reveal.js, overview from a metadata
  sidecar, `?print-pdf` for free. The client Astro "hand-authored HTML +
  copy-only sync + drift-checked manifest" is the **anti-pattern** to avoid.
- **Recommended (Option B from F):** a `decks/` content collection of Markdown +
  a remark/unified splitter (`---`→horizontal, `##`/`--`→vertical) rendering each
  deck to a static route via one shared `DeckLayout.astro` loading **vendored**
  reveal.js; deck frontmatter in Common-Docs style (Zod-validated); overview from
  `getCollection('decks')` (no manifest); keep `?print-pdf`; `data-noprocess`
  escape hatch for bespoke slides. Scope reveal's global CSS to the deck route.
- **Effort:** Medium–Large (mostly one-time). **Deps:** benefits from 1.1/1.7.

### 1.9 Doctrine adoption (styleguide + spk packs) → future charter/doctrine

- **Evidence:** E — a near-complete docsite doctrine already exists in Spec-Kitty
  built-ins: **documentation mission** (Divio-typed workflow), **common-docs**,
  **divio-type-discipline**, **docs-accessibility**, **docs-freshness-sla**,
  **publication-authority**, **plain-language**, **audience personas**,
  **kitty-glossary-writing** + **contextive/terminology-guard**, **DIRECTIVE_003**
  ADR doctrine, **c4 + show-me + mermaid/plantuml**, and **frontend-authoring +
  design-review + quality-tooling** for the theme itself.
- **Recommended:** Treat this as the "mint our own doctrine-variation" track:
  adopt the Core spine (documentation mission + divio-type-discipline +
  common-docs + docs-accessibility) and layer the High-value packs. Encode the
  build-validated frontmatter contract, the a11y gate, and the freshness SLA into
  doc-kitty's validator + CI. Later, recast doc-kitty's `agents/` skills and the
  convention into charter/doctrine artifacts.
- **Effort:** Ongoing/curatorial. **Deps:** informs all of the above.

---

## 2. Proposed mission slicing

Grouped by cohesion + dependency. The user asked for "one or more" — this is a
recommended phasing, adjustable.

| Mission | Scope | Contains | Depends on |
|---|---|---|---|
| **M1 — Metadata & chrome foundation** | The schema + rendering seam everything else hangs on | 1.1 (MarkdownContent/Head overrides), schema extensions groundwork, reconcile `status`→`doc_status` + Divio decision (see §3) | — |
| **M2 — Component system & theme** | Atomic-design layering + token theme + frontend doctrine | 1.7, adopt frontend-authoring/a11y doctrine | M1 (light) |
| **M3 — Audience + Related + External refs** | The three metadata-rendered relationship features | 1.2, 1.3, 1.4 (+ bibliography/tools catalog collections) | M1, M2 |
| **M4 — Glossary & terminology** | Contextive-sourced glossary + auto-linking + search | 1.5 | M1, M2 |
| **M5 — Diagrams** | Build-time mermaid + plantuml + lightbox | 1.6 | M2 (lightbox) |
| **M6 — Slide decks** | Reveal.js Markdown→preprocess→render pipeline | 1.8 | M1, M2 |
| **M7 — Doctrine variation** (track) | Adopt/mint doctrine, wire validator/CI gates | 1.9 | informs all |
| **M8 — Selective/redacted publishing** (optional) | Opt-in projection pipeline: author private `docs/**` → confidentiality-filter/redact/derive → git-ignored rendered collection | projection mode | M1; only if confidentiality filtering is wanted |

Confirmed direction: **direct render is the foundation** (M1–M7 assume it);
projection (M8) is optional and deferred. `doc_status` and `divio_type` are
confirmed schema changes that land in M1.

**Minimal first cut** if the user wants one mission: **M1 + the audience slice of
M3** (highest-value, directly requested, self-contained). **Natural first
phase:** M1 → M2 → M3. M4/M5/M6 are parallelizable once M1/M2 land.

---

## 3. Decisions

Forks surfaced by the findings; each changes scope. Items 1–3 **resolved
2026-08-21**; 4–7 still open (lower stakes, defaults noted).

1. **`status` → `doc_status`. ✅ RESOLVED — rename.** Adopt `doc_status` (doctrine
   E + client convention; bare `status` collides with work-package lane status).
   Enum unchanged: `draft | active | deprecated | superseded`. Touches the schema,
   the validator, and every `docs/**` frontmatter block in the repo.
2. **Divio typing. ✅ RESOLVED — add `divio_type`.** Add `divio_type` =
   `Tutorial | How-To | Reference | Explanation` **alongside** the OKF `type`
   (= section kind). Two orthogonal axes: `type` = *where it lives*, `divio_type`
   = *what kind of reading it is*. Consider making it required-with-a-default per
   section, build-checked (divio-type-discipline doctrine).
3. **Projection pipeline vs direct render. ✅ RESOLVED — direct-render default;
   projection is optional/deferred.** Keep rendering the repo-root `docs/` tree
   directly (preserves low-friction adoption + README-as-index). Layer features as
   render-time transforms (component overrides, `getEntry` resolution, generated
   collections, remark/rehype) — none require projection. A full author→project→
   git-ignored pipeline earns its keep for exactly one capability — publishing a
   filtered/redacted *subset* of a private docs tree — so it becomes an **optional
   opt-in mode, specced separately (see M8)**, not a foundation. Rationale table
   in the chat log of 2026-08-21.
4. **Static vs server output.** Client portal is `output:'server'` (Node);
   doc-kitty is static SSG. All target features (decks, diagrams, glossary) work
   statically. Recommend **stay static**.
5. **Playwright-in-CI** for build-time Mermaid. Acceptable as a CI dependency, or
   need a no-Playwright fallback as default? (Affects M5.)
6. **Reveal.js legacy decks.** For adopters with hand-authored HTML decks — port
   to Markdown, or keep a `data-noprocess` raw-HTML escape hatch? (Affects M6.)
7. **`related` shape.** Confirm the `{ ref, note }` union (ref + optional
   description, defaulting to the target's own `description`) as the shape.

---

## 4. Quick wins vs larger builds

- **Quick wins (Low effort, high value):** metadata chrome overrides (1.1),
  diagrams (1.6), audience field + component (1.2).
- **Medium:** related rendering (1.3), external references + catalog collections
  (1.4), component/theme system (1.7).
- **Larger:** glossary auto-linking + contextive source (1.5), reveal.js pipeline
  (1.8).

## 5. Reusable assets worth lifting directly

- `DiagramLightbox` component (dependency-free, accessible, event-delegated) — A/B.
- The Hugo `reveal-hugo/slides.html` split-on-`<hr/>` regexes — port to remark (F).
- The catalog-record-with-id + `getEntry` resolution pattern for
  bibliography/tools/related (C).
- The discovery layer's extra surfaces (`agents.txt`, `guide.txt`, HAL-lite JSON
  API `_links`) — consider extending doc-kitty's agent-API (A/B).
