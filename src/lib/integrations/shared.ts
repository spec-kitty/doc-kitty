/**
 * Helpers shared by the integrations and by `defineDocKittyIntegrations`.
 *
 * A leaf module: it imports nothing from `config.ts`, so the integration modules
 * and `config.ts` can both use it without a cycle.
 */
import path from 'node:path';
import process from 'node:process';
import type { IndexBasenameOption } from '../metadata.js';
import { draftRoutesOf } from '../draft-publication.mjs';

/**
 * The draft page routes of the site's docs tree (leading and trailing slash, no
 * base). `docsDir` is resolved against the working directory, like every other
 * docs-root read in this file; the walk and the draft rule are
 * {@link draftRoutesOf}'s, shared with the gate scripts. INV-1: a draft's URL
 * must not appear in the sitemap.
 */
export function siteDraftRoutes(docsDir: string, indexBasename?: IndexBasenameOption): Set<string> {
  return draftRoutesOf(path.resolve(process.cwd(), docsDir), indexBasename);
}

/**
 * Normalize an Astro `base` to a leading-slash, no-trailing-slash prefix.
 * `'/'` (or empty) → `''` (nothing to strip); `'/doc-kitty'`, `'doc-kitty'` and
 * `'/doc-kitty/'` all → `'/doc-kitty'`.
 */
export function normalizeBasePrefix(base: string): string {
  return ('/' + base + '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}
