/**
 * Frontmatter schema + content loader for DocKitty.
 *
 * `docKittyDocsSchema` extends Starlight's docs schema with the convention's
 * metadata (velvet-tiger/common-docs v1.2 fields + a Kitty `agent` extension).
 * `docKittyDocsLoader` reads the repo-root `docs/` tree and implements the
 * README-as-index twist by rewriting entry ids at load time.
 */
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { file, glob } from 'astro/loaders';
// Starlight re-exports its schema helper here; kept as the single Starlight
// touch point so the rest of the toolkit stays framework-light.
import { docsSchema } from '@astrojs/starlight/schema';
import { formatRouteCollisions } from './vocabulary-core.mjs';
import {
  readmeToIndexId,
  resolveIndexEntries,
  ROOT_ENTRY_ID,
  isDraftEntry,
  expectedDocType,
  type IndexBasenameOption,
} from './metadata.js';
import {
  resolveSectionRegistry,
  sectionTypes,
  sectionSubtypes,
  sectionIds,
  type SectionRegistry,
} from './sections.js';
// Canonical vocabulary sets live in ONE place (#49 IC-01/IC-02): the fs-free,
// Astro-free `vocabulary-core.mjs`. `schema.ts` consumes them rather than
// hand-mirroring — `DOC_TYPES` and `Kind` derive straight from the core's
// JSDoc-const literal tuples. `doc_status` is charter-aware (extend-only), so it
// is an OPEN string here (see `docKittyFields.doc_status`) rather than a static
// `z.enum(STATUSES)`; the canonical `STATUSES` set stays the core's reference for
// the bare-Node gate's warn-not-fail legality check (documentation-charter WP03).
import { DOC_TYPES, KINDS, normalizeIndexBasenames } from './vocabulary-core.mjs';
import { publishDraftsInForce } from './draft-publication.mjs';
import { walkMarkdownPaths } from './docs-walk.mjs';

export { readmeToIndexId };

// Re-exported from the core so existing importers (`section-type-parity.test.ts`,
// `type-registry-authority.test.ts`, the per-kind layout `Kind` type) keep their
// `schema.ts` import path while the definition stays single-sourced (NFR-001).
export { DOC_TYPES, KINDS };

export type Kind = (typeof KINDS)[number];

/**
 * The registry-derived section-default `type` expectation for a page path (issue
 * #24). Runs in the Astro build context, so it consumes the section registry:
 * `registry` is the parsed `sections.yaml` (pass `loadSectionRegistry(docsRoot)`),
 * from which `sectionTypes` gives the section-default `id → type` authority; the
 * sub-path subtypes are applied on top by the pure `expectedDocType`. A `null`
 * registry (no `sections.yaml`) gracefully falls back to the frozen section-type
 * map, so a registry-less tree still derives an expectation.
 *
 * This is ADVISORY, matching the open-vocabulary posture (FR-003, ADR-0004): the
 * `type` field stays `z.string().optional()` in the schema, an unknown `type`
 * remains a warning (the standalone gate prints it), and a mismatch against this
 * expectation is a warning — never a hard schema error. `null` means "no
 * section-default expectation" (unknown section), i.e. no check.
 */
export interface ExpectedTypeForPathOptions {
  /**
   * Sink for the non-fatal "renamed to an unregistered section id" warning
   * (US2-AS5). Defaults to `console.warn`, matching `sections.ts`'s `warn`
   * option pattern.
   */
  warn?: (message: string) => void;
}

export function expectedTypeForPath(
  relPath: string,
  registry: SectionRegistry | null,
  options: ExpectedTypeForPathOptions = {},
): string | null {
  const typesBySection = registry ? sectionTypes(registry) : undefined;
  const subtypesBySection = registry ? sectionSubtypes(registry) : undefined;
  if (registry) {
    // US2-AS5: a registry IS present, so an id with NO entry at all (not
    // merely one that omits `type`/`subtypes`, e.g. `faq`) is the documented
    // "renamed to an unregistered id" condition — surfaced as a warning, never
    // a silent mis-type or a hard failure.
    const section = relPath.split('/')[0] ?? '';
    if (section !== '' && !sectionIds(registry).has(section)) {
      const warn = options.warn ?? ((m: string) => console.warn(`[dk-metadata] ${m}`));
      warn(
        `section "${section}" (from "${relPath}") is not registered in sections.yaml — ` +
          `falling back to the documented default (untyped); if this is a renamed section, ` +
          `add a registry entry for "${section}"`,
      );
    }
  }
  return expectedDocType(relPath, typesBySection, subtypesBySection);
}

