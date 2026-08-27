/**
 * Frontmatter schema + content loader for the Common Docs — Kitty Variation.
 *
 * `docKittyDocsSchema` extends Starlight's docs schema with the convention's
 * metadata (velvet-tiger/common-docs v1.2 fields + a Kitty `agent` extension).
 * `docKittyDocsLoader` reads the repo-root `docs/` tree and implements the
 * README-as-index twist by rewriting entry ids at load time.
 */
import { z } from 'zod';
import { file, glob } from 'astro/loaders';
// Starlight re-exports its schema helper here; kept as the single Starlight
// touch point so the rest of the toolkit stays framework-light.
import { docsSchema } from '@astrojs/starlight/schema';
import { readmeToIndexId, ROOT_ENTRY_ID } from './metadata.js';

export { readmeToIndexId };

export const DOC_TYPES = [
  'Context',
  'Architecture',
  'ADR',
  'Template',
  'Plan',
  'Epic',
  'Feature',
  'API',
  'Configuration',
  'Integration',
  'Security',
  'Guide',
  'Operations',
  'Runbook',
  'Migration',
  'Changelog',
  'Presentation',
] as const;

/**
 * The canonical `kind` vocabulary (ADR-0009): the four Divio content quadrants
 * plus the structural kinds. Open vocabulary — the site schema accepts any
 * string; the standalone validator warns on a value outside this set. Exported
 * for reuse by the per-kind layout map (WP02).
 */
export const KINDS = [
  'Tutorial',
  'How-To',
  'Reference',
  'Explanation',
  'Hub',
  'ADR',
  'Changelog',
  'Glossary',
  'Presentation',
  'Persona',
  'Planning',
  'Feature',
  'User-Journey',
] as const;

export type Kind = (typeof KINDS)[number];

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
 * The Common Docs — Kitty Variation frontmatter fields, layered on Starlight's.
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
  doc_status: z
    .enum(['draft', 'active', 'deprecated', 'superseded'])
    .default('draft'),
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
  /** Glob patterns to include. */
  pattern?: string | string[];
}

/**
 * Content loader that globs Markdown under `base` and applies README-as-index.
 *
 * The reserved `log.md` (an optional, frontmatter-free change log) is excluded
 * so it never fails schema validation.
 *
 * NOTE: depending on the installed Starlight version, Starlight may expect its
 * own `docsLoader()` wrapper or a specific way to point the `docs` collection
 * outside `src/content/docs`. This returns Astro's `glob` loader with the id
 * mapping; confirm the wiring when versions are pinned during build set-up.
 */
export function docKittyDocsLoader(options: DocKittyLoaderOptions = {}) {
  const {
    base = 'docs',
    pattern = ['**/*.{md,mdx}', '!**/log.md'],
  } = options;
  return glob({
    base,
    pattern,
    // Astro rejects empty ids; the bundle root ("") is stored as ROOT_ENTRY_ID.
    generateId: ({ entry }) => readmeToIndexId(entry) || ROOT_ENTRY_ID,
  });
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
