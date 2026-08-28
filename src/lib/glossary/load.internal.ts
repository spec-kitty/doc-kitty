/**
 * Glossary loader — pure core (Astro-free, unit-tested). Everything here is
 * framework- and I/O-free: string in (YAML text) → validated model →
 * {@link SharedTermIndex}. The thin {@link ./load.ts} wrapper adds only file I/O +
 * presence gating (INV-G1: this is the one place the definitions file is parsed
 * and the index is built).
 *
 * Pinned schema — Contextive **Community** definitions format v1 (ADR-0026, FR-002):
 *   contexts[] → { name, domainVisionStatement?, terms[] → { name, definition,
 *   aliases?, examples?, meta? } }
 * The zod schema below mirrors that pinned shape. If the Community format changes,
 * validation fails loudly here rather than silently mis-parsing (schema-drift risk,
 * ADR-0026 Risks). Bump {@link PINNED_CONTEXTIVE_SCHEMA_VERSION} and this schema
 * together when the pinned format is intentionally moved.
 */
import { z } from 'zod';
import matter from 'gray-matter';
// Reuse the M5 scheme allowlist verbatim (FR-004, INV-G6) — do NOT reinvent it.
// safeHref returns the value for http:/https:/mailto:/no-scheme, `undefined` for
// anything else (javascript:, data:, protocol-relative, …).
import { safeHref } from '../rehype/diagram-figure.js';
import type { Context, SharedTermIndex } from './types.js';
import { slug } from './anchor.js';

/** The pinned Contextive Community definitions format this loader validates. */
export const PINNED_CONTEXTIVE_SCHEMA_VERSION = 'contextive-community-v1' as const;

const TermSchema = z.object({
  name: z.string(),
  definition: z.string(),
  aliases: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  meta: z.record(z.string()).optional(),
});

const ContextSchema = z.object({
  name: z.string(),
  domainVisionStatement: z.string().optional(),
  terms: z.array(TermSchema),
});

/**
 * Top-level definitions shape. Unknown keys (e.g. a Contextive `format` marker)
 * are tolerated — only `contexts` and the fields above are load-bearing.
 */
const DefinitionsSchema = z.object({
  contexts: z.array(ContextSchema),
});

/** True for a plain object we can index by string keys. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Read `raw[key]` safely for both objects and arrays; `undefined` off-path. */
function step(node: unknown, key: string | number): unknown {
  if (Array.isArray(node) && typeof key === 'number') return node[key];
  if (isRecord(node)) return node[String(key)];
  return undefined;
}

/** A `"name"` label when present/non-empty, else a positional `#idx` fallback. */
function label(value: unknown, index: number): string {
  return typeof value === 'string' && value.length > 0 ? `"${value}"` : `#${index}`;
}

/**
 * Turn a zod issue path into a human locator naming the offending
 * context[/term[/field]] (FR-002) — e.g. `context "Shipping" → term "Cargo" →
 * field "definition"`. Falls back to a positional index when a `name` is itself
 * the missing/invalid field.
 */
function locate(raw: unknown, path: ReadonlyArray<string | number>): string {
  const segs: string[] = [];
  let contextIndex = -1;
  let termIndex = -1;

  for (let i = 0; i < path.length; i++) {
    if (path[i] === 'contexts' && typeof path[i + 1] === 'number') {
      contextIndex = path[i + 1] as number;
    } else if (path[i] === 'terms' && typeof path[i + 1] === 'number') {
      termIndex = path[i + 1] as number;
    }
  }

  let contextNode: unknown;
  if (contextIndex >= 0) {
    contextNode = step(step(raw, 'contexts'), contextIndex);
    segs.push(`context ${label(step(contextNode, 'name'), contextIndex)}`);
    if (termIndex >= 0) {
      const termNode = step(step(contextNode, 'terms'), termIndex);
      segs.push(`term ${label(step(termNode, 'name'), termIndex)}`);
    }
  }

  const field = [...path].reverse().find((p) => typeof p === 'string');
  if (typeof field === 'string' && field !== 'contexts') segs.push(`field "${field}"`);

  return segs.length > 0 ? segs.join(' → ') : path.map(String).join('.') || '(root)';
}

/**
 * Validate a parsed definitions object against the pinned schema and scheme-check
 * every `meta` URL. Returns the validated {@link Context}[] or **throws** a
 * build-fatal `Error` whose message names the offending context/term/field
 * (FR-002/FR-004). Never swallows — the build must fail on invalid input.
 */
