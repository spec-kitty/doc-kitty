/**
 * Frontmatter schema + content loader for the Common Docs — Kitty Variation.
 *
 * `docKittyDocsSchema` extends Starlight's docs schema with the convention's
 * metadata (velvet-tiger/common-docs v1.2 fields + a Kitty `agent` extension).
 * `docKittyDocsLoader` reads the repo-root `docs/` tree and implements the
 * README-as-index twist by rewriting entry ids at load time.
 */
import { z } from 'zod';
import { glob } from 'astro/loaders';
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
  // re-declared required to match the convention.
  description: z.string(),
  doc_status: z
    .enum(['draft', 'active', 'deprecated', 'superseded'])
    .default('draft'),
  updated: z.coerce.date().optional(),
  type: z.enum(DOC_TYPES).optional(),
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
  resource: z.string().url().optional(),
  generated: z
    .object({ by: z.string(), at: z.string() })
    .optional(),
  verified: z
    .array(z.object({ by: z.string(), at: z.string() }))
    .optional(),
  sources: z
    .array(z.object({ resource: z.string().url(), title: z.string() }))
    .optional(),
  stale_after: z.coerce.date().optional(),
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
