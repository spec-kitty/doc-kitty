# Data Model — M3

Phase 1. Entities, record shapes, and resolution outcomes. Frozen frontmatter
shapes (ADR-0009) are shown for reference; only additive schema is new.

## Frontmatter entities (frozen — reference)

- **audience entry** `{ profile: string (kebab slug), guidance_text: string }`
  — both keys required. `guidance_text` is page-local (a property of the entry).
- **related reference** `string (slug) | { ref: string, note?: string }`.
- **external reference** `{ url, title, note? } (inline) | { type, id } (catalog)`
  where catalog `type ∈ { biblio, tool }`.

## Additive schema (new this mission)

### Persona attribute fields (ADR-0019) — on `kind: Persona`
- `role: string` — required (validator, for Persona)
- `goals: string[]` — required, non-empty
- `responsibilities: string[]` — required, non-empty
- Build zod: optional. Standalone validator: required when `kind === Persona`.

### Bibliography record (ADR-0018) — `docs/_meta/bibliography.yaml`
```yaml
- id: divio-2017            # stable citation key (required, unique)
  type: webpage             # optional CSL-ish type; default 'webpage'
  title: The documentation system   # required
  authors: [Daniele Procida]         # optional, flat strings
  container: Divio                   # optional (CSL container-title)
  url: https://documentation.divio.com  # required
  issued: 2017                       # optional, year or YYYY-MM-DD
  accessed: 2026-08-24               # optional
  note: origin of the four-quadrant model  # optional
```

### Tools record (ADR-0018) — `docs/_meta/tools.yaml`
```yaml
- id: revealjs             # stable id (required, unique)
  name: reveal.js          # required
  url: https://revealjs.com  # required
  note: the deck engine    # optional
```

## Resolution outcomes (pure functions in `metadata.ts`)

| Function | Input | Output | Miss behaviour |
|---|---|---|---|
| `resolveRelated(ref, index)` | slug or `{ref,note}` + docs index | `{ ref, title, kind, doc_status, note? }` | **build-fail** (dangling) |
| `resolveProfile(profile, index)` | profile slug + docs index | `{ href, title } \| null` | **warn** (null → humanized slug, printed build-log line) |
| `resolveCitation(extRef, catalog)` | `{url,title,note}` or `{type,id}` + catalog | resolved reference row | **build-fail** (missing id / unknown catalog `type`) |

- Precedence: a related card shows the entry `note` when present, else the target's
  `description`.
- Stale-target: a resolved related whose `doc_status ∈ {deprecated, superseded}`
  carries the **stale-target status marker** (MetadataBand status vocabulary).

## Agent surface (ADR/DIRECTIVE_018)

- **Per-page record (extended)**: adds `audience: {profile, guidance_text}[]` and a
  **resolved** `related: {ref, title, kind, doc_status}[]` (was raw slugs). Composed
  in the route via `resolveRelated`, not in the pure `toAgentRecord`. Agent-API
  `version` incremented.
- **`/api/bibliography.json`**: `{ version, count, records: {id, title, url, ...}[] }`
  projected from `bibliography`, outside `doc_status` gating.

## Example-tree delta (count pins — FR-023)

| Change | Published delta |
|---|---|
| persona promoted `draft`→`active` | +1 |
| Audiences hub (`context/audience/README.md`) | +1 |
| block demonstrator page | +1 |
| retained draft demonstrator (US5) | 0 (stays excluded) |

`EXPECTED_INDEX_ENTRY_COUNT` / `EXPECTED_SITEMAP_URL_COUNT` recomputed and
cross-checked against `example/docs/` in the persona-atomic WP. `EXPECTED_PAGE_KEYS`
gains `audience`/`related` handling (resolved-`related` asserted as a non-string
shape).
