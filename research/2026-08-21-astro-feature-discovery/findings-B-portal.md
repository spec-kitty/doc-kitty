# Astro Feature Discovery — Target B: `portal`

Read-only review. All examples genericized; no client content retained. Client
name redacted to `<client>` where it appeared in internal package scopes. Paths
relative to the portal repo root unless noted.

## Stack at a glance

- **Astro `^7.1.6`, Starlight `@astrojs/starlight ^0.41.5`** (in-code comments
  still cite `0.37.7` — version drift).
- **`output:'server'`** with `@astrojs/node` `standalone` (containerized Node
  server, not static).
- Also: `@astrojs/react ^5` (reserved for a `/dashboard` island), `zod ^4`,
  `yaml`, `marked`.
- **Two custom integrations** in `integrations/`: `discovery-integration.ts`
  (emits discovery surfaces on `astro:build:done`) and
  `deck-dev-index-integration.ts` (dev-only).
- **Content model:** a *single* `docs` collection, but frontmatter is NOT
  hand-authored. A **projection pipeline** (`npm run sync` →
  `src/scripts/sync-docs.mjs`) reads a canonical `docs/<section>/**` source tree,
  validates + confidentiality-filters it, and writes projected frontmatter into
  the git-ignored `src/content/docs/`; Starlight loads that.

## Top takeaways

- **Projection architecture is the spine.** Authoring source (`docs/**`) is
  separate from the rendered, git-ignored, regenerated collection
  (`src/content/docs/**`). A pure-Node validator/projector
  (`src/lib/common-docs/*.mjs`, no runtime schema dep) is the authority;
  Starlight's zod schema is a deliberately loose *already-validated passthrough*.
- **Metadata-driven, body-stays-user-facing is fully realized.** Status, "who is
  this for", section listings, page order, and OG/social head tags all derive
  from frontmatter and are injected *around* the authored body via Starlight
  component overrides.
- **Diagrams are pre-rendered to SVG offline** (both Mermaid and PlantUML) into
  `public/docs-assets/diagrams/rendered/`, referenced as plain images + a source
  link. No mermaid/plantuml integration exists.
- **`related` is a data edge, not on-page UI** — it feeds a content graph and
  machine surfaces (JSON API `_links.related`, `llms.txt`, sitemap), with no
  visible "Related pages" component.
- **A reusable discovery package** (`packages/docsite-discovery` =
  `@<client>/docsite-discovery`) emits `sitemap.xml`, JSON API, `llms.txt`,
  `rss`, `agents.txt`, `guide.txt` from one ContentGraph.

## 1. Glossary

**Present?** Yes as content; not as a term-linking plugin.

- Layout: `docs/context/glossary/<bounded-context>/` — **multi-glossary /
  bounded-context** (one folder per domain, each an `index.md` hub + term
  pages), plus an `upstream-pointers/` sub-glossary for external authority.
  Deliberately not one dictionary.
- No shortcode/plugin links body prose to definitions — terms are linked with
  normal markdown links.
- **No `.contextive` integration** (the only "contextive" hit is a glossary term
  *naming* the Contextive tool).
- **Search:** Starlight's Pagefind index is still built into `dist/client`, but
  the custom `Header` override **removed the search-box UI** — discovery leans on
  derived listings + machine surfaces instead.
- Key files: `src/content/docs/docs/context/glossary/**`, `astro.config.mjs`.
- **Reusable:** bounded-context glossary folders + per-domain hub +
  `upstream-pointers` context. Auto term-linking is a net-new opportunity.
- **Gaps:** no auto term→definition linking; no `.contextive`; search UI
  sacrificed by the brand chrome.

## 2. Related pages

**Present?** As metadata + machine surface only — not on-page.

- Shape: `related: string[]` of **repository-relative `.md` source paths**;
  **reference-only, no per-entry description**. Validated (`schema.mjs`
  `normalizeRelated` + `validate.mjs`): repo-relative, `.md`, de-duped, sorted,
  must resolve to an existing governed page.
- `content-graph.mjs` turns each entry into an edge (`{type:'related',from,to}`)
  + `relatedRoutes[]`; broken edges fail the build.
- Surfaces to readers/agents only via the discovery layer: JSON API
  `_links.related:[{href,title}]` (`packages/docsite-discovery/src/api.ts`
  `relatedLinks()`), plus `llms.txt`/sitemap. `MarkdownContent.astro` renders no
  related block.
- **Reusable:** typed validated edge (fail build on broken refs) + machine
  surface. Data + resolver exist if doc-kitty wants on-page "Related" cards.
