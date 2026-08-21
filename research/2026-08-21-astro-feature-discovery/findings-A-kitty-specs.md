# Astro Feature Discovery — Findings A (kitty-specs / portal docsite)

Read-only technical review of a client-owned Astro + Starlight documentation
site. All examples below are genericized: business/domain/product strings are
replaced with `<client>`, `<term>`, `<section>`, `<profile>`, `<page>`. Only
mechanisms and architectural patterns are captured.

> Note on target: the named target `kitty-specs/` holds only SDD **mission
> specs** describing the docsite. The **actual Astro implementation** lives in
> the sibling `portal/` directory of the same client repo. Both were read
> (read-only). Paths below are relative to the client repo root. Nothing was
> modified.

## Top takeaways

- **Two-layer content model with an out-of-band projection.** Canonical Markdown
  lives in a governed `docs/**` tree; a Node script (`sync-docs.mjs`) validates,
  confidentiality-filters, and projects it into a git-ignored `src/content/docs/`
  before Astro/Starlight sees it. Strict validation (discriminated union by
  `record_kind`) runs in plain `.mjs` (no runtime Zod); the Astro
  content-collection schema is a looser, already-validated passthrough.
- **Metadata drives all chrome; body stays purely user-facing.** `title`,
  `description`, `doc_status`, `updated`, `audience` come from frontmatter and are
  rendered by Starlight component overrides (`StatusCue`, `AudienceFor`,
  `SiteMeta`); the authored body has no status/description/header boilerplate.
- **Diagrams are pre-rendered, not live.** PlantUML (`.puml`) and Mermaid
  (`.mmd`/`.mermaid`) are source files rendered to committed `.svg` out-of-band,
  copied into `public/`, embedded as plain `![]()` images. No mermaid/plantuml
  Astro/remark/rehype integration; a delegated `DiagramLightbox` adds zoom.
- **Discovery surfaces are a reusable workspace package.** A build-time Astro
  integration builds a ContentGraph from disk and emits sitemap, RSS, `llms.txt`,
  `agents.txt`, `guide.txt`, and a HAL-lite JSON API via `@<client>/docsite-discovery`.
- **Gaps for a toolkit:** `related` is validated + graphed but not rendered
  on-page; no glossary auto-linking / `.contextive`; no first-class external-
  references frontmatter field.

---

## 1. Glossary

**Present?** Yes, as authored content. No auto-linking, no shorthand, no `.contextive`.

**How it works.**
- Glossary is a subtree of the normal content collection at
  `docs/context/glossary/` — one `index.md` hub plus one sub-dir per bounded-
  context category, each category being a single `index.md` page.
- Terms are plain Markdown: an `## Terms` section with `### <Term>` headings, each
  followed by a definition paragraph and bold metadata lines (`**Context:**`,
  `**Authority:**`). Category pages carry hand-authored header metadata
  (`**Domain:**`, `**Version:**`, `**Status:**`, `**Term Count:**`).
- Search: Starlight ships Pagefind (static index over `dist/client`), but the site
  replaces Starlight's default Header (which held the Pagefind box) with a brand-
  only Header override — so the built-in search box is removed from docs pages (a
  directed trade-off in `astro.config.mjs`). Index still built; no custom search UI.
- No glossary<->body linking: no shortcode/remark plugin/term-detection turning
  term occurrences into definition links. Cross-refs are hand-written links.
- No `.contextive` integration anywhere.

**Key files.** `portal/src/content/docs/docs/context/glossary/index.md`;
`portal/src/content/docs/docs/context/glossary/<category>/index.md`.

**Reusable pattern.** Bounded-context glossary partitioning (one page per domain
cluster, each with own version/status/authority header, uniform `### Term` +
`**Context:**`/`**Authority:**` block) is a clean, portable convention.

**Gaps.** No automated term->definition linking, no `.contextive`, no term index
data structure; search effectively disabled on docs pages by the Header override.

---

## 2. Related pages

**Present?** Field present and validated; reference-only; not rendered on-page.

**How it works.**
- Shape: `related: string[]` — bare array of repository-relative `.md` paths. No
  per-entry description or title; a pure reference list.
- Validation (`schema.mjs` `normalizeRelated` + `validate.mjs` `checkRelated`):
  trimmed, de-duped, sorted; each must be `.md`/`.mdx`, repo-relative (not `/`- or
  `.`-prefixed), and must resolve to an existing file (else `related-unresolved`).
