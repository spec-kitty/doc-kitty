/**
 * The producer registry (#330, ADR-0079 D6, ADR-0083): every doc-kitty generator
 * that stamps the pages it writes is registered here once, with its role and,
 * for an ownership producer, the scope it owns. The frontmatter gate
 * (`isGeneratedPage`), the stamp helpers (`PRODUCERS`, `isGeneratedStamp`,
 * `isRegenerableStamp`) and a generator's output scan (`producer-output.mjs`)
 * read this registry instead of naming producers themselves.
 *
 * Two roles:
 *   - OWNERSHIP: the producer generates, and so owns, the pages it stamps
 *     (`<id>/<version>`). Only these make a page "generated".
 *   - PROVENANCE: the producer records where a page started (the scaffold), but
 *     never owns it. It has no scope.
 *
 * Two scope types:
 *   - `{type: 'section', section?, kinds?}`: a whole section. Without `section`,
 *     any one top-level section (the frontmatter gate does not know a configurable
 *     section, such as `gherkin.section`; a caller that does narrows it with
 *     `options.scopes`). Never a root page.
 *   - `{type: 'directories', section, dirs, kinds?}`: directories inside one
 *     section (the pack pages of #338 own `<section>/<dir>/**` per pack).
 *   `kinds` restricts either scope to those page `kind` values.
 *
 * The rule: a stamp alone never makes a page generated. A page is owned by a
 * producer when it is inside the producer's scope AND carries the producer's
 * versioned stamp. The glossary (`recognition: 'scope'`) keeps its historical
 * path-and-kind rule as its scope, with its stamp optional.
 *
 * fs-free: imported by the bare-Node gates and by build-time code alike.
 *
 * @module producers
 */

/**
 * @typedef {{ type: 'section', section?: string, kinds?: readonly string[] }
 *   | { type: 'directories', section: string, dirs: readonly string[], kinds?: readonly string[] }} OwnershipScope
 */

/**
 * @typedef {object} Producer
 * @property {string} id the stamp prefix (`<id>/<version>`)
 * @property {'ownership' | 'provenance'} role
 * @property {OwnershipScope} [scope] required for an ownership producer, absent otherwise
 * @property {'stamp-and-scope' | 'scope'} [recognition] default `stamp-and-scope`
 * @property {string} [retiredBy] the producer's retired unversioned `generated.by` (#210)
 * @property {string} [regenerateHint] how to regenerate its pages, for error messages
 */

/**
 * @typedef {object} ProducerRegistry
 * @property {(role?: 'ownership' | 'provenance') => string[]} ids
 * @property {(id: string) => Producer | undefined} get
 * @property {(by: unknown) => string | undefined} producerOfStamp
 * @property {(by: unknown) => string | undefined} retiredProducerOf
 * @property {(relPath: string, data: Record<string, any> | undefined | null,
 *   options?: { scopes?: Record<string, OwnershipScope | undefined> }) => string | undefined} ownerOfPage
 */

const SCOPE_TYPES = new Set(['section', 'directories']);

/**
 * Is a page inside `scope`? `relPath` is POSIX, relative to the docs root.
 *
 * @param {OwnershipScope} scope
 * @param {string} relPath
 * @param {unknown} [kind] the page's `kind`
 * @returns {boolean}
 */
export function inScope(scope, relPath, kind) {
  if (scope.kinds && !scope.kinds.includes(/** @type {string} */ (kind))) return false;
  const segments = relPath.split('/');
  // Only a normalised POSIX path is ever in a scope: no empty, `.` or `..`
  // segment (so no leading or doubled `/`), and no backslash.
  if (relPath.includes('\\') || segments.some((s) => s === '' || s === '.' || s === '..')) return false;
  if (scope.type === 'section') {
    if (segments.length < 2) return false;
    return scope.section === undefined || segments[0] === scope.section;
  }
  if (scope.type === 'directories') {
    return segments.length >= 3 && segments[0] === scope.section && scope.dirs.includes(segments[1]);
  }
  return false;
}

/**
 * Is `by` the versioned stamp of producer `id` (`<id>/<version>`, version non-empty)?
 *
 * @param {unknown} by
 * @param {string} id
 */
function isVersionedStampOf(by, id) {
  return typeof by === 'string' && by.startsWith(`${id}/`) && by.length > id.length + 1;
}

/** A single path segment: non-empty, no `/`. @param {unknown} v */
const isSegment = (v) => typeof v === 'string' && v !== '' && !v.includes('/');

/** @param {unknown} v */
const isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '');

/**
 * @param {Producer} entry
 */
