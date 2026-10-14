# Data model: Route rule and index-name consolidation

No storage. These are in-memory values passed between the toolkit's build-time
modules and the link checker.

## Index-name setting

| Field | Value |
|-------|-------|
| Type | `IndexBasenameOption` (`string \| string[]`), normalised to an ordered `string[]` by `normalizeIndexBasenames` (`src/lib/vocabulary-core.mjs`) |
| Default | `['README']` (`DEFAULT_INDEX_BASENAME`); unchanged by this mission |
| Set in | `defineDocKittyIntegrations({ indexBasename })` in the site's `astro.config.*` (the only place an adopter needs to set it) |
| Validated by | `isPlainIndexName` (`vocabulary-core.mjs:781`), for every entry, whether or not Gherkin is on (today only when Gherkin is on, `config.ts:1722`) |
| Published as | `process.env.DK_INDEX_BASENAME` = `JSON.stringify(normalised)`, written when `defineDocKittyIntegrations` runs |
| Read by | `docKittyDocsLoader` (lazily, at load); `dockitty-check-links` (after evaluating the site config); every integration inside `defineDocKittyIntegrations` keeps receiving it as a parameter |
| Matching | case-insensitive on the file stem; `.md` and `.mdx` both count |

`docKittyDocsLoader({ indexBasename })` remains accepted. Equal (after
normalisation, compared case-sensitively as written) to the published value: no
effect. Different: build error. The option is documented as deprecated.

## Route table

Produced by `buildRouteTable(paths, { indexBasename, unpublishedPaths })`
(`vocabulary-core.mjs:977`).

| Field | Meaning |
|-------|---------|
| `routes` | `Record<sourcePath, route>`, published paths only, keys in code-unit order (deterministic, plain JSON for Astro's config digest) |
| `collisions` | `RouteCollision[]`, computed over all paths including unpublished ones |

Input `paths` comes only from `walkMarkdownPaths` (`src/lib/docs-walk.mjs`).

## Docs walk (`walkMarkdownPaths`)

Includes `.md`/`.mdx` files. Excludes, at any depth:

- names starting with `.` (files and folders), as today;
- `log.md`, as today;
- **new**: any folder named `_meta`, and any file whose stem is `_meta`
  (`_meta.md`, `_meta.mdx`).

The loader's glob pattern gains the matching negations
(`'!**/_meta/**'`, `'!**/_meta.{md,mdx}'`) so the loader and the walk agree.
Catalog loaders (`docs/_meta/bibliography.yaml`, `tools.yaml`) use Astro's
`file()` loader and are unaffected.

## Route collision

```
RouteCollision {
  route: string      // as produced by routeOfSlug for the first path in code-unit order, e.g. "/x/"
  paths: string[]    // every source path producing it, docs-relative, code-unit sorted, length >= 2
}
```

Grouping key: `route.toLowerCase()`. Message format: `contracts/collision-error.md`.

Replaces `IndexCollision { dir, winner, demoted }`. With collisions fatal there
is no winner; `resolveIndexEntries` keeps returning `ids` and the rank-based
demotion is removed.

## Page address

`address = withBase(routeOfSlug(slug))` for HTML; `absolute(site, routeOfSlug(slug))`
for feeds and `llms.txt`. `routeOfSlug('')` and `routeOfSlug('index')` are `/`.

## Invariants

1. Every surface derives a page's route with `routeOfSlug`; no module builds
   `/${slug}/` itself (guard test, FR-003).
2. No two walked paths share a route (case-insensitive); otherwise the build and
   `check-links --strict` fail. Draft status does not matter.
3. The loader, the integration and the check use the same index names, or fail.
4. Nothing under `_meta` reaches the walk, the loader, the route table, the
   sidebar or the link check.
5. Route table output is byte-identical across two builds of one tree.