/**
 * Convenience wrapper that resolves the section registry for `<docsRoot>` through
 * the CHARTER-AWARE path (charter → legacy `sections.yaml` → default, WP03) and
 * derives the expected `type` for `relPath` from it (issue #24, FR-005). A missing
 * registry falls back to the frozen section-type map. Reads the filesystem, so it
 * is for the build/generator side; the pure {@link expectedTypeForPath} is the
 * unit-testable core. Uses {@link resolveSectionRegistry} so the Astro-side type
 * derivation honors a charter-declared section registry, matching the bare-Node
 * gate's `resolveGovernance` precedence (parity).
 */
export function expectedTypeForPathInRoot(
  relPath: string,
  docsRoot = 'docs',
  options: ExpectedTypeForPathOptions = {},
): string | null {
  return expectedTypeForPath(relPath, resolveSectionRegistry(docsRoot), options);
}

/**
 * Description upper bound (chars). Mirrors `DESCRIPTION_MAX` in
 * `src/scripts/validate-frontmatter.mjs`; the schema/validator parity test
 * (`src/tests/schema-validator-parity.test.ts`) fails if the two ever disagree
 * on the `err/description-too-long.md` fixture, binding this value to the gate.
 */
export const DESCRIPTION_MAX = 180;

const agentHints = z
  .object({
    discoverable: z.boolean().default(true),
    priority: z.number().min(0).max(1).default(0.5),
    keywords: z.array(z.string()).default([]),
  })
  .default({});

/**
 * The DocKitty frontmatter fields, layered on Starlight's.
 *
 * Required by the convention: `title`, `description`, `doc_status`, `updated`,
 * `type`, `kind`. To keep partially-scaffolded stubs from breaking the build,
 * `doc_status` defaults to `draft` and `updated`/`type`/`kind` are lenient
 * here; the standalone `validate-frontmatter.mjs` gate enforces strict presence
 * by path (e.g. the bundle-root `README.md` is exempt from `type` and carries
 * `okf_version`, but still requires `doc_status` and `kind`).
 */