- Materialized into the ContentGraph as `{type:'related',from,to}` edges and
  `relatedRoutes: string[]` on each `PageNode` (`content-graph.mjs`); broken edges
  fail the graph build.
- No visible "Related pages" component. `MarkdownContent.astro` mounts StatusCue,
  AudienceFor, and a derived section listing, but not `related`. No consumer of
  `relatedRoutes` for on-page rendering exists — related feeds only the
  graph/discovery layer.

**Key files.** `portal/src/lib/common-docs/schema.mjs`, `validate.mjs`,
`content-graph.mjs`.

**Reusable pattern.** Treating `related` as a validated graph edge (build fails on
a dangling ref) rather than free text; path-not-slug references stay stable across
route changes.

**Gaps.** (a) No description alongside each reference. (b) No on-page rendering —
relationship lives in graph/`llms.txt`/API but a reader never sees a Related block.
Both are obvious extension points (a `RelatedLinks` organism reading `relatedRoutes`;
an optional `{path, note}` shape).

---

## 3. Metadata-driven headers / descriptions

**Present?** Yes — a core design principle.

**How it works.**
- `title`/`description` come from frontmatter via Starlight's `docsSchema()` base
  schema; the site deliberately does NOT re-declare them in the extend schema.
- A Starlight `MarkdownContent` override injects, above the authored body
  (`<slot />`): `StatusCue.astro` (renders `doc_status` badge — text-first, not
  color-only — plus `updated` and the frontmatter `description` as a lede),
  `AudienceFor.astro` (see 4), `PageListing.astro` (derived child listing on
  index pages).
- `<head>` OG/Twitter/canonical produced by `SiteMeta.astro`/`site-meta.ts`,
  appended via a `Head` override, sourced from frontmatter + site origin.
- Result: the Markdown body is purely user-facing prose; every
  title/description/status/updated surface is derived from metadata by overrides.
- Home-page copy is also data-only (`homePage` config object in
  `content.config.ts`, rendered by `index.astro`).

**Key files.** `portal/src/components/starlight/MarkdownContent.astro`,
`portal/src/components/docs/StatusCue.astro`,
`portal/src/components/starlight/Head.astro`,
`portal/src/components/SiteMeta.astro`, `portal/src/lib/site-meta.ts`,
`portal/astro.config.mjs` (components override registration).

**Reusable pattern.** "Starlight component-override + required frontmatter ->
rendered chrome" seam: keep body Markdown content-only, mount a metadata band via a
`MarkdownContent` override.

**Gaps.** Minor: description length band (50-180) enforced upstream in `schema.mjs`,
not the Astro layer.

---

## 4. Audience descriptions

**Present?** Yes — a full "audience-oriented-writing" doctrine with metadata,
persona files, on-page callout, and validation.

**How it works.**
- Persona files: one Markdown page per audience under
  `docs/context/audience/<profile>.md` (analyst, developer, executive, lead,
  appsec, non-developer-technical-staff, plus an `index` hub). Canonical
  stakeholder descriptions.
- Metadata: optional `audience: [{ profile, guidance_text }]` (strict — only those
  two keys). `profile` is a kebab slug that must resolve to an existing
  `docs/context/audience/<profile>.md` (validated; `index` not a valid target).
- Rendering: `AudienceFor.astro` renders a calm "Who is this for" aside — each
  entry links to the persona page (`/docs/context/audience/<profile>/`) plus the
  page-authored `guidance_text`. Mounts only when `audience.length >= 1` (decided
  by the caller). Never invents persona prose — renders only author guidance.
- The "audience-oriented-writing" doctrine is referenced in persona pages and specs
  (`kitty-specs/docsite-audience-status-cues-01KZ97BJ/spec.md`,
  `kitty-specs/ps-programme-docsite-buildout-01KXD473/spec.md`).

**Key files.** `portal/src/components/docs/AudienceFor.astro`;
`portal/src/lib/common-docs/schema.mjs` (`validateAudience`,
`AUDIENCE_PROFILES_DIR_REL`, `AUDIENCE_ENTRY_KEYS`);
`portal/src/content/docs/docs/context/audience/*.md`.

