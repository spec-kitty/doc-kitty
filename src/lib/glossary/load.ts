/**
 * Glossary loader — the thin file-I/O + presence-gating shell over the pure core
 * ({@link ./load.internal.ts}). This is the **single** parse site (INV-G1): the
 * generator (WP03) and the config integration (WP08) call {@link loadGlossary}
 * once; the resolver, `:term`, and the block all read the one
 * {@link SharedTermIndex} it returns.
 *
 * Presence-gated (FR-001, INV-G4): with no `.contextive/definitions.yaml` the
 * loader returns `{ present: false }` and every downstream seam early-returns — no
 * `/glossary/` route, no auto-links, no new frontmatter, corpus byte-identical
 * (NFR-002). Present + invalid is build-fatal, throwing from the core naming the
 * offending context/term/field (FR-002/FR-004).
 *
 * This WP is dormant: nothing imports it yet (WP03/WP08 wire it, WP09 activates it
 * with the example definitions file), so the built corpus is unchanged.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SharedTermIndex } from './types.js';
import { buildIndex, parseAndValidate, parseDefinitionsYaml } from './load.internal.js';

/** Relative location of the Contextive Community definitions file under a root. */
const DEFINITIONS_RELATIVE_PATH = join('.contextive', 'definitions.yaml');

/** Result of {@link loadGlossary}: absent file vs. a parsed, validated index. */
export type LoadResult =
  | { present: false }
  | { present: true; index: SharedTermIndex };

/**
 * Parse + validate `.contextive/definitions.yaml` under `root` and build the shared
 * index once. Absent file → `{ present: false }` (no throw); present → read,
 * validate (build-fatal on invalid), and return `{ present: true, index }`.
 */
export function loadGlossary(root: string): LoadResult {
  const path = join(root, DEFINITIONS_RELATIVE_PATH);
  if (!existsSync(path)) return { present: false };

  const raw = parseDefinitionsYaml(readFileSync(path, 'utf8'));
  const contexts = parseAndValidate(raw);
  return { present: true, index: buildIndex(contexts) };
}

/**
 * Cheap presence check — does `<root>/.contextive/definitions.yaml` exist? No parse,
 * no validation, so it is safe to call at component-render time. WP07's carrier mount
 * uses it to presence-gate the `<OnThisPage/>` swap and WP08 reuses the same signal;
 * the authoritative parse still happens once in {@link loadGlossary}.
 */
export function isGlossaryActive(root: string): boolean {
  return existsSync(join(root, DEFINITIONS_RELATIVE_PATH));
}