export const docKittyFields = {
  // `title` and `description` come from Starlight's own schema; description is
  // re-declared required to match the convention, with the same >180 upper bound
  // the standalone validator enforces (parity test guards the two agree).
  description: z.string().max(DESCRIPTION_MAX),
  // Charter-aware lifecycle status (documentation-charter WP03, C-004/FR-005).
  // The canonical `STATUSES` are the shipped defaults, but the charter's
  // `statuses.add` axis is EXTEND-ONLY — an adopter may add lifecycle values, so
  // a page using a charter-added status must still build. A static `z.enum` can
  // only encode the canonical tuple (an added value is unknown at schema-build
  // time), so — matching the already-open `kind` axis and the `type` axis above
  // — the build schema accepts any non-empty string here and defaults to
  // `draft`. The LEGAL set (canonical ∪ added) lives in the core and is enforced
  // as a WARN-not-fail advisory by the bare-Node gate (`validate-frontmatter.mjs`
  // consults `resolveGovernance(docsRoot).legalStatuses`); keeping the build side
  // lenient is what holds the schema/gate parity (a truly-unknown status warns on
  // the gate and builds on the site — never a hard divergence). `STATUSES` stays
  // the canonical reference set exported from the core for that gate check.
  doc_status: z.string().min(1).default('draft'),
  updated: z.coerce.date().optional(),
  // Open vocabulary (FR-003): a non-canonical `type` is ADVISORY, not a build
  // failure — the site schema accepts any string; the standalone validator warns
  // on a value outside DOC_TYPES (which stays exported for that warn check).
  type: z.string().optional(),
  // Open vocabulary (ADR-0009): site schema is permissive, the standalone
  // validator warns on a value outside `KINDS`.
  kind: z.string().optional(),
  // Bundle-root README only.
  okf_version: z.string().optional(),
  authors: z.array(z.string()).optional(),
  // A related ref is a bare slug or `{ ref, note? }` (ADR-0009). Ref integrity
  // is enforced by the build and `check-links.mjs`, not by shape here.
  related: z
    .array(
      z.union([
        z.string(),
        z.object({ ref: z.string(), note: z.string().optional() }),
      ]),
    )
    .optional(),
  external_references: z
    .array(
      z.union([
        z.object({
          url: z.string(),
          title: z.string(),
          note: z.string().optional(),
        }),
        z.object({ type: z.string(), id: z.string() }),
      ]),
    )
    .optional(),
  audience: z
    .array(z.object({ profile: z.string(), guidance_text: z.string() }))
    .optional(),
  moscow: z
    .object({
      level: z.enum(['Must', 'Should', 'Could', "Won't"]),
      rationale: z.string(),
    })
    .optional(),
  // Page hero + default social image; `alt` is required for accessibility.
  hero_image: z.object({ src: z.string(), alt: z.string() }).optional(),
  social_thumb: z
    .union([z.object({ src: z.string(), alt: z.string() }), z.string()])
    .optional(),
  tags: z.array(z.string()).optional(),
  // Plain string (not `.url()`): aligned with the standalone validator (the
  // doc-sanity gate), so a non-URL `resource` does not pass validate but fail
  // the build. Parity test guards this alignment going forward.
  resource: z.string().optional(),
  generated: z
    .object({ by: z.string(), at: z.string() })
    .optional(),
  verified: z
    .array(z.object({ by: z.string(), at: z.string() }))
    .optional(),
  sources: z
    .array(z.object({ resource: z.string(), title: z.string() }))
    .optional(),
  stale_after: z.coerce.date().optional(),
  // Persona attribute fields (ADR-0019): present on `kind: Persona` pages.
  // Kept OPTIONAL here — `kind` is open `z.string()`, so no clean per-kind
  // discriminated union exists in the build schema; requiredness for
  // `kind === Persona` is the standalone validator's job (WP03), preserving the
  // schema (lenient) / validator (strict, contextual) parity M1 established.
  role: z.string().optional(),
  goals: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  // Glossary page-local fields (ADR-0028, M4). Both OPTIONAL and purely additive:
  // a page with neither validates and renders exactly as before (NFR-002).
  //  - `glossary_context` names the bounded context the page belongs to, so the
  //    auto-linker (ADR-0027) resolves a term to the right definition and can
  //    settle a collision the page context covers. Not inherited in v1.
  //  - `glossary_autolink` (absent = `true` at read sites) opts the whole page
  //    out of auto-linking (FR-008); `:term` links still work and are still
  //    listed. The site schema is lenient; an unknown `glossary_context` is a
  //    build warning in the plugin layer, not a schema error.
  glossary_context: z.string().optional(),
  glossary_autolink: z.boolean().optional(),
  // Kitty extension.
  agent: agentHints,
};

/**
 * Starlight docs schema extended with the convention's metadata. Pass to
 * `defineCollection({ schema: docKittyDocsSchema() })` in a site's
 * `content.config.ts`.
 */
export function docKittyDocsSchema() {
  return docsSchema({
    extend: z.object(docKittyFields),
  });
}

export interface DocKittyLoaderOptions {
  /**
   * Directory (relative to the site root) holding the Common Docs tree.
   * Defaults to the repo-root `docs/` — the convention's native location.
   */
  base?: string;
  /**
   * Glob patterns to include. Only the default is supported: the route table,
   * the draft sweep and the link gates walk the tree with `walkMarkdownPaths`,
   * which cannot see a narrowed pattern, so the loader rejects any other value
   * rather than let the table list pages the loader never loads.
   */
  pattern?: string | string[];
  /**
   * @deprecated Set `indexBasename` once, in `defineDocKittyIntegrations`; the
   * loader reads it from there (FR-007). Omit this option. A value that differs
   * from the integration's is a build error. It is only used when the loader runs
   * without the integration (unit tests, a custom pipeline).
   */
  indexBasename?: IndexBasenameOption;
}

/**
 * Internal handoff written by `defineDocKittyIntegrations` (`config.ts`). Named
 * here, not imported, because `schema.ts` must never import `config.ts` (C-004).
 */
const DK_INDEX_BASENAME_ENV = 'DK_INDEX_BASENAME';

/** The names the integration published, or undefined when it has not run. */
function publishedIndexBasenames(): string[] | undefined {
  const raw = process.env[DK_INDEX_BASENAME_ENV];
  if (raw === undefined || raw === '') return undefined;
  return JSON.parse(raw) as string[];
}

/**
 * The index names the loader uses (FR-007). Read at load time, not when the
 * loader is built: Astro evaluates the site config, and so the integration,
 * before it loads `content.config.ts`, but a module that builds the loader at
 * import time must not depend on that order.
 */
