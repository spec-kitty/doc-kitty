/**
 * Framework-agnostic metadata model + helpers for the
 * **Common Docs — Kitty Variation**.
 *
 * The base convention is velvet-tiger/common-docs (spec v1.2), which targets a
 * repo-root `docs/` tree conforming to Open Knowledge Format (OKF) v0.2. The
 * Kitty Variation applies two twists:
 *   1. `README.md` is the reserved section index (instead of `index.md`), and
 *      — unlike vanilla Common Docs — it carries frontmatter.
 *   2. Metadata is leaned on harder: an optional `agent` block tunes the
 *      agent-API, and nav/RSS/discovery are all derived from frontmatter.
 *
 * These helpers are free of Astro/Starlight imports so they can be unit-tested
 * in isolation and reused by the builder scripts. The zod schema that validates
 * real frontmatter lives in `./schema.ts` and mirrors these types.
 */
import { isPresentationEntry } from './deck/is-presentation.js';
import { withBase } from './with-base.js';
// The section vocabulary + type-derivation lives in ONE fs-free, Astro-free place
// (#49 IC-01/IC-02): `vocabulary-core.mjs`. `metadata.ts` stays fs-free by
// importing ONLY the pure core (never `sections.ts`/the loader). The `DocType`/
// `DocStatus` unions are DERIVED from the core's JSDoc-const tuples (F7/F8) — so
// `durable` (#39/FR-004) flows in from the single core array with no edit here —
// and `SECTION_TYPE`/`expectedDocType` are re-exported so this module's public
// surface (consumed via `index.ts`'s `export *`) is unchanged (NFR-001).
import {
  STATUSES,
  DOC_TYPES,
  SECTION_TYPE,
  expectedDocType,
  compareCodeUnit,
} from './vocabulary-core.mjs';

export { SECTION_TYPE, expectedDocType };

/** OKF `type` — the one required-by-OKF field. One value per Common Docs section. */
export type DocType = (typeof DOC_TYPES)[number];

/**
 * Common Docs lifecycle enum (note: differs from OKF's suggested set). Derived
 * from the single-sourced core tuple, so `durable` (#39) is added in ONE place.
 */
export type DocStatus = (typeof STATUSES)[number];

/** A `related` entry: a bare slug or an object with an optional per-link note. */
export type RelatedRef = string | { ref: string; note?: string };

/** An `audience` entry: a reader profile slug + page-local guidance for them. */
export interface AudienceEntry {
  profile: string;
  guidance_text: string;
}

/** MoSCoW priority levels used by the optional `moscow` frontmatter note. */
export type MoscowLevel = 'Must' | 'Should' | 'Could' | "Won't";

/** An optional MoSCoW prioritisation note attached to a page. */
export interface MoscowNote {
  level: MoscowLevel;
  rationale: string;
}

/** An inline external reference — self-contained, no catalog lookup, no citation key. */
export interface InlineReference {
  url: string;
  title: string;
  note?: string;
}

/**
 * A catalog external reference: the frozen ADR-0009 `{ type, id }` form. `type`
 * here is the *catalog* discriminator (`biblio` | `tool`), deliberately distinct
 * from the frontmatter section `type` axis (ADR-0018).
 */
export interface CatalogReference {
  type: string;
  id: string;
}

/** An `external_references` entry: inline (self-contained) or catalog (`{type,id}`). */
export type ExternalReference = InlineReference | CatalogReference;

/** Kitty extension: fine control over the agent-API. */
export interface AgentHints {
  /** Include in llms.txt / agent index. Default true. */
  discoverable?: boolean;
  /** Relative importance to agents, 0..1. Default 0.5. */
  priority?: number;
  /** Extra retrieval keywords beyond `tags`. */
  keywords?: string[];
}

export interface GeneratedStamp {
  by: string;
  at: string;
}

export interface VerifiedStamp {
  by: string;
  at: string;
}

export interface SourceRef {
  resource: string;
  title: string;
}

/**
 * The Common Docs — Kitty Variation frontmatter, on top of Starlight's fields.
 * `title`, `description`, `doc_status`, `updated`, `type`, `kind` are the
 * convention's required fields (root `README.md` is exempt from `type` and
 * instead carries `okf_version`, but still carries `doc_status` and `kind`).
 */
