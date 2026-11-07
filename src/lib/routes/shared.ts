/**
 * Route plumbing for the DocKitty handlers: the docs-root resolver (#22) and
 * the feed URL/XML helpers (`absolute`/`xmlEscape`). The docs-collection
 * adapter + index builder moved to `../docs-index.ts` (issue #90), which routes
 * AND components share.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { getCollection } from 'astro:content';
import { DK_DOCS_ROOT_ENV } from '../internal-env.mjs';
import type { DocKittyFrontmatter, IndexBasenameOption } from '../metadata.js';
import { isPublished, readmeToIndexId, slugFromEntryId } from '../metadata.js';
import { toolkitVersion } from '../generator-stamp.mjs';
import { withBase } from '../with-base.js';

/**
 * The minimal content-layer entry shape the docs-root resolver reads: the store
 * `id` (→ route slug) and the glob loader's `filePath` (relative to the project
 * root). Kept local so the pure derivation is testable without pulling in Astro.
 */
export interface DocsRootSignal {
  id: string;
  filePath?: string;
}

/**
 * Derive the absolute docs root from ONE content entry's `filePath` + store id,
 * applying the same README-as-index rule the loader uses. Pure and fs-free, so
 * it is unit-testable without Astro. Returns `null` when the entry carries no
 * `filePath` signal (e.g. a non-glob loader), letting the caller fall back.
 *
 * The store id maps to the route slug (`slugFromEntryId`), and `filePath` is
 * `<docsRoot>/<original path>` — so `readmeToIndexId(filePath)` yields
 * `<docsRoot>/<slug>`, and stripping the slug tail leaves the docs root. This
 * holds uniformly for the configured index basename(s) and plain `.md` files
 * because `readmeToIndexId` collapses each to the same slug the id already
 * carries — `indexBasename` MUST be the same option the loader that produced
 * `signal.id` was configured with, or the tail-strip math disagrees (FR-003).
 */
export function docsRootFromSignal(
  signal: DocsRootSignal,
  indexBasename?: IndexBasenameOption,
): string | null {
  if (!signal.filePath) return null;
  const slug = slugFromEntryId(signal.id);
  // Normalize any OS separators to '/' so readmeToIndexId's '/'-anchored regex
  // works, then strip the '<slug>' tail (plus its joining '/').
  const normalized = readmeToIndexId(signal.filePath.split(/[\\/]/).join('/'), {
    indexBasename,
  });
  const rootRel =
    slug === ''
      ? normalized
      : normalized.slice(0, Math.max(0, normalized.length - slug.length - 1));
  // rootRel === '' means the docs tree IS the project root (docsDir '.').
  return path.resolve(process.cwd(), rootRel || '.');
}

/**
 * The env var the integration publishes the authoritative docs root through
 * (F3/F5). The name comes from `src/lib/internal-env.mjs`, the one owner of
 * DocKitty's internal env names (ADR-0057). That module has no `astro:content`
 * import, so `config.ts` (the `astro.config` surface, where `astro:content`
 * does not resolve) and this module can both import it.
 */
export { DK_DOCS_ROOT_ENV };

/**
 * Choose the docs root from the two signals a route can see, purely (fs-free,
 * env-free) so the precedence is unit-testable without touching `process.env` or
 * Astro. Precedence: the integration-published absolute root wins; else the
 * content-layer `filePath` derivation (#22); else `null` for the caller's default.
 */
export function docsRootFromSignals(
  publishedRoot: string | undefined,
  entries: DocsRootSignal[],
  indexBasename?: IndexBasenameOption,
): string | null {
  if (publishedRoot && publishedRoot.trim() !== '') {
    return path.resolve(publishedRoot);
  }
  for (const entry of entries) {
    const root = docsRootFromSignal(entry, indexBasename);
    if (root) return root;
  }
  return null;
}