function resolveLoaderIndexBasenames(option: IndexBasenameOption | undefined): string[] {
  const published = publishedIndexBasenames();
  if (option === undefined) return published ?? normalizeIndexBasenames(undefined);
  const given = normalizeIndexBasenames(option);
  if (published === undefined) return given;
  const lower = (names: string[]) => names.map((n) => n.toLowerCase());
  if (JSON.stringify(lower(given)) !== JSON.stringify(lower(published))) {
    throw new Error(
      `[dk-loader] indexBasename ${JSON.stringify(given)} passed to docKittyDocsLoader does not match ` +
        `indexBasename ${JSON.stringify(published)} set in defineDocKittyIntegrations. Remove the option ` +
        `from docKittyDocsLoader in content.config.ts; the loader reads it from the integration.`,
    );
  }
  return published;
}

/**
 * Content loader that globs Markdown under `base` and applies the configurable
 * index-basename rule (FR-001/FR-002/FR-003/FR-004).
 *
 * The reserved `log.md` (an optional, frontmatter-free change log) is excluded
 * so it never fails schema validation.
 *
 * Route collision (FR-004): the id map is resolved ONCE, lazily, via a
 * synchronous pre-scan of `base` (`resolveIndexEntries`) — Astro's `generateId`
 * callback sees one entry at a time with no sibling context, so finding two
 * files served at one route needs the whole tree. A collision is fatal: the
 * scan throws one error naming every colliding path (`formatRouteCollisions`),
 * exactly like the integration and `check-links --strict`.
 *
 * NOTE: depending on the installed Starlight version, Starlight may expect its
 * own `docsLoader()` wrapper or a specific way to point the `docs` collection
 * outside `src/content/docs`. This returns Astro's `glob` loader with the id
 * mapping; confirm the wiring when versions are pinned during build set-up.
 *
 * Draft publication: this loader is where `DK_PUBLISH_DRAFTS` takes effect. The
 * default is `on` (drafts are kept, with `pagefind: false`); `off` drops them. A
 * site that loads its docs collection some other way still gets the `noindex`
 * marker and the machine-surface exclusions, but its draft pages are emitted
 * whatever the setting says; the integration warns when that happens.
 */
const DEFAULT_DOCS_PATTERN = ['**/*.{md,mdx}', '!**/log.md', '!**/_meta/**', '!**/_meta.{md,mdx}'];

export function docKittyDocsLoader(options: DocKittyLoaderOptions = {}) {
  const {
    base = 'docs',
    pattern = DEFAULT_DOCS_PATTERN,
  } = options;
  if (JSON.stringify([pattern].flat()) !== JSON.stringify(DEFAULT_DOCS_PATTERN)) {
    throw new Error(
      `[dk-loader] a custom "pattern" is not supported (got ${JSON.stringify(pattern)}): the route ` +
        `table is built from the same walk as the default pattern, so a narrowed pattern would ` +
        `rewrite .md links to pages that are never loaded. Omit "pattern".`,
    );
  }

  let resolvedIds: Map<string, string> | null = null;
  let indexBasename: string[] = [];
  const resolveIds = (): Map<string, string> => {
    if (resolvedIds) return resolvedIds;
    indexBasename = resolveLoaderIndexBasenames(options.indexBasename);
    const absBase = path.resolve(process.cwd(), base);
    const paths = walkMarkdownPaths(absBase);
    const { ids, collisions } = resolveIndexEntries(paths, { indexBasename });
    if (collisions.length) throw new Error(formatRouteCollisions(collisions, { docsDir: base }));
    resolvedIds = ids;
    return ids;
  };

  const inner = glob({
    base,
    pattern,
    // Astro rejects empty ids; the bundle root ("") is stored as ROOT_ENTRY_ID.
    generateId: ({ entry }) => {
      const id = resolveIds().get(entry) ?? readmeToIndexId(entry, { indexBasename });
      return id || ROOT_ENTRY_ID;
    },
  });

  // Draft publication (FR-013..FR-016, research R8): the ONE cut every HTML
  // surface inherits. Starlight builds its routes, sidebar and search records
  // from this collection, so an entry that never reaches the store has no page,
  // no sidebar link and no search record.
  //
  // `glob()` keeps its own `name` and `schema` behaviour: only `load` is wrapped.
  // Two places apply the policy, because the store persists between builds:
  //  - `set` on the store handed to `glob()`, which covers every entry it parses,
  //    including the files its dev-server watcher re-reads;
  //  - a sweep after the load, which covers entries `glob()` left alone because
  //    their digest was unchanged since a build that ran with the other value.
  return {
    ...inner,
    load: async (context: LoaderContext): Promise<void> => {
      const publishDrafts = publishDraftsInForce();
      const { store } = context;
      await inner.load({
        ...context,
        store: {
          ...store,
          set: (entry) => {
            const next = applyDraftPolicy(entry, publishDrafts);
            if (next === null) {
              store.delete(entry.id);
              return false;
            }
            return store.set(next);
          },
        },
      });
      for (const [id, entry] of [...store.entries()]) {
        const next = applyDraftPolicy(entry, publishDrafts);
        if (next === entry) continue;
        // `set` ignores an entry whose digest it already holds, so replace it.
        store.delete(id);
        if (next !== null) store.set(next);
      }
    },
  };
}

