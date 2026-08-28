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

/** OKF `type` — the one required-by-OKF field. One value per Common Docs section. */
export type DocType =
  | 'Context'
  | 'Architecture'
  | 'ADR'
  | 'Template'
  | 'Plan'
  | 'Epic'
  | 'Feature'
  | 'API'
  | 'Configuration'
  | 'Integration'
  | 'Security'
  | 'Guide'
  | 'Operations'
  | 'Runbook'
  | 'Migration'
  | 'Changelog'
  | 'Presentation';

/** Common Docs lifecycle enum (note: differs from OKF's suggested set). */
export type DocStatus = 'draft' | 'active' | 'deprecated' | 'superseded';

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

/**
 * Frozen fallback `section → type` map: the section-default `type` for each
 * canonical section, used when no `sections.yaml` registry is present (a
 * registry-less docs tree still derives an expected `type`). MIRRORS the section
 * defaults the registry now carries; when a registry IS present, its
 * `sectionTypes(registry)` map is the authority and this is not consulted (issue
 * #24). Sub-path subtypes (ADR template, plan epics/features, ops runbooks) are
 * NOT in this map — they are applied on top by {@link expectedDocType}.
 */
export const SECTION_TYPE: Record<string, string> = {
  context: 'Context',
  architecture: 'Architecture',
  adr: 'ADR',
  plans: 'Plan',
  api: 'API',
  configuration: 'Configuration',
  integrations: 'Integration',
  security: 'Security',
  guides: 'Guide',
  operations: 'Operations',
  migrations: 'Migration',
  changelog: 'Changelog',
  presentations: 'Presentation',
};

/**
 * The expected frontmatter `type` for a page path (null = no expectation).
 *
 * PURE and parameterized (issue #24): `typesBySection` is the resolved
 * `id → type` map — pass `sectionTypes(registry)` (from `./sections.ts`) to make
 * the registry the section-default authority; omitted, it falls back to the
 * frozen {@link SECTION_TYPE}, so a docs root with no `sections.yaml` still
 * derives an expectation. Never imports `./sections.ts`, so this module stays
 * fs-free and Astro-free.
 *
 * Derivation is two steps, most specific last:
 *   1. the section (first path segment) default from `typesBySection`;
 *   2. a short, stable table of SUB-PATH subtypes applied on top, kept in code
 *      (an ADR `template.md` → `Template`; `plans/epics/*` → `Epic`,
 *      `plans/features/*` → `Feature`; `operations/runbooks/*` → `Runbook`).
 * Moving the sub-path table into a registry `subtypes` field is a separate,
 * deferred ADR item. An unknown section yields `null` (no section default, no
 * override) — the caller treats a null expectation as "no check".
 */
export function expectedDocType(
  relPath: string,
  typesBySection: Record<string, string> = SECTION_TYPE,
): string | null {
  const parts = relPath.split('/');
  const section = parts[0] ?? '';
  const file = parts[parts.length - 1] ?? '';
  const sectionDefault = typesBySection[section] ?? null;
  switch (section) {
    case 'adr':
      return file === 'template.md' ? 'Template' : sectionDefault;
    case 'plans':
      if (parts[1] === 'epics') return 'Epic';
      if (parts[1] === 'features') return 'Feature';
      return sectionDefault;
    case 'operations':
      return parts[1] === 'runbooks' ? 'Runbook' : sectionDefault;
    default:
      return sectionDefault;
  }
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
 * Map a file path under the content root to its route slug, applying the
 * README-as-index rule.
 *
 *   "README.md"              -> ""              (bundle root)
 *   "architecture/README.md" -> "architecture"
 *   "architecture/overview.md" -> "architecture/overview"
 */
export function readmeToIndexId(entry: string): string {
  const withoutExt = entry.replace(/\.mdx?$/i, '');
  const asIndex = withoutExt.replace(/(^|\/)README$/i, '$1');
  return asIndex.replace(/\/$/, '');
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
 * Discoverable entries, grouped nothing — sorted by section then priority.
 * `order` (the resolved section-id order, from `sectionOrder(registry)`) makes the
 * registry the authority; omitted, it falls back to `SECTION_ORDER` (issue #18).
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
      return a.data.title.localeCompare(b.data.title);
    });
}

/** Published entries, most-recently-updated first, for feeds. */
export function rankForFeed(entries: DocEntry[]): DocEntry[] {
  return entries
    .filter((e) => isPublished(e.data))
    .sort((a, b) => updatedMillis(b.data) - updatedMillis(a.data));
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
  return entry.data.kind !== 'Presentation';
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
 */
export function resolveProfile(profile: string, index: DocsIndex): ResolvedProfile | null {
  const slug = `context/audience/${profile}`;
  const target = index[slug];
  if (!target) return null;
  return { href: routeFor(slug), title: target.title };
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