/**
 * Resolve the docs root the discovery routes read the section registry from.
 *
 * WHY (issue #22 → F3/F5): the sidebar registry AND the sitemap draft/feeds
 * filter (config.ts) resolve against the configurable `docsDir` option, but the
 * three routes historically derived the root independently. Under the documented
 * convention (`docsDir` == the loader `base`) the two agree; if a consumer sets
 * them differently the sitemap and the routes could filter against DIFFERENT
 * `sections.yaml` files — a silent cross-surface split (#22's own acknowledged
 * limitation).
 *
 * The fix: the integration KNOWS the resolved `docsDir` and PUBLISHES it as
 * `DK_DOCS_ROOT` (config.ts, at setup). This resolver PREFERS that published
 * truth, so both surfaces resolve the identical absolute root. When it is unset —
 * a standalone `APIRoute` rendered without the integration having run, or a route
 * unit test — we fall back verbatim to #22's content-layer derivation: the one
 * signal a route can otherwise trust is the content layer itself, since
 * `getCollection('docs')` honors the loader `base` and each glob-loaded entry
 * carries a `filePath` reflecting the ACTUAL on-disk content root. If no entry
 * exposes a `filePath` either (older loaders, an empty corpus), we fall back to
 * the convention default `<cwd>/docs` — byte-identical to the previous behavior
 * (no env + no filePath → `<cwd>/docs`).
 */
export async function docsRoot(indexBasename?: IndexBasenameOption): Promise<string> {
  const published = process.env[DK_DOCS_ROOT_ENV];
  const entries = (await getCollection('docs')) as unknown as DocsRootSignal[];
  return (
    docsRootFromSignals(published, entries, indexBasename) ?? path.join(process.cwd(), 'docs')
  );
}

/**
 * Resolve an absolute URL for a route against the configured site.
 *
 * WHY (pre-PR review, #61/#62 completeness gap): RSS, llms.txt, and the
 * agent-API JSON all compose their emitted absolute URLs through this one
 * function, but `path` here is deliberately the BASE-LESS `routeOfSlug`/
 * `toAgentRecord` contract (the agent-API `route`, which leaves combining it
 * with the base to its consumer). Without
 * this step, every emitted feed/index absolute URL 404'd on a based
 * deployment even though the on-page `<a href>`s (`withBase`, #61/C-002) and
 * the `<head>` feed-discovery links (the `Head` carrier) were already
 * base-prefixed.
 *
 * Routes through `withBase` — the SAME single base-prefix helper every
 * component uses — so this seam cannot independently clone/drift from it
 * (DIRECTIVE_024/#61's own root cause). `withBase` is idempotent, so a path
 * that already carries the base (or carries no base when none is configured)
 * passes through unchanged.
 */
/** The site's MCP launch wiring line (FR-009) — one canonical string for every surface. */
export function mcpLaunchUsage(site: URL | undefined): string {
  return `doc-kitty-mcp --site ${absolute(site, '/').replace(/\/+$/, '')}`;
}

export function absolute(site: URL | undefined, path: string): string {
  const base = site ?? new URL('http://localhost:4321');
  return new URL(withBase(path), base).href;
}

/**
 * Characters XML 1.0 forbids even as references: most C0 controls (all but tab, LF,
 * CR), U+FFFE and U+FFFF, and an unpaired surrogate. A parser rejects the whole
 * document on one, and escaping cannot help, so they are removed.
 */