type LoaderContext = Parameters<ReturnType<typeof glob>['load']>[0];

/**
 * Decide what the docs collection keeps of one entry (FR-013, FR-014).
 *
 *  - Not a draft, or the site root: the entry itself, untouched. The root page
 *    is never filtered, so a site always has a home page.
 *  - A draft with drafts NOT published: `null`. The entry is dropped.
 *  - A draft with drafts published: a copy with Starlight's `pagefind: false`,
 *    which keeps the page out of the search index (the page gets no
 *    `data-pagefind-body`). The same entry is returned when that is already set.
 *
 * `doc_status` is read after schema parsing, so an absent status has already
 * taken the schema default `draft`.
 *
 * @internal An internal seam the toolkit's own tests use; not supported API.
 */
export function applyDraftPolicy<T extends { id: string; data: Record<string, unknown> }>(
  entry: T,
  publishDrafts: boolean,
): T | null {
  if (!isDraftEntry(entry)) return entry;
  if (!publishDrafts) return null;
  if (entry.data.pagefind === false) return entry;
  return { ...entry, data: { ...entry.data, pagefind: false } };
}

// ---------------------------------------------------------------------------
// Citation catalog collections (ADR-0018)
//
// `bibliography` and `tools` are content-layer data collections, each loaded
// from a single YAML file via Astro's `file()` loader (which parses YAML and
// keys array items by their `id` field). The toolkit exports a zod schema + a
// loader per collection — mirroring `docKittyDocsSchema()`/`docKittyDocsLoader()`
// — so a consumer wires them into `content.config.ts` in one step.
// ---------------------------------------------------------------------------

/**
 * Bibliography record fields (CSL-JSON-lite subset, ADR-0018). `id`/`title`/`url`
 * are required; the rest are optional. `issued`/`accessed` are coerced to string
 * so an unquoted YAML year (`2017`) or date (`2026-08-24`) survives validation.
 */
export const bibliographyFields = {
  id: z.string(),
  type: z.string().optional(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  container: z.string().optional(),
  url: z.string(),
  issued: z.coerce.string().optional(),
  accessed: z.coerce.string().optional(),
  note: z.string().optional(),
};

/** Tools record fields (ADR-0018): `id`/`name`/`url` required, `note` optional. */
export const toolsFields = {
  id: z.string(),
  name: z.string(),
  url: z.string(),
  note: z.string().optional(),
};

/**
 * Zod schema for the `bibliography` collection. Pass to
 * `defineCollection({ loader: docKittyBibliographyLoader(), schema: docKittyBibliographySchema() })`.
 */
export function docKittyBibliographySchema() {
  return z.object(bibliographyFields);
}

/** Zod schema for the `tools` collection (see `docKittyBibliographySchema`). */
export function docKittyToolsSchema() {
  return z.object(toolsFields);
}

export interface DocKittyCatalogLoaderOptions {
  /** Path (relative to the site root) to the catalog YAML file. */
  path?: string;
}

/**
 * Content loader for the `bibliography` collection. Reads a single YAML file
 * (default `docs/_meta/bibliography.yaml`, the convention's registry home) and
 * keys entries by their `id` field.
 */
export function docKittyBibliographyLoader(options: DocKittyCatalogLoaderOptions = {}) {
  const { path = 'docs/_meta/bibliography.yaml' } = options;
  return file(path);
}

/** Content loader for the `tools` collection (default `docs/_meta/tools.yaml`). */
export function docKittyToolsLoader(options: DocKittyCatalogLoaderOptions = {}) {
  const { path = 'docs/_meta/tools.yaml' } = options;
  return file(path);
}