**Reusable pattern.** `audience: [{ profile, guidance_text }]` + slug-resolves-to-
persona-file + strict-key validation + calm callout. The split — canonical shared
persona page vs. page-local `guidance_text` — is the key idea.

**Gaps.** No machine-readable schema for the persona files themselves (conventional
Markdown).

---

## 5. Mermaid + PlantUML

**Present?** Yes as authored diagrams, but rendered out-of-band, not by the site.

**How it works.**
- Sources in `docs/diagrams/` (`.puml`, `.mmd`, `.mermaid`) and per-section asset
  dirs (e.g. `docs/context/glossary/assets/diagrams/`).
- Rendered to `.svg` out-of-band; SVGs committed under `docs/diagrams/rendered/*.svg`,
  then served at `portal/public/docs-assets/diagrams/rendered/*.svg`.
- Pages embed the rendered SVG as a plain `![<alt>](<svg-url>)`. A source comment
  states plainly: "the docsite does not render Mermaid — readers would see raw
  source", so Mermaid fences are kept out of published bodies.
- No integration in `astro.config.mjs`; no `rehype-mermaid`/`astro-mermaid`/
  `expressive-code`/`kroki` in `package.json`. Render step is external to the Astro
  build (not in `Jenkinsfile`/`Dockerfile` either — a manual/committed-artifact step).
- On-page: `DiagramLightbox.astro` is one reused organism, mounted from the Footer
  override (only Starlight slot reaching every route type). Event-delegated
  click/keyboard handling makes any `img`/inline-`svg` in `.sl-markdown-content` (or
  a custom page `<article>`) a focusable, zoomable `role="dialog"` lightbox — with
  vector-vs-raster scaling, focus trap, Esc/click-close, and reparenting to `<body>`
  to escape Starlight's `isolation: isolate` stacking context.

**Key files.** `portal/src/components/starlight/DiagramLightbox.astro`;
`docs/diagrams/*.puml|*.mmd|*.mermaid` + `docs/diagrams/rendered/*.svg`;
`portal/public/docs-assets/diagrams/rendered/*.svg`.

**Reusable pattern.** (a) DiagramLightbox is a clean, dependency-free, delegated,
accessible zoom organism worth lifting wholesale. (b) "Commit rendered SVG, embed as
image" gives deterministic JS-free output. This is the biggest opportunity for
doc-kitty to improve on: adding a real Mermaid/PlantUML->SVG build integration would
remove the manual pre-render this site accepts as a limitation.

**Gaps.** No live rendering; pre-render step manual/undocumented in build config;
authored `.mermaid` sources can drift from committed `.svg` with no gate tying them.

---

## 6. Atomic Design

**Present?** Yes — explicitly named and enforced in component headers and specs.

**How it works.** Layering with an explicit "resolve data above the organism, pass
plain values down" rule:
- Atoms/molecules -> `src/components/docs/` (`StatusCue`, `AudienceFor`): plain
  props, never call `getCollection`, never re-parse frontmatter.
- Starlight overrides -> `src/components/starlight/`: `Header`, `Footer`, `Head`,
  `Sidebar`, `MarkdownContent` (orchestrator), plus organisms `PageListing`,
  `DiagramLightbox`.
- Organisms like `PageListing.astro` receive an already-ordered array and "never
  call getCollection, never sort, never know section identity" (header comment).
- Data/policy modules (not components): `src/content/docsListingPolicy.ts`
  (structural derivation + per-section ordering); `src/lib/common-docs/*.mjs`
  (schema/paths/graph). Composition in `MarkdownContent.astro`.
- Page-level: `src/pages/*.astro`; layout `src/layouts/BaseLayout.astro`.
- Styling reuse: tokens in `src/styles/starlight-tokens.css` + `branded-tables.css`
  (registered via Starlight `customCss`); components use `--rn-color-*`/`--sl-color-*`
  vars so cards (`PageListing`, `DeckInventoryCard`, home `.section-card`) share one
  visual language and track the dark-theme remap. `SECTIONS` +
  `SECTION_SIDEBAR_LABELS` in `paths.mjs` are the single source for section identity.

