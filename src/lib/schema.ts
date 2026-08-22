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
] as const;

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
 * Required by the convention: `title`, `description`, `status`, `updated`,
 * `type`. To keep partially-scaffolded stubs from breaking the build, `status`
 * defaults to `draft` and `updated`/`type` are lenient here; the standalone
 * `validate-frontmatter.mjs` gate enforces strict presence by path (e.g. the
 * bundle-root `README.md` is exempt from `type` and carries `okf_version`).
 */
export const docKittyFields = {
  // `title` and `description` come from Starlight's own schema; description is
  // re-declared required to match the convention.
  description: z.string(),
  status: z
    .enum(['draft', 'active', 'deprecated', 'superseded'])
    .default('draft'),
  updated: z.coerce.date().optional(),
  type: z.enum(DOC_TYPES).optional(),
  // Bundle-root README only.
  okf_version: z.string().optional(),
  authors: z.array(z.string()).optional(),
  related: z.array(z.string()).optional(),
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
