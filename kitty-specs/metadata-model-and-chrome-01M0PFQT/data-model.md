# Data model — Metadata model and chrome (M1)

The mission's "data" is the frontmatter contract and its projections. No database.

## Entity: Page frontmatter (the finalized contract)

The zod shape in `src/lib/schema.ts` (extended onto `docsSchema`) and the
build-free mirror in `validate-frontmatter.mjs`. Fields below; **R** = required.

| Field | R | Type / values | Validation | Read by |
|---|---|---|---|---|
| `title` | R | string (non-empty) | present, non-empty | nav, `<title>`, feeds, agent |
| `description` | R | string | length ≤180 **error**; <50 **warning** | chrome band, feeds, cards, agent |
| `doc_status` | R | `draft\|active\|deprecated\|superseded` | enum (required, no default in the standalone validator) | publication gating |
| `updated` | R | `YYYY-MM-DD` | coercible date | band, feeds, freshness |
| `type` | R¹ | canonical section type (open vocab) | warn on section mismatch | agent, validation |
| `kind` | R² | canonical kind (open vocab) | warn on unknown (observably) | per-kind layout, grouping |
| `hero_image` | — | `{ src, alt }` | `alt` **required** when present | `dk:page-hero`, share fallback |
| `social_thumb` | — | `{ src, alt } \| string` | shape | `Head` share image |
| `related` | — | `[ string \| { ref, note } ]` | each ref resolves (build + `check-links`) | (block M3); integrity now |
| `external_references` | — | `[ {url,title,note?} \| {type,id} ]` | shape (catalog resolution M3) | (block M3) |
| `audience` | — | `[ { profile, guidance_text } ]` | `guidance_text` required per entry | (block M3) |
| `moscow` | — | `{ level, rationale }` | `level ∈ Must\|Should\|Could\|Won't`; `rationale` required when present | planning board |
| `agent` | — | `{ discoverable, priority, keywords }` | as ADR-0003 (unchanged) | agent visibility/order |
| `tags` | — | `[string]` | — | agent, filter |
| `okf_version` | R³ | `"0.2"` | bundle root only | OKF marker |
| `authors`,`resource`,`generated`,`verified`,`sources`,`stale_after` | — | as Common Docs (unchanged) | metadata/freshness |

¹ `type` required except the bundle-root `docs/README.md` (carries `okf_version`).
² `kind` required on **every** page **including** the bundle root (only `type` is
exempt there — resolved ambiguity, post-spec squad).
³ `okf_version` on the bundle root only.

### Invariants

- **INV-1 (gating)**: a page is published iff `doc_status !== 'draft'`; published
  pages appear in sitemap, RSS, llms, agent-API subject to the section `feeds`
  filter and per-page `agent.discoverable`.
- **INV-2 (parity)**: the standalone validator and the build schema agree on
  required-ness, enums, and the description bounds for every fixture.
- **INV-3 (integrity)**: every `related` ref (bare or `{ref,note}`) resolves to an
  existing page, else the build and `check-links` fail.
- **INV-4 (atomic cutover)**: at every committed/merged state, `doc-sanity` and
  `build-example` are green — no half-renamed tree (C-010).

## Entity: Agent record (`/api/index.json`, `/api/pages/<id>.json`)

Projection of the contract for machines. Change from M0: field `status` →
`doc_status`; **add** `kind`.

```
AgentRecord {
  slug, route, section, title, description,
  type, doc_status, kind,        # was `status`; `kind` is new
  tags, related, priority, updated, source
}
```

- `EXPECTED_PAGE_KEYS` (build assertion) becomes
  `['slug','route','section','title','doc_status','kind']` (each a string).
- `EXPECTED_INDEX_ENTRY_COUNT` stays **12** (13 example files − 1 draft).

## Entity: `kind → layout` map (ADR-0013, static in M1)

```
// Ships EMPTY in WP02 (Default-only) so the 6 live `kind: Hub` pages build green;
// WP04 registers the Hub key (recorded out-of-map edit) once Hub.astro exists.
kindLayouts: Record<Kind, LayoutModule> = {
  // WP04 adds:  Hub: () => import('./Hub.astro')
}
resolveLayout(kind) = kindLayouts[kind] ?? DefaultLayout
```

Resolved once in the `MarkdownContent` carrier. Referencing a not-yet-existing
`Hub.astro` in WP02 would fail Vite resolution and turn WP02's build red, so the
map is empty until WP04. M2 swaps this static module for the merged manifest at the
**same** import site (ADR-0013 extension point).

## Entity: `--dk-*` token catalog (single Default layer, M1)

The complete neutral catalog from theming.md (surfaces, text, accent, state +
`-bg` pairs, type, spacing, radius, elevation, widths) plus the base stylesheet
assigning each `--dk-*` into its `--sl-*` counterpart. Shipped as one static sheet
positioned tokens-before-overrides in the cascade (M2 layers brand/consumer after).

## State transitions

`doc_status` lifecycle (author-driven, not automated): `draft → active →
{deprecated | superseded}`. Only the `draft` boundary changes machine behavior
(publication). No other state machine in this mission.
