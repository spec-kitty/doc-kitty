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
  | 'Changelog';

/** Common Docs lifecycle enum (note: differs from OKF's suggested set). */
export type DocStatus = 'draft' | 'active' | 'deprecated' | 'superseded';

/** A `related` entry: a bare slug or an object with an optional per-link note. */
export type RelatedRef = string | { ref: string; note?: string };

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
};

/** The top-level section a slug belongs to ("" for the bundle root). */
export function sectionOf(slug: string): string {
  if (slug === '') return '';
  const first = slug.split('/')[0];
  return first ?? '';
}

/** Sort key for a section, honoring SECTION_ORDER (root first, unknown last). */
export function sectionRank(section: string): number {
  if (section === '') return -1;
  const i = SECTION_ORDER.indexOf(section as (typeof SECTION_ORDER)[number]);
  return i === -1 ? SECTION_ORDER.length : i;
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

/** Discoverable entries, grouped nothing — sorted by section then priority. */
export function rankForAgents(entries: DocEntry[]): DocEntry[] {
  return entries
    .filter((e) => isAgentDiscoverable(e.data))
    .sort((a, b) => {
      const bySection = sectionRank(sectionOf(a.slug)) - sectionRank(sectionOf(b.slug));
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