export function parseAndValidate(raw: unknown): Context[] {
  const result = DefinitionsSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Invalid glossary definitions (${PINNED_CONTEXTIVE_SCHEMA_VERSION}): ` +
        `${locate(raw, issue.path)}: ${issue.message}`,
    );
  }

  const contexts = result.data.contexts as Context[];

  // Scheme safety (FR-004, INV-G6): every meta value is treated as a candidate
  // href; a non-allowlisted scheme is build-fatal. safeHref returns `undefined`
  // for a rejected scheme (and the trimmed value for a safe/relative one).
  for (const context of contexts) {
    for (const term of context.terms) {
      if (!term.meta) continue;
      for (const [key, value] of Object.entries(term.meta)) {
        if (safeHref(value) === undefined) {
          throw new Error(
            `Invalid glossary definitions (${PINNED_CONTEXTIVE_SCHEMA_VERSION}): ` +
              `context "${context.name}" → term "${term.name}" → field "meta.${key}": ` +
              `non-allowlisted URL scheme in "${value}"`,
          );
        }
      }
    }
  }

  return contexts;
}

/**
 * Parse `.contextive/definitions.yaml` text into an untyped object. Reuses the
 * toolkit's existing `gray-matter` (js-yaml under the hood) — no new YAML
 * dependency — by wrapping the whole document as a single frontmatter block with a
 * collision-proof delimiter, so a bare-YAML file (no `---` fences) parses cleanly
 * and an interior `---` line is never mistaken for a fence.
 */
export function parseDefinitionsYaml(text: string): unknown {
  const DELIMITER = '~~~DK-GLOSSARY-YAML~~~';
  const wrapped = `${DELIMITER}\n${text}\n${DELIMITER}`;
  return matter(wrapped, { delimiters: DELIMITER }).data;
}

/**
 * Assign `base` a unique slug within `assigned`, de-colliding deterministically in
 * call (= source) order: the first claimant keeps `base`; each later collision gets
 * `base-2`, `base-3`, …. The probe loop also guards **re-collision** — a term whose
 * own name literally slugs to an already-taken suffix (e.g. a term named `C 2`
 * slugging to `c-2` while a `C`/`C++` pair also wants `c-2`) — by skipping to the
 * next free suffix. Pure and order-deterministic (INV-G2): same inputs → same slugs.
 */
function decollideSlug(base: string, assigned: Set<string>): string {
  if (!assigned.has(base)) {
    assigned.add(base);
    return base;
  }
  let n = 2;
  while (assigned.has(`${base}-${n}`)) n += 1;
  const result = `${base}-${n}`;
  assigned.add(result);
  return result;
}

/**
 * Build the {@link SharedTermIndex} from the validated contexts **once** (INV-G1).
 * Names AND aliases share `bySurface`, keyed lowercased (FR-006/FR-012). Anchors and
 * context page-slugs are computed HERE and stored authoritatively (issue #17): the
 * resolver, generator, and remark node-builders READ these values rather than each
 * recomputing `slug(...)`. Within a context, terms are anchored in source order and
 * colliding anchors are de-collided (`c`, `c-2`, `c-3`, …); distinct context names
 * that slug to the same page-slug are de-collided the same way, so two contexts (or
 * a context and the hub) can never write the same path. Insertion order follows the
 * source order, so the whole index is deterministic (INV-G2).
 *
 * Build-fatal (loud v1 constraints — an all-non-Latin corpus fails here, by design):
 *   - a term/context `name` that slugs to `""` (no `[a-z0-9]` characters), and
 *   - two byte-identical term names inside one context (anchors could not be kept
 *     distinct without silently guessing).
 */
export function buildIndex(contexts: Context[]): SharedTermIndex {
  const bySurface: SharedTermIndex['bySurface'] = new Map();
  const contextMap: SharedTermIndex['contexts'] = new Map();

  // De-collide distinct CONTEXT page-slugs across the whole corpus (source order).
  const contextSlugs = new Set<string>();

  for (const context of contexts) {
    const contextBase = slug(context.name);
    if (contextBase === '') {
      throw new Error(
        `Invalid glossary definitions (${PINNED_CONTEXTIVE_SCHEMA_VERSION}): ` +
          `context "${context.name}": name produces an empty page slug ` +
          `(no [a-z0-9] characters) — rename or transliterate`,
      );
    }
    const contextSlug = decollideSlug(contextBase, contextSlugs);

    // Per-context: unique term anchors (source order) + intra-context name guard.
    const anchorSet = new Set<string>();
    const anchors = new Map<string, string>();

    for (const term of context.terms) {
      // C-3: two byte-identical term names in one context cannot both anchor.
      if (anchors.has(term.name)) {
        throw new Error(
          `Invalid glossary definitions (${PINNED_CONTEXTIVE_SCHEMA_VERSION}): ` +
            `context "${context.name}" → term "${term.name}": duplicate term name in ` +
            `this context — term names must be unique per context`,
        );
      }

      const base = slug(term.name);
      if (base === '') {
        throw new Error(
          `Invalid glossary definitions (${PINNED_CONTEXTIVE_SCHEMA_VERSION}): ` +
            `context "${context.name}" → term "${term.name}": name produces an empty ` +
            `anchor (no [a-z0-9] characters) — add a Latin-alphanumeric alias or transliterate`,
        );
      }
      const anchor = decollideSlug(base, anchorSet);
      anchors.set(term.name, anchor);

      const surfaces: string[] = [term.name, ...(term.aliases ?? [])];
      for (const surface of surfaces) {
        const key = surface.toLowerCase();
        const entry = { context: context.name, contextSlug, anchor, termName: term.name };
        const bucket = bySurface.get(key);
        if (bucket) bucket.push(entry);
        else bySurface.set(key, [entry]);
      }
    }

    contextMap.set(context.name, {
      slug: contextSlug,
      terms: context.terms,
      anchors,
      ...(context.domainVisionStatement !== undefined
        ? { domainVisionStatement: context.domainVisionStatement }
        : {}),
    });
  }

  return { bySurface, contexts: contextMap };
}