function checkEntry(entry) {
  const { id, role, scope, recognition } = entry;
  if (typeof id !== 'string' || id === '') throw new Error('producer registry: a producer needs a non-empty id');
  if (role !== 'ownership' && role !== 'provenance') {
    throw new Error(`producer registry: ${id} has role ${JSON.stringify(role)}; expected ownership or provenance`);
  }
  if (role === 'provenance') {
    if (scope !== undefined) throw new Error(`producer registry: provenance producer ${id} must not declare a scope`);
    return;
  }
  if (scope === undefined) throw new Error(`producer registry: ownership producer ${id} must declare a scope`);
  if (!SCOPE_TYPES.has(scope.type)) {
    throw new Error(`producer registry: ${id} has unknown scope type ${JSON.stringify(scope.type)}`);
  }
  if (recognition !== undefined && recognition !== 'stamp-and-scope' && recognition !== 'scope') {
    throw new Error(`producer registry: ${id} has recognition ${JSON.stringify(recognition)}; expected stamp-and-scope or scope`);
  }
  if ((scope.type === 'directories' || scope.section !== undefined) && !isSegment(scope.section)) {
    throw new Error(`producer registry: ${id} needs its scope's section to be one path segment`);
  }
  if (scope.type === 'directories' && !(isStringList(scope.dirs) && scope.dirs.length > 0 && scope.dirs.every(isSegment))) {
    throw new Error(`producer registry: ${id} needs a non-empty dirs list of path segments for a directories scope`);
  }
  if (scope.kinds !== undefined && !isStringList(scope.kinds)) {
    throw new Error(`producer registry: ${id} needs its scope's kinds to be a list of strings`);
  }
  // A producer recognised by its scope alone, over every section, would own every
  // non-root page of the tree, stamp or no stamp.
  if (recognition === 'scope' && scope.type === 'section' && scope.section === undefined) {
    throw new Error(`producer registry: ${id} has recognition 'scope', so its scope must name a section`);
  }
}

/**
 * Build a registry. Pure: no fs. The registration order is the order `ids()`
 * returns and the order `ownerOfPage` tries producers in.
 *
 * @param {readonly Producer[]} entries
 * @returns {Readonly<ProducerRegistry>}
 */
export function createProducerRegistry(entries) {
  /** @type {Map<string, Readonly<Producer>>} */
  const byId = new Map();
  for (const entry of entries) {
    checkEntry(entry);
    if (byId.has(entry.id)) throw new Error(`producer registry: duplicate producer id ${entry.id}`);
    byId.set(entry.id, Object.freeze({ ...entry }));
  }
  const all = [...byId.values()];
  const ownership = all.filter((p) => p.role === 'ownership');

  /**
   * An override scope replaces a producer's registered scope for one call, so it
   * is held to the same rules as at registration (decisions 3 and 4 of
   * ADR-0083): a known ownership producer, a well-formed scope, and no
   * every-section scope for a producer recognised by its scope alone.
   *
   * @param {Record<string, OwnershipScope | undefined>} scopes
   */
  const checkOverrides = (scopes) => {
    // Checked on every call, so a map changed after a first call is checked again.
    for (const [id, scope] of Object.entries(scopes)) {
      if (scope === undefined) continue;
      const producer = byId.get(id);
      if (producer === undefined || producer.role !== 'ownership') {
        throw new Error(`producer registry: a scope override names ${id}, which is not an ownership producer`);
      }
      checkEntry({ ...producer, scope });
    }
  };

  return Object.freeze({
    ids: (role) => all.filter((p) => role === undefined || p.role === role).map((p) => p.id),
    get: (id) => byId.get(id),
    producerOfStamp: (by) => ownership.find((p) => isVersionedStampOf(by, p.id))?.id,
    retiredProducerOf: (by) =>
      typeof by === 'string' ? ownership.find((p) => p.retiredBy !== undefined && p.retiredBy === by)?.id : undefined,
    ownerOfPage(relPath, data, options = {}) {
      if (options.scopes !== undefined) checkOverrides(options.scopes);
      for (const producer of ownership) {
        const scope = options.scopes?.[producer.id] ?? /** @type {OwnershipScope} */ (producer.scope);
        if (!inScope(scope, relPath, data?.kind)) continue;
        if (producer.recognition === 'scope' || isVersionedStampOf(data?.generated?.by, producer.id)) return producer.id;
      }
      return undefined;
    },
  });
}

/**
 * doc-kitty's own producers. A later producer (the pack pages of #338, the
 * missions and Ops pages of #413) adds an entry here with its scope.
 */
export const PRODUCER_REGISTRY = createProducerRegistry([
  {
    id: 'doc-kitty-gherkin',
    role: 'ownership',
    // A whole section, configurable (`gherkin.section`): any one section unless
    // the caller passes the resolved one.
    scope: { type: 'section' },
    retiredBy: 'doc-kitty/gherkin',
    regenerateHint: 'run `dockitty-generate-feature-pages`',
  },
  {
    id: 'doc-kitty-glossary',
    role: 'ownership',
    scope: { type: 'section', section: 'glossary', kinds: ['Glossary', 'Hub'] },
    recognition: 'scope',
    retiredBy: 'doc-kitty/glossary',
    regenerateHint: 'run `astro build` or `astro dev`, which rewrites the glossary pages',
  },
  {
    // The evidence index's hub page (#401, ADR-0087). A Hub in any one section,
    // narrowed per call to the configured hub path, like Gherkin's. The
    // snapshot `_meta/tom-annex.snapshot.json` is not a page and is not scoped.
    id: 'doc-kitty-tom-annex',
    role: 'ownership',
    scope: { type: 'section', kinds: ['Hub'] },
    recognition: 'stamp-and-scope',
    regenerateHint: 'build, then run `dockitty-tom-annex --dist <dist> [--snapshot <path>] [--hub <path>]` (see docs/guides/tom-annex.md)',
  },
  { id: 'doc-kitty-scaffold', role: 'provenance' },
]);
