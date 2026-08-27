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
 * Build the {@link SharedTermIndex} from the validated contexts **once** (INV-G1).
 * Names AND aliases share `bySurface`, keyed lowercased (FR-006/FR-012); every
 * entry's `anchor` is `slug(term.name)` (NFR-004). Insertion order follows the
 * source order, so the index is deterministic (INV-G2).
 */
export function buildIndex(contexts: Context[]): SharedTermIndex {
  const bySurface: SharedTermIndex['bySurface'] = new Map();
  const contextMap: SharedTermIndex['contexts'] = new Map();

  for (const context of contexts) {
    contextMap.set(context.name, {
      slug: slug(context.name),
      terms: context.terms,
      ...(context.domainVisionStatement !== undefined
        ? { domainVisionStatement: context.domainVisionStatement }
        : {}),
    });

    for (const term of context.terms) {
      const anchor = slug(term.name);
      const surfaces: string[] = [term.name, ...(term.aliases ?? [])];
      for (const surface of surfaces) {
        const key = surface.toLowerCase();
        const entry = { context: context.name, anchor, termName: term.name };
        const bucket = bySurface.get(key);
        if (bucket) bucket.push(entry);
        else bySurface.set(key, [entry]);
      }
    }
  }

  return { bySurface, contexts: contextMap };
}
