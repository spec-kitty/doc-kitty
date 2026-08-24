# Contract — citation catalog & resolution

Backs FR-006/007/008/009/015 and ADR-0018.

## Collections

- `bibliography` and `tools` are Astro content-layer data collections loaded from a
  single YAML file each: `docs/_meta/bibliography.yaml`, `docs/_meta/tools.yaml`
  (mirrored under `example/docs/_meta/`). The toolkit exports the zod schema + loader
  for each, mirroring `docKittyDocsSchema()`/`docKittyDocsLoader()`; a consumer wires
  them into `content.config.ts` in one step.

## Record shapes

- **bibliography**: `id` (required, unique, stable), `title` (required), `url`
  (required); optional `type`, `authors: string[]`, `container`, `issued`,
  `accessed`, `note`.
- **tools**: `id` (required, unique), `name` (required), `url` (required); optional
  `note`.

## Citation resolution (MUST)

- An `external_references` entry `{ type, id }` resolves: catalog `type: biblio` →
  `bibliography[id]`; catalog `type: tool` → `tools[id]`.
- **Unresolvable id → blocking build error** (build) AND a `validate-catalog.mjs`
  build-free error (doc-sanity). Parity: identical verdicts on the shared fixtures.
- **Unknown catalog `type`** (not `biblio`/`tool`) → blocking error (fail-fast).
- An inline `{ url, title, note? }` needs no catalog and has **no citation key**.

## Rendering (MUST)

- `ReferenceItem` accessible name = the human **title** (inline `title` or resolved
  record `title`); the mono citation key is a **secondary** affordance (catalog
  citations only), never the leading/sole accessible name.
- The block is `<nav aria-label="External references">`, list semantics, inside
  `data-pagefind-body`; titles appear in the **citing page's own** Pagefind fragment.

## Endpoint (MUST)

- `/api/bibliography.json` emits `{ version, count, records[] }` with each record's
  `id`, `title`, `url` (plus optional fields), **outside `doc_status` gating**.

## Assertions

- `assert-chrome-artifacts.mjs`: block present, title-before-key accessible name,
  own-fragment Pagefind, external-references tint AA.
- `assert-build-artifacts.mjs`: `/api/bibliography.json` shape (`id`/`title`/`url`).
- vitest: `resolveCitation` hit/miss/unknown-type.