- **Gaps:** no reader-visible related section; no per-link description field.

## 3. Metadata-driven headers/descriptions

**Present?** Yes — core, mature.

- `title`/`description` from Starlight's `docsSchema()`; description length band
  (50–180) enforced upstream in the Node validator.
- A Starlight `MarkdownContent` override
  (`src/components/starlight/MarkdownContent.astro`) wraps the body and injects
  *above the `<slot/>`*: `StatusCue.astro` (lifecycle badge from `doc_status` +
  `updated` + `description`, text-first not color-only), `AudienceFor.astro`, and
  `PageListing.astro` (derived index listing). Body markdown never restates
  these.
- Head/social: `Head.astro` override keeps Starlight's title/description tags,
  appends OG/Twitter/favicon via `SiteMeta.astro` + `resolveSiteMeta()`
  (`src/lib/site-meta.ts`), falling back to a home hero config.
- Home copy/links are a typed data object (`homePage` in
  `src/content.config.ts`); `index.astro` only renders it (hero markdown via
  `marked` + `set:html`).
- **Reusable:** override Starlight `MarkdownContent` + `Head` slots to inject
  frontmatter-derived chrome; keep home/hero copy in typed config, not markup.
- **Gaps:** none notable.

## 4. Audience descriptions

**Present?** Yes — full doctrine + metadata + UI.

- **Doctrine/template:** `docs/context/audience/index.md` defines ~6 kebab-slug
  personas (`<persona>.md`), each required to carry three structural subsections
  (**Role**, **Technical Level**, **Reading Expectations**); the hub states the
  "every artifact has a primary persona" doctrine and cites an authoring
  directive.
- **Page metadata:** `audience: [{ profile: <persona-slug>, guidance_text:
  <string> }]`. `profile` must resolve to `docs/context/audience/<profile>.md`
  (`schema.mjs` `validateAudience`; `index` hub is not a valid target);
  `.strict()` mapping (only those two keys); optional (omitted/`[]` ⇒ no block).
- **Rendering:** `AudienceFor.astro` renders a calm `<aside>` "Who is this for"
  card — persona links + page-authored `guidance_text`, never inventing prose;
  mounted only when `audience.length >= 1`.
- Shape declared in both `schema.mjs` (authority) and `content.config.ts` (zod
  passthrough), kept aligned by a unit test. Nav links a "Stakeholder
  Descriptions" entry to the audience hub (`nav.config.ts`).
- **Reusable:** persona files with a required-subsection template + strict
  `audience:[{profile,guidance_text}]` whose `profile` must resolve to a real
  persona file + a small "Who is this for" component gated on `length>=1`.
- **Gaps:** none major.

## 5. Mermaid + PlantUML

**Present?** Diagrams yes; live rendering **no** — pre-rendered offline.

- **PlantUML:** `.puml` sources in `public/docs-assets/diagrams/`; rendered
  `*_plantuml.svg` in `public/docs-assets/diagrams/rendered/`. Pages use
  `![<caption>](/docs-assets/diagrams/rendered/<name>_plantuml.svg)` + a
  blockquote `> **Source:** [<name>.puml](/docs-assets/diagrams/<name>.puml)`.