Directory map:
```
portal/src/
  components/            Nav, SiteMeta, ThemeToggle, DeckInventoryCard
    docs/                StatusCue, AudienceFor            (atoms/molecules)
    starlight/           Header, Footer, Head, Sidebar,    (Starlight overrides)
                         MarkdownContent, PageListing, DiagramLightbox
  content/               content.config.ts, docsListingPolicy.ts, docs/** (ignored projection)
  layouts/               BaseLayout.astro
  lib/common-docs/       schema, paths, validate, links, content-graph, page-inventory
  lib/generators/        discovery-surface wiring
  scripts/               sync-docs, sync-decks, inventory, content-graph, check
  styles/                starlight-tokens.css, branded-tables.css
  pages/                 index, dashboard/, presentations/
integrations/            discovery-integration.ts, deck-dev-index-integration.ts
packages/docsite-discovery/  reusable emitters (sitemap/rss/llms/agents/guide/api)
```

**Reusable pattern.** "Override-orchestrator resolves data, dumb organisms render
plain props" + token-only styling + single section-identity module.

**Gaps.** None notable; layering is unusually well documented in-code.

---

## 7. External references

**Present?** No first-class metadata field. External links are ordinary inline body
links.

**How it works.**
- No `external_references`/`references` frontmatter field in the schema
  (`schema.mjs`/`content.config.ts`). `related` is the only relationship field and
  is repo-internal `.md` paths only.
- External links are authored inline. The single reference vocabulary (`links.mjs`)
  extracts every inline image/link with one regex and classifies each; anything
  matching a scheme/protocol-relative host/absolute site path/anchor is
  `isExternalUrl` -> verdict `out-of-scope` (captured, never validated or rewritten).
  External links pass through untouched, not collected into metadata or rendered as a
  block.
- The elaborate part of `links.mjs` is internal reference integrity — length-
  preserving masking of code fences/inline code/frontmatter to avoid false positives,
  then classifying internal links (page/asset/deck/directory/unresolved) so validator
  and projection agree. External is the deliberately-ignored bucket.

**Key files.** `portal/src/lib/common-docs/links.mjs` (`isExternalUrl`,
`classifyBodyReference`); `portal/src/lib/common-docs/schema.mjs` (no ext field).

**Reusable pattern.** The body-reference extraction/classification engine (one regex,
length-preserving masking so source offsets stay valid, fixed first-match-wins verdict
order shared by validator + projection) is a strong link-integrity mechanism.

**Gaps.** No structured external-references feature at all — no frontmatter field, no
on-page rendering, no external-link metadata in discovery surfaces. Clear greenfield
extension point (e.g. `external_references: [{ url, label, note }]` + renderer +
optional reachability check).

---

## 8. Content schema + Astro setup

**Present?** Yes — the richest area.

**Versions/stack (`portal/package.json`).** `astro ^7.1.6`,
`@astrojs/starlight ^0.41.5`, `@astrojs/node ^11` (standalone), `@astrojs/react ^5`
(reserved for a dashboard island), `zod ^4`, `yaml ^2`, `marked ^18`. Node `>=22.12`.
Tooling: `vitest`, `@playwright/test`, `@astrojs/check`, `eslint`, `tsx`. npm
workspaces (`packages/*`). In-code comments reference an earlier
`@astrojs/starlight@0.37.7` migration baseline.

**Astro config (`astro.config.mjs`).**
- `output: 'server'` + `@astrojs/node` standalone adapter (containerized Node server).
- `prefetch: false` — deliberately set to stop Starlight defaulting project-wide
  link-prefetch JS onto non-Starlight routes (documented zero-JS-leakage fix).
- integrations: `discoveryIntegration()`, `deckDevIndexIntegration()`, `react()`,
  `starlight({...})`.
- Starlight: brand `title`, `favicon`, `disable404Route: true` (project owns `/404`),
  `components` overrides (Header/Footer/Head/Sidebar/MarkdownContent), `customCss`
  (token + table stylesheets), and a `sidebar` derived from the `SECTIONS` contract
  (`docs/<section>` autogenerate groups, `collapsed: true`).

**Content collection + schema (`content.config.ts`).**
- One collection `docs`, using Starlight `docsLoader()` + `docsSchema({ extend })`
  (Astro 5 Content Layer API).