// eslint-disable-next-line no-control-regex -- the point is to match control characters
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Minimal XML text escaping for feed content; also drops what XML 1.0 forbids. */
export function xmlEscape(value: string): string {
  return value
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Build identity (doc-kitty-mcp-server WP01/T004, FR-008)
// ---------------------------------------------------------------------------

/**
 * One corpus entry as {@link buildIdForBuild} hashes it: the route slug (the
 * corpus' identity key), the raw Markdown body bytes (frontmatter stripped,
 * exactly as the content layer stores them), and the validated frontmatter
 * data. The discovery routes all project their `getCollection('docs')` /
 * `collectDocEntries` results into this shape with the SAME mapping
 * (`slugFromEntryId(id)`, `body ?? ''`, `data` as-is), which is what makes the
 * index, per-page and scenarios artifacts of ONE build agree on the value.
 */
export interface BuildIdEntry {
  slug: string;
  body?: string;
  data: unknown;
}

/**
 * The ONE projection of a docs store entry into {@link BuildIdEntry} (FR-008).
 * Every artifact route MUST map through this function: a hand-written variant
 * anywhere would let the three artifact kinds disagree on the hashed set and
 * silently break torn-corpus detection. (`collectDocEntries` output is already
 * in `BuildIdEntry` shape — the loader IS the projection there; do not map it
 * a second time.)
 */
export function toBuildIdEntries(
  entries: ReadonlyArray<{ id: string; body?: string; data: unknown }>,
): BuildIdEntry[] {
  return entries.map((entry) => ({ slug: slugFromEntryId(entry.id), body: entry.body ?? '', data: entry.data }));
}

/**
 * Memoized store entry list -> build identity, for call sites that hash the
 * same `getCollection('docs')` result repeatedly within one build (the
 * per-page route stamps every page artifact in one process). Keyed on the
 * SOURCE array identity (Astro's content layer returns one array instance per
 * build), projecting and hashing once per array. Never persists across
 * builds: a new collection result recomputes.
 */
const buildIdMemo = new WeakMap<ReadonlyArray<{ id: string; body?: string; data: unknown }>, string>();
export function memoizedBuildIdForEntries(
  entries: ReadonlyArray<{ id: string; body?: string; data: unknown }>,
): string {
  const hit = buildIdMemo.get(entries);
  if (hit !== undefined) return hit;
  const value = buildIdForBuild(toBuildIdEntries(entries));
  buildIdMemo.set(entries, value);
  return value;
}

/**
 * Deterministic JSON serialization with STABLE KEY ORDER (objects sorted by
 * key code unit, arrays kept in order, `Date`s rendered as their ISO instant,
 * `undefined` object values dropped — matching `JSON.stringify`'s own scalar
 * rules). Two serializations are byte-equal iff the values are semantically
 * equal, regardless of authoring/parse key order.
 */
export function stableSerialize(value: unknown): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return stableSerialize(null);
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

/**
 * The corpus build identity (FR-008): sha256 hex over a canonical
 * serialization of the build's SOURCE inputs — every entry's slug, body bytes
 * and serialized frontmatter — plus the generator-relevant `config` and the
 * toolkit version. Never computed over emitted bytes: hashing output would be
 * self-referential (the index would hash a document that contains the hash)
 * and would force the generator to re-derive sibling route outputs (squad
 * A3). Because no artifact carries a build clock (`updated` is
 * frontmatter-derived), identical sources hash identically across rebuilds —
 * the committed determinism test asserts exactly that.
 *
 * DRAFTS never perturb the identity: the hashed set is the PUBLISHED corpus
 * (the loader's `isDraftEntry` contract, expressed over the slug projection —
 * bundle root id `index` is slug `''`), so a drafts-off rebuild hashes
 * identically to the same corpus with drafts on. The draft-publication
 * contract (draft pages invisible apart from their own records/surfaces)
 * holds byte-exact for every artifact the stamp lands on.
 *
 * All three artifact routes call this over the SAME full-corpus projection and
 * stamp the ONE value, so a torn corpus read (index from build N, page from
 * build N+1) shows two different values. Route-local options (title, links
 * gating, ...) shape only that route's own emitted fields and are passed by
 * NO route today: folding one route's options into the stamp would tear the
 * three artifact kinds apart within a single build.
 */
export function buildIdForBuild(
  entries: readonly BuildIdEntry[],
  config?: Record<string, unknown>,
): string {
  const canonical = stableSerialize({
    config: config ?? null,
    entries: entries
      .filter((entry) => entry.slug === '' || isPublished(entry.data as DocKittyFrontmatter))
      .map((entry) => ({ slug: entry.slug, body: entry.body ?? '', data: entry.data }))
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
    toolkit: toolkitVersion(),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