- **Mermaid:** same — rendered to SVG offline (committed SVGs carry Mermaid's
  `id="my-svg" class="flowchart"` output) in the same `rendered/` folder. **No
  Mermaid client script, remark/rehype plugin, or integration** exists — a raw
  ```` ```mermaid ```` fence (present in a couple of source pages) renders as a
  plain Shiki code block; the SVGs are canonical.
- **Shared interaction:** `DiagramLightbox.astro` (mounted via the `Footer`
  override — the one slot reaching every route type) gives delegated
  click/keyboard "enlarge any `img`/`svg` in content", one accessible
  (`role=dialog`, focus-trap) instance that reparents to `<body>` to escape
  Starlight's stacking context.
- **Reusable:** a CI-side diagram render step emitting SVGs into `public/`,
  referenced as images + source link, plus one delegated lightbox for all
  diagrams.
- **Gaps:** raw mermaid fences not auto-rendered; in-repo render tooling not
  visible (offline/upstream pipeline).

## 6. Atomic Design

**Present?** Yes — explicitly named/organized.

- `src/components/docs/` — content atoms/molecules (`StatusCue`, `AudienceFor`).
- `src/components/starlight/` — Starlight slot overrides (organisms/templates):
  `Header`, `Footer`, `Head`, `Sidebar`, `MarkdownContent`, `PageListing`,
  `DiagramLightbox`.
- top-level shared: `Nav`, `SiteMeta`, `ThemeToggle`, `DeckInventoryCard`.
- `src/layouts/BaseLayout.astro` — shell for non-Starlight pages (`/`,
  `/dashboard`, `/presentations`); `src/pages/` routes; `src/islands/` reserved
  (only `.gitkeep`); `src/styles/` tokens (`starlight-tokens.css` with dark
  remap, `branded-tables.css`).
- Explicit AD discipline in comments (e.g. `PageListing` "never calls
  getCollection, never sorts… resolve data above the organism, pass plain values
  down"; `DiagramLightbox` extracted from `Footer` per an "AD dual-concern
  finding").
- **Styling reuse:** token-only (`--sl-color-*` Starlight, `--rn-color-*`/
  `--rn-font-*` brand tokens); card style deliberately aligned across
  `index.astro` `.section-card`, `DeckInventoryCard`, `PageListing`.
- **Reusable:** split `docs/` (pure atoms) vs `starlight/` (slot overrides);
  "data resolved above the organism, plain props down"; all styling from CSS
  custom properties with one dark-theme remap file.
- **Gaps:** islands layer unused; atom/molecule split is by folder + comments,
  not literal `atoms/` dirs.

## 7. External references

**Present?** Weakly — no dedicated external-reference metadata surface.

- **No** `external`/`references`/`links` frontmatter field exists (verified by
  enumerating all corpus frontmatter keys). External links live inline in body
  markdown only.
- Body links governed by one module `src/lib/common-docs/links.mjs` (single
  extraction regex + classification order). External/absolute/`data:`/anchor URLs
  classify **`out-of-scope`** (`isExternalUrl()`) and the projection leaves them
  as-authored (it only rewrites internal relative `.md`/asset refs into routes).
  External links are scope-validated but not collected as metadata.
- Closest "external references as data": the glossary `upstream-pointers`
  sub-context and per-diagram "Source:" links — both authored body content, not
  frontmatter.
- **Reusable:** the single-regex/single-classification-order link governance
  module (validator + projector share it, so a link can't be legal for one and
  unhandled by the other). Storing external links *as rendered metadata* would be
  net-new.
- **Gaps:** no external-reference frontmatter field; no rendered external-links
  block.

## 8. Content schema + Astro setup

**Content collection (`src/content.config.ts`)**

- One collection: `docs = defineCollection({ loader: docsLoader(), schema:
  docsSchema({ extend: docsExtendSchema }) })` (Starlight Content Layer API).
- Extend schema is a loose passthrough (strict discriminated union runs
  upstream). Full projected frontmatter field set:
  - Core: `record_kind`(`page|ADR|EDR`), `title`, `description`,
    `doc_status`(`draft|active|deprecated|superseded`), `updated`(ISO string).
  - Relations/derived: `related:string[]`, `sourcePath`, `section`(12-value
    enum), `slugInSection`, `isIndex:boolean`, `route`.
  - Optional cues: `audience:[{profile,guidance_text}]`(strict),
    `nav_visibility`(`visible|hidden`), Starlight-native `sidebar`(`order` +
    `attrs.data-nav-order`) written by the projector from a sibling-relative
    `nav_order`.
  - Kind-specific (optional here, strict upstream): `status`(MADR `Proposed|
    Accepted|Deprecated|Superseded`, ADR), `governance_body`(ADR),
    `decision_status`(`proposed|accepted|rejected|superseded|deferred`, EDR),
    `project`(EDR). A `superRefine` re-asserts ADR→`governance_body`,
    EDR→`decision_status`+`project`.
- The real validator is `src/lib/common-docs/schema.mjs` — hand-written, no
  runtime zod dep (node-only scripts). Enforces the union, description band,
  kebab paths, decision-record path/era/filename shape, audience-profile
  resolution, nav order/visibility. A unit test keeps the zod side and Node side
  field-aligned.

**Astro config (`astro.config.mjs`)**

- `output:'server'` + `@astrojs/node` standalone; `prefetch:false` (explicit —
  suppresses Starlight's default project-wide prefetch script injection, a
  documented JS-leak fix).
- Integrations: `discoveryIntegration()`, `deckDevIndexIntegration()`,
  `react()`, `starlight({...})`.
- Starlight: `disable404Route:true`; brand chrome via
  `components:{Header,Footer,Head,Sidebar,MarkdownContent}`;
  `customCss:[starlight-tokens.css, branded-tables.css]`; `sidebar` groups
  **derived** from a `SECTIONS` contract in `src/lib/common-docs/paths.mjs` (no
  hand list), two-level collapse control. Documented trade-off: overriding
  Header/Footer drops built-in search box, theme toggle, prev/next pagination.

**Discovery surfaces (agent/LLM/SEO)**

- `integrations/discovery-integration.ts` runs on `astro:build:done`, writes into
  `dist/client`. Calls `src/lib/generators/index.ts`, which builds a ContentGraph
  (`content-graph.mjs`) and calls emitters from the reusable workspace package
  `packages/docsite-discovery`: `sitemap.xml`, a **JSON API** (per-page/
  per-section, HATEOAS `_links` incl. `related`/`agents`/`guide`), **`llms.txt`**,
  **`rss`**, **`agents.txt`**, **`guide.txt`** (canonical guide route).
  Agents/guide toggleable. Origin fails closed: `PUBLIC_SITE_URL` → Astro `site`
  → throw. Package has its own clean `src/` (`sitemap/api/llms/rss/agents/guide/
  origin/write/types.ts`), imported only from built `dist/`.

**Projection/build pipeline (npm scripts)**

- `sync`→`sync-docs.mjs` (project `docs/**`→`src/content/docs/**` with
  confidentiality filter + schema validation), `sync:decks`, `docs:inventory`
  (metadata lockfile incl. `related`), `docs:graph`, `docs:check`. `prebuild`
  chains validate→sync→graph checks; content dir git-ignored + regenerated.
- **Reusable:** source-of-truth `docs/**` + projected/git-ignored collection;
  runtime-dep-free validator as authority with zod as thin passthrough (kept
  synced by a test); sidebar/sections derived from a `SECTIONS` contract;
  standalone discovery package.
- **Gaps:** Starlight version drift (comments `0.37.7` vs `package.json
  ^0.41.5`); loss of native search/pagination/theme chrome from Header/Footer
  overrides.

## How `portal` differs from `kitty-specs`

`kitty-specs` (parent-dir sibling) is **not** a second Astro site. It is the
**Spec-Kitty / SDD mission repository**: one folder per mission
(`<feature>-<id>/`) with `spec.md`, `plan.md`, `data-model.md`, `contracts/`,
`decisions/`, `lanes.json`, `acceptance-matrix.json`, etc. Those specs *govern*
the portal — portal code comments constantly cite them (`WP01/T003`,
`contracts/route-contract.md`, `data-model.md §5`, decision IDs). The
relationship is **governance/spec vs. implementation**, not shared-components/
different-layout. `kitty-specs` ships no `package.json`/`astro.config`/
components, so a "shared layout system" comparison is N/A at code level; the only
coupling is that portal realizes kitty-specs contracts.

## ~8-line reusable-pattern summary

1. **Projection pipeline:** author in a canonical `docs/**` tree, validate +
   confidentiality-filter with a runtime-dependency-free Node validator (the
   authority), then *project* into a git-ignored Starlight collection; the
   collection's zod schema is a thin passthrough kept aligned by a test.
2. **Metadata-driven chrome:** override Starlight's `MarkdownContent` and `Head`
   slots to inject frontmatter-derived status cues, audience blocks, derived
   listings, and OG/social tags *around* the body — body markdown never restates
   metadata.
3. **Audience doctrine:** first-class persona files with a required-subsection
   template + a strict `audience:[{profile,guidance_text}]` frontmatter contract
   whose `profile` must resolve to a real persona page, rendered by a small "Who
   is this for" component.
4. **`related` as typed edges:** repo-relative `.md` refs (reference-only, no
   description) validated to fail the build on broken links, exposed via a
   content graph + JSON API `_links`/`llms.txt` rather than an on-page widget.
5. **Diagrams pre-rendered to SVG offline** (Mermaid + PlantUML alike) into
   `public/`, referenced as images with a source link, plus one delegated
   accessible lightbox component for all diagrams — no client diagram renderer
   shipped.
6. **Atomic Design split:** pure atoms in `components/docs/` vs Starlight
   slot-override organisms in `components/starlight/`, with "resolve data above
   the organism, pass plain props down" and token-only styling driven by one
   dark-theme remap file.
7. **Sidebar/sections derived from a single `SECTIONS` contract** (no
   hand-maintained nav lists).
8. **Standalone discovery package** emitting `sitemap.xml` + JSON API +
   `llms.txt` + `rss` + `agents.txt` + `guide.txt` from one ContentGraph on
   `astro:build:done`, with fail-closed origin resolution — a clean, liftable
   agent/LLM-surface layer.

_Note: no `.contextive` integration, no external-reference metadata field, and no
auto glossary term-linking exist — these are net-new opportunities for doc-kitty.
All content above is structural/genericized; no client business content
retained._