- Two-tier validation, deliberate: the strict discriminated-union check (`record_kind`
  in {page,ADR,EDR}) is NOT in the Astro schema (Starlight `extend` only takes a plain
  object, cannot compose a discriminated union). Authoritative validator is hand-written
  in `src/lib/common-docs/schema.mjs` (no runtime Zod), run by `sync-docs.mjs` BEFORE
  projecting frontmatter into `src/content/docs/`. The Astro `docsExtendSchema` is a
  looser passthrough + a `superRefine` cross-field guard (ADR needs `governance_body`;
  EDR needs `decision_status`+`project`). A unit test asserts the two field-sets/vocabs
  stay aligned.

**Full frontmatter field set** (`docsExtendFields` + Starlight base):
- Base: `title`, `description` (length band 50-180 enforced upstream), `sidebar`.
- `record_kind` (page/ADR/EDR), `doc_status` (draft/active/deprecated/superseded),
  `updated` (ISO date string), `related` (`string[]` repo-relative `.md`), `audience`
  (`[{profile,guidance_text}]`, optional), `nav_visibility` (visible/hidden, optional),
  `nav_order` (optional positive int, sibling ordering), `sourcePath`, `section`
  (12-value enum), `slugInSection`, `isIndex` (bool, drives derived listings), `route`.
- ADR-only: `status` (MADR: Proposed/Accepted/Deprecated/Superseded), `governance_body`.
  EDR-only: `decision_status` (proposed/accepted/rejected/superseded/deferred),
  `project`. ADR/EDR live at an era-partitioned path
  `docs/edr/<era>/<YYYY-MM-DD>-<kebab>.md`.
- Derived-not-authored (`section`, `slugInSection`, `isIndex`, `route`, `sourcePath`)
  emitted by the projection; `section` derived from path, mismatch is an error.

**Sitemap/RSS/agent (llms.txt) surfaces.** A build-time integration
(`integrations/discovery-integration.ts`, `astro:build:done`) builds a ContentGraph
from disk (`content-graph.mjs`) and calls the reusable workspace package
`@<client>/docsite-discovery` (`packages/docsite-discovery/`) to emit into
`dist/client`: `buildSitemapArtifact`, `buildRssArtifact`, `buildLlmsArtifact`
(`llms.txt`), `buildApiArtifacts` (HAL-lite JSON API with `_links`),
`buildAgentsArtifact` (`agents.txt`, gated by `enableAgents`), `buildGuideArtifact`
(`guide.txt` -> canonical guide route). Origin resolution fails closed:
`PUBLIC_SITE_URL` -> Astro `site` -> throw (`requireOrigin`, no silent scheme prepend).
ContentGraph types (`packages/docsite-discovery/src/types.ts`) mirror a JSON schema;
edges are `related` and `member-of`; `PageNode` carries `relatedRoutes`, `docStatus`,
`updated`, `isChangelogEntry`, `contentHash`.

**Supporting pipeline.** `npm run sync` (`sync-docs.mjs`) projects `docs/**` ->
`src/content/docs/` (git-ignored), applying `confidentiality.mjs` (fail-closed
exclusion/redaction) and `publication-eligibility.mjs`, and rewriting surviving
internal body references to published URLs via `links.mjs`. A projection-cutover flag
file must be present or `sync()` refuses to run. `inventory.mjs`/`content-graph.mjs`
provide `--check` CI gates (`validate:docs`).

**Key files.** `portal/astro.config.mjs`, `portal/src/content.config.ts`,
`portal/src/lib/common-docs/{schema,paths,validate,links,content-graph,confidentiality,publication-eligibility}.mjs`,
`portal/integrations/discovery-integration.ts`, `portal/src/lib/generators/index.ts`,
`portal/packages/docsite-discovery/src/*.ts`, `portal/src/scripts/{sync-docs,inventory,content-graph,check}.mjs`.

**Reusable patterns.**
- Projection + two-tier validation (authoritative hand-written validator upstream;
  Astro schema as typed passthrough + superRefine) when a discriminated union cannot
  live in the collection schema.
- The discovery-surfaces workspace package (one ContentGraph -> sitemap/rss/llms/
  agents/guide/api, fail-closed origin) is the highest-leverage reusable asset.
- Derived-from-contract sidebar/sections (single `SECTIONS` module) removes hand nav.

**Gaps.** Strict schema outside Astro means `astro check` does not enforce the
discriminated union (mitigated by upstream gate + superRefine). Diagram render step and
external references are the two absent features.