export interface DocKittyFrontmatter {
  title: string;
  description?: string;
  doc_status?: DocStatus;
  /** Last meaningful change, ISO `YYYY-MM-DD` or a Date. */
  updated?: string | Date;
  type?: DocType;
  /** Page kind (open vocabulary, ADR-0009); drives per-kind layout. */
  kind?: string;
  /** Only on the bundle-root `docs/README.md`. */
  okf_version?: string;
  authors?: string[];
  related?: RelatedRef[];
  /** Reader profiles this page addresses, with page-local guidance (ADR-0009). */
  audience?: AudienceEntry[];
  /** External references: inline or catalog citations (ADR-0009 / ADR-0018). */
  external_references?: ExternalReference[];
  /** Optional MoSCoW prioritisation note. */
  moscow?: MoscowNote;
  tags?: string[];
  resource?: string;
  generated?: GeneratedStamp;
  verified?: VerifiedStamp[];
  sources?: SourceRef[];
  stale_after?: string | Date;
  /** Kitty extension. */
  agent?: AgentHints;
}

export const DEFAULT_AGENT_PRIORITY = 0.5;

/**
 * The canonical top-level sections, in progressive-disclosure order
 * (context → operations). Drives grouping in the agent index and llms.txt.
 */
export const SECTION_ORDER = [
  'context',
  'architecture',
  'adr',
  'plans',
  'api',
  'configuration',
  'integrations',
  'security',
  'guides',
  'operations',
  'migrations',
  'changelog',
  'presentations',
] as const;

export const SECTION_LABEL: Record<string, string> = {
  '': 'Overview',
  context: 'Context',
  architecture: 'Architecture',
  adr: 'Decision Records',
  plans: 'Plans',
  api: 'API',
  configuration: 'Configuration',
  integrations: 'Integrations',
  security: 'Security',
  guides: 'Guides',
  operations: 'Operations',
  migrations: 'Migrations',
  changelog: 'Changelog',
  presentations: 'Presentations',
};

// `SECTION_TYPE` (the frozen fallback `section → type` map) and `expectedDocType`
// (the pure section→type derivation, most-specific-first: registry subtypes →
// built-in sub-path table → section default) are single-sourced in
// `vocabulary-core.mjs` and re-exported above. Their behavior is unchanged
// (DISCIPLINED_REFACTORING): the twin that used to live here was byte-identical.

/**
 * One registry `subtypes` rule (E-02): a first-sub-path-segment → `type` mapping.
 * Structurally identical to the core's `SectionSubtypeRule` typedef; kept as a
 * named interface here because `sections.ts` imports it as a TS type from this
 * module (it is not a canonical single-source symbol).
 */
export interface SectionSubtypeRule {
  /** The first sub-path segment under the section folder, e.g. `"missions"`. */
  match: string;
  /** The `type` a page under that sub-path derives. */
  type: string;
}

/** The top-level section a slug belongs to ("" for the bundle root). */
export function sectionOf(slug: string): string {
  if (slug === '') return '';
  const first = slug.split('/')[0];
  return first ?? '';
}

/**
 * Sort key for a section: root first (-1), then position in the section order,
 * unknown last. PURE and parameterized (issue #18): `order` is the resolved list
 * of section ids in display order — pass `sectionOrder(registry)` (from
 * `./sections.ts`) to make the registry the authority. Omitted, it falls back to
 * the frozen `SECTION_ORDER` constant, so a docs root with no `sections.yaml`
 * still ranks (protecting the example/docs and any registry-free consumer). The
 * param is `readonly string[]` because a runtime-derived order has no `as const`
 * literal type.
 */
export function sectionRank(
  section: string,
  order: readonly string[] = SECTION_ORDER,
): number {
  if (section === '') return -1;
  const i = order.indexOf(section);
  return i === -1 ? order.length : i;
}

/**
 * Display label for a section. PURE and parameterized (issue #18): `labels` is the
 * resolved `id → label` map — pass `sectionLabels(registry)` (from `./sections.ts`)
 * to make the registry the authority (e.g. glossary → "Reference"). Omitted, it
 * falls back to the frozen `SECTION_LABEL` map. Returns `undefined` for an unknown
 * section so a caller keeps its own fallback (`?? section`, `?? 'Doc'`).
 */
export function sectionLabel(
  section: string,
  labels: Record<string, string> = SECTION_LABEL,
): string | undefined {
  return labels[section];
}

/** A page is published (crawlable / in sitemap) unless it is still a draft. */
export function isPublished(data: DocKittyFrontmatter): boolean {
  return (data.doc_status ?? 'draft') !== 'draft';
}

/** A published page is exposed to agents unless it opts out. */
export function isAgentDiscoverable(data: DocKittyFrontmatter): boolean {
  if (!isPublished(data)) return false;
  return data.agent?.discoverable !== false;
}

export function agentPriority(data: DocKittyFrontmatter): number {
  const p = data.agent?.priority ?? DEFAULT_AGENT_PRIORITY;
  return Math.min(1, Math.max(0, p));
}

/** Normalize `updated` to epoch millis for stable sorting (missing → 0). */
export function updatedMillis(data: DocKittyFrontmatter): number {
  if (!data.updated) return 0;
  const d = data.updated instanceof Date ? data.updated : new Date(data.updated);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** A minimal entry shape the helpers below operate on. */
export interface DocEntry {
  /** Route slug, e.g. "architecture/overview" or "" for the bundle root. */
  slug: string;
  data: DocKittyFrontmatter;
  /** Raw markdown body — carried only when a consumer opts in via
   * `collectDocEntries({ withBody: true })` (issue #90; Hub's ADR cards read it).
   * Absent for the default feed/agent/index callers. */
  body?: string;
}

/** The record shape emitted into the agent-API JSON index. */
export interface AgentRecord {
  slug: string;
  route: string;
  section: string;
  title: string;
  description: string;
  type: DocType | null;
  doc_status: DocStatus;
  kind: string;
  tags: string[];
  related: RelatedRef[];
  priority: number;
  updated: string | null;
  /** Link to the per-page JSON source for this page. */
  source: string;
}

/**
 * The BASE-LESS, canonical site route for a docs-collection slug. Deliberately
 * NOT base-prefixed here: the agent-API `route` field (`toAgentRecord`, below)
 * is a committed contract read by `assert-build-artifacts.mjs` (BA-3 deck-route-
 * parity) and `agent-api.test.ts` as the base-less canonical path — combining it
 * with the base is that consumer's own concern (`absolute(site, route)`, out of
 * this WP's owned surface). `resolveProfile` (Audience's href, #61/C-002) is the
 * on-page-navigation consumer, so IT routes through `withBase` at its own return
 * site instead — keeping this shared helper's base-less contract intact for the
 * agent-API while still fixing the actual reader-facing 404.
 */
function routeFor(slug: string): string {
  return slug === '' ? '/' : `/${slug}/`;
}

/** The per-page source id used in `/api/pages/<id>.json` (root → "home"). */
export function pageSourceId(slug: string): string {
  return slug === '' ? 'home' : slug;
}

/** Build the machine-readable record for a single page. */
export function toAgentRecord(entry: DocEntry): AgentRecord {
  const { slug, data } = entry;
  const updated = data.updated
    ? new Date(data.updated).toISOString().slice(0, 10)
    : null;
  return {
    slug,
    route: routeFor(slug),
    section: sectionOf(slug),
    title: data.title,
    description: data.description ?? '',
    type: data.type ?? null,
    doc_status: data.doc_status ?? 'draft',
    kind: data.kind ?? '',
    tags: data.tags ?? [],
    related: data.related ?? [],
    priority: agentPriority(data),
    updated,
    source: `/api/pages/${pageSourceId(slug)}.json`,
  };
}

/**
 * The default section-index basename (FR-002, C-001): `README.md` stays the
 * default so doc-kitty's own tree and an existing adopter are byte-identical
 * with no `indexBasename` configured (NFR-003).
 */
export const DEFAULT_INDEX_BASENAME = 'README';

/**
 * One or more section-index basenames (no extension), matched
 * case-insensitively against a file's leaf name. A single string or a set —
 * `['README', 'index']` lets one build collapse BOTH conventions at once
 * (data-model E-01, contract C-IB, anti-laziness M2). Omitted/default is the
 * single basename `"README"`.
 */
export type IndexBasenameOption = string | string[];

/** Options every index-detecting helper below shares. */
export interface IndexBasenameOptions {
  indexBasename?: IndexBasenameOption;
}

/** Normalize the option to a non-empty ordered list (config order = priority). */
function normalizeIndexBasenames(indexBasename?: IndexBasenameOption): string[] {
  const list =
    indexBasename === undefined
      ? [DEFAULT_INDEX_BASENAME]
      : Array.isArray(indexBasename)
        ? indexBasename
        : [indexBasename];
  return list.length > 0 ? list : [DEFAULT_INDEX_BASENAME];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A case-insensitive `(^|/)(basename1|basename2|…)$` matcher over the configured set. */
function indexBasenamePattern(basenames: string[]): RegExp {
  return new RegExp(`(^|/)(${basenames.map(escapeRegExp).join('|')})$`, 'i');
}

/**
 * Map a file path under the content root to its route slug, applying the
 * configurable index-basename rule (FR-001/FR-002, D-01). Case-insensitive.
 *
 * With the default (`indexBasename` omitted → `"README"` only):
 *   "README.md"              -> ""              (bundle root)
 *   "architecture/README.md" -> "architecture"
 *   "architecture/overview.md" -> "architecture/overview"
 *
 * With `indexBasename: ['README', 'index']`, `architecture/index.md` ALSO
 * collapses to `"architecture"`. A file whose basename is not in the
 * configured set is never collapsed — a stray `index.md` under the default
 * stays an ordinary page (NFR-003).
 *
 * This helper is sibling-unaware: when a directory holds MORE THAN ONE
 * configured-basename file (the collision case, E-05), use
 * {@link resolveIndexEntries} instead, which resolves the collision
 * deterministically across the whole file list.
 */
export function readmeToIndexId(entry: string, options: IndexBasenameOptions = {}): string {
  const withoutExt = entry.replace(/\.mdx?$/i, '');
  const pattern = indexBasenamePattern(normalizeIndexBasenames(options.indexBasename));
  const asIndex = withoutExt.replace(pattern, '$1');
  return asIndex.replace(/\/$/, '');
}

/** One resolved both-index collision (E-05): a directory with 2+ candidates. */
export interface IndexCollision {
  /** The directory the collision occurred in ('' for the bundle root). */
  dir: string;
  /** The path that won and became the section index. */
  winner: string;
  /** The rest — demoted to ordinary pages. */
  demoted: string[];
}

/** The result of a whole-tree, collision-aware index resolution. */
export interface ResolveIndexEntriesResult {
  /** Every input path mapped to its resolved route-slug id. */
  ids: Map<string, string>;
  /** Every directory where more than one configured basename was present. */
  collisions: IndexCollision[];
}

/**
 * Collision-aware, whole-tree twin of {@link readmeToIndexId} (E-05, FR-004).
 * Given every Markdown path under a content root, resolves each to its route
 * slug id, but when a directory contains MULTIPLE configured-basename
 * candidates (e.g. both `README.md` and `index.md`), the file matching the
 * EARLIEST-configured basename wins the section-index id; the rest are
 * demoted to ordinary pages (their id keeps the basename segment) and
 * reported in `collisions`, so the ambiguity is never silently resolved.
 *
 * Deterministic: a tie between same-rank basenames (e.g. case variants) is
 * broken by path sort order. Fs-free — the caller supplies the path list (a
 * directory walk), keeping this module Astro/fs-free.
 */
export function resolveIndexEntries(
  paths: readonly string[],
  options: IndexBasenameOptions = {},
): ResolveIndexEntriesResult {
  const basenames = normalizeIndexBasenames(options.indexBasename);
  const pattern = indexBasenamePattern(basenames);

  const byDir = new Map<string, string[]>();
  for (const p of paths) {
    const withoutExt = p.replace(/\.mdx?$/i, '');
    if (!pattern.test(withoutExt)) continue;
    const dir = withoutExt.replace(pattern, '$1').replace(/\/$/, '');
    const list = byDir.get(dir) ?? [];
    list.push(p);
    byDir.set(dir, list);
  }

  const rankOf = (file: string): number => {
    const base = file.replace(/\.mdx?$/i, '').split('/').pop() ?? '';
    const idx = basenames.findIndex((b) => b.toLowerCase() === base.toLowerCase());
    return idx === -1 ? basenames.length : idx;
  };

  const demoted = new Set<string>();
  const collisions: IndexCollision[] = [];
  for (const [dir, files] of byDir) {
    if (files.length <= 1) continue;
    const sorted = [...files].sort((a, b) => rankOf(a) - rankOf(b) || compareCodeUnit(a, b));
    const [winner, ...rest] = sorted;
    for (const loser of rest) demoted.add(loser);
    collisions.push({ dir, winner: winner!, demoted: rest });
  }

  const ids = new Map<string, string>();
  for (const p of paths) {
    ids.set(
      p,
      demoted.has(p) ? p.replace(/\.mdx?$/i, '') : readmeToIndexId(p, options),
    );
  }
  return { ids, collisions };
}

/**
 * Astro's content store requires a non-empty entry id, so the bundle root
 * (whose convention route slug is `""`) is stored under this reserved id —
 * which is also Starlight's own root id, keeping it served at `/`.
 */
export const ROOT_ENTRY_ID = 'index';

/** Map a stored Astro entry id back to the convention's route slug ("" for root). */
export function slugFromEntryId(id: string): string {
  return id === ROOT_ENTRY_ID ? '' : id;
}

/**
 * Discoverable entries, grouped nothing — sorted by section then priority then
 * title, with a code-unit slug tiebreak APPENDED for totality (#88/FR-002).
 * `order` (the resolved section-id order, from `sectionOrder(registry)`) makes the
 * registry the authority; omitted, it falls back to `SECTION_ORDER` (issue #18).
 *
 * INTRINSIC TOTALITY (#88): before this comparator relied on the caller passing a
 * pre-sorted collection plus a stable `Array#sort` to break ties on section +
 * priority + title. That is only POSITIONALLY deterministic — a consumer calling
 * the exported `rankForAgents` on its own (or a shuffled) array could get a
 * different order for entries tied on all three keys. The final
 * `compareCodeUnit(a.slug, b.slug)` makes the order a function of the inputs
 * alone (slugs are unique per entry, so it is total).
 *
 * BYTE-NEUTRAL (#88, C-001): the title compare is pinned to the `'en'` locale for
 * reproducibility, and the slug tiebreak is APPENDED after it — NOT substituted
 * for it. On the demonstrator no two docs pages share a title, so the slug
 * tiebreak never fires and the priority-0.5 `context` trio stays in title order
 * (Domain/Marzipan/Product); the built `api/index.json` / `llms.txt` are
 * unchanged. Replacing title with slug WOULD reorder that trio — do NOT.
 */
export function rankForAgents(
  entries: DocEntry[],
  order?: readonly string[],
): DocEntry[] {
  return entries
    .filter((e) => isAgentDiscoverable(e.data))
    .sort((a, b) => {
      const bySection =
        sectionRank(sectionOf(a.slug), order) - sectionRank(sectionOf(b.slug), order);
      if (bySection !== 0) return bySection;
      const byPriority = agentPriority(b.data) - agentPriority(a.data);
      if (byPriority !== 0) return byPriority;
      const byTitle = a.data.title.localeCompare(b.data.title, 'en');
      if (byTitle !== 0) return byTitle;
      return compareCodeUnit(a.slug, b.slug);
    });
}

/**
 * Order two route slugs deterministically, ascending — the slug-typed alias of
 * the shared {@link compareCodeUnit} (#85/#88, C-004).
 *
 * WHY code-unit and not `localeCompare` (#85/C-001): a UTF-16 code-unit
 * comparison (what JS relational operators do) is locale-INDEPENDENT by
 * construction, so CI, a contributor's machine and a container with a different
 * `LANG` all agree on the order. `localeCompare` without an explicit locale
 * reads the runtime default and can therefore rank the same two slugs
 * differently on two machines — the very class of nondeterminism this helper
 * exists to remove.
 *
 * WHY an alias and not a second body (#88/FR-004, C-004): `compareCodeUnit` in
 * the pure-ESM core (`vocabulary-core.mjs`, which this module already imports) is
 * now the ONE code-unit comparator. `compareSlug` re-exports it under the
 * slug-typed name #85 introduced, so the two can never drift.
 *
 * Slugs are unique per entry, so any comparator that falls through to this one
 * is TOTAL: for two distinct entries it never returns 0 (contract:
 * `kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md`).
 * Shared by {@link rankForFeed} and {@link sortBySlug} so the feed order and
 * the collected-entry order can never drift apart.
 */
export const compareSlug: (a: string, b: string) => number = compareCodeUnit;

/**
 * Copy of `entries` ordered by ascending slug: the stable baseline
 * `collectDocEntries` applies to the whole collection before any consumer sees
 * it (contract: `kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md`).
 * Non-mutating, and Astro-free HERE so the ordering contract is unit-testable
 * without mocking `astro:content`.
 */
export function sortBySlug(entries: DocEntry[]): DocEntry[] {
  return [...entries].sort((a, b) => compareSlug(a.slug, b.slug));
}

/**
 * Published entries for feeds. ORDER: `updated` descending (most recent first),
 * then slug ascending.
 *
 * WHY the slug tiebreak (#85): the primary key alone is NOT a total comparator —
 * most pages share an `updated` date (22 of 26 feed items in the demonstrator),
 * and `Array#sort` is stable, so tied items kept their INPUT order. That input
 * is `getCollection('docs')`, whose store Astro's glob loader fills in the
 * completion order of a concurrent read+render pool — i.e. build-timing noise.
 * Two clean builds of an unchanged tree therefore emitted different `rss.xml`
 * bytes. Breaking ties on the unique slug makes the comparator total, so the
 * feed order is a function of the content alone and byte-oracles on the built
 * corpus are trustworthy. Entries without `updated` sort last (millis 0) and
 * among themselves by slug.
 */
export function rankForFeed(entries: DocEntry[]): DocEntry[] {
  return entries
    .filter((e) => isPublished(e.data))
    .sort((a, b) => {
      const byUpdated = updatedMillis(b.data) - updatedMillis(a.data);
      if (byUpdated !== 0) return byUpdated;
      return compareSlug(a.slug, b.slug);
    });
}

/**
 * RSS-only inclusion predicate (FR-011): a `kind: Presentation` deck is
 * published on every surface (sitemap, llms.txt, agent API, Pagefind) EXCEPT
 * the RSS feed. This is a standalone predicate the `rss.ts` route body applies;
 * it deliberately does NOT touch {@link rankForFeed}, which must keep identical
 * behaviour for the other feed surfaces (RT-07). Keyed on the frontmatter
 * `kind`, never the section path, so a deck filed anywhere is still excluded.
 */
export function includedInRssFeed(entry: DocEntry): boolean {
  return !isPresentationEntry(entry);
}

// ---------------------------------------------------------------------------
// Resolution core (Astro-free)
//
// Pure resolvers for `related`, `audience` profiles, and `external_references`.
// The build-free doc-sanity gates parity-duplicate these (WP02/WP03), so
// NOTHING here may import Astro. The miss posture is asymmetric by design (spec
// Assumptions): a dangling `related` ref or an unresolvable citation is
// build-fatal (throws); a missing audience profile is soft (returns null, the
// caller renders the humanized slug and warns).
// ---------------------------------------------------------------------------

/** A single target in the docs index the resolvers look references up in. */
export interface DocIndexEntry {
  slug: string;
  title: string;
  kind: string;
  doc_status: DocStatus;
  description?: string;
}

/** The docs index: resolution targets keyed by route slug. */
export type DocsIndex = Record<string, DocIndexEntry>;

/**
 * A resolved related reference, as consumed by the agent surface (WP05) and the
 * related-links block. Exported so a caller can type its enriched record against
 * a shared type rather than an inline cast.
 */
export interface ResolvedRelated {
  ref: string;
  title: string;
  kind: string;
  doc_status: DocStatus;
}

/** A resolved related reference plus its card text (`note`-else-`description`). */
export interface ResolvedRelatedCard extends ResolvedRelated {
  note?: string;
}

/**
 * Resolve a single `related` entry against the docs index.
 *
 * Precedence: the card text (`note`) is the entry's own `note` when present,
 * else the target page's `description`. A miss is build-fatal (FR-004): a
 * dangling reference must never be silently dropped.
 */
export function resolveRelated(ref: RelatedRef, index: DocsIndex): ResolvedRelatedCard {
  const slug = typeof ref === 'string' ? ref : ref.ref;
  const entryNote = typeof ref === 'string' ? undefined : ref.note;
  const target = index[slug];
  if (!target) {
    throw new Error(
      `resolveRelated: dangling related reference "${slug}" — no page with that slug in the docs index (build-fatal, FR-004).`,
    );
  }
  const card: ResolvedRelatedCard = {
    ref: slug,
    title: target.title,
    kind: target.kind,
    doc_status: target.doc_status,
  };
  const note = entryNote ?? target.description;
  if (note !== undefined) card.note = note;
  return card;
}

/** A resolved audience-profile link. */
export interface ResolvedProfile {
  href: string;
  title: string;
}

/** Humanize a profile slug for display: `"backend-dev"` → `"Backend Dev"`. */
export function humanizeProfile(slug: string): string {
  return slug
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve an audience `profile` slug to its persona page under
 * `context/audience/<profile>`. A miss is SOFT: returns `null` so the caller can
 * render the humanized slug and warn (the warn channel lands in WP04).
 *
 * `href` is base-prefixed via `withBase` (#61, C-002) — this is an actual
 * reader-facing on-page link (Audience.astro renders it verbatim), unlike
 * `routeFor`'s base-less agent-API contract.
 */
export function resolveProfile(profile: string, index: DocsIndex): ResolvedProfile | null {
  const slug = `context/audience/${profile}`;
  const target = index[slug];
  if (!target) return null;
  return { href: withBase(routeFor(slug)), title: target.title };
}

/** A bibliography catalog record (CSL-JSON-lite, ADR-0018). */
export interface BibliographyRecord {
  id: string;
  type?: string;
  title: string;
  authors?: string[];
  container?: string;
  url: string;
  issued?: string;
  accessed?: string;
  note?: string;
}

/** A tools catalog record (ADR-0018). */
export interface ToolRecord {
  id: string;
  name: string;
  url: string;
  note?: string;
}

/** The loaded citation catalog: records keyed by their stable catalog id. */
export interface CitationCatalog {
  bibliography: Record<string, BibliographyRecord>;
  tools: Record<string, ToolRecord>;
}

/** A resolved citation row: an inline reference, a biblio record, or a tool record. */
export type ResolvedCitation = InlineReference | BibliographyRecord | ToolRecord;

/**
 * Resolve an `external_references` entry against the loaded catalog.
 *
 * An inline `{ url, title, note? }` is self-contained and passes through
 * unchanged. A catalog `{ type, id }` selects a collection by its *catalog*
 * `type`: `biblio` → `bibliography[id]`, `tool` → `tools[id]`. A missing id or
 * an unknown catalog `type` is build-fatal (FR-008).
 */
export function resolveCitation(
  extRef: ExternalReference,
  catalog: CitationCatalog,
): ResolvedCitation {
  // Inline references carry their own url + title — no catalog lookup.
  if ('url' in extRef) {
    return extRef;
  }
  const { type: catalogType, id } = extRef;
  if (catalogType === 'biblio') {
    const record = catalog.bibliography[id];
    if (!record) {
      throw new Error(
        `resolveCitation: no bibliography entry for id "${id}" (build-fatal, FR-008).`,
      );
    }
    return record;
  }
  if (catalogType === 'tool') {
    const record = catalog.tools[id];
    if (!record) {
      throw new Error(`resolveCitation: no tool entry for id "${id}" (build-fatal, FR-008).`);
    }
    return record;
  }
  throw new Error(
    `resolveCitation: unknown catalog type "${catalogType}" (expected "biblio" or "tool") (build-fatal, FR-008).`,
  );
}
