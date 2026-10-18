/**
 * The docs collection adapter + index builder — the neutral owner of the
 * `docs`-collection derivation shared by BOTH the route handlers
 * (`routes/rss|llms-txt|agent-index|agent-page`) AND the slot components
 * (`components/slots/Audience|Related|OnThisPage`, `layouts/Hub`). It lived in
 * `routes/shared.ts` (whose remit is route plumbing — the docs-root resolver and
 * the feed URL/XML helpers), but after #88 the components import it too, so the
 * derivation earned its own module rather than reaching into route plumbing
 * (issue #90). It statically imports `astro:content`, so it is not `astro.config`
 * safe — that is unchanged from its previous home.
 */
import { getCollection } from 'astro:content';
import type {
  BibliographyRecord,
  CitationCatalog,
  DocEntry,
  DocKittyFrontmatter,
  DocsIndex,
  IndexBasenameOption,
  ToolRecord,
} from './metadata.js';
import { buildCatalog } from './catalog.js';
import {
  resolveCitation,
  resolveProfile,
  resolveRelated,
  sectionOf,
  slugFromEntryId,
  sortBySlug,
} from './metadata.js';
import {
  OKF_VERSION,
  buildRouteTable,
  compareCodeUnit,
  formatInstant,
  normaliseInstant,
  okfStatusOf,
  resolveIndexEntries,
  routeOfSlug,
  toActor,
} from './vocabulary-core.mjs';

/**
 * Load every docs entry as a `DocEntry`. With the README-as-index loader, an
 * entry's `id` is already the route slug ("" for the root, "how-to/pages", …).
 *
 * ORDER: slug ascending, regardless of the collection's own order (#85; contract:
 * `kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md`). The
 * content store is filled in the completion order of Astro's concurrent glob
 * loader, so its insertion order is build-timing noise; sorting here makes every
 * downstream surface order-stable BY CONSTRUCTION rather than one comparator at
 * a time. Consumers may treat this as a stable baseline but MUST still sort by
 * their own total key when they need a different order.
 *
 * `withBody` (#90) is opt-in: the feed/agent/index consumers never read a page's
 * body, so by default it is omitted (the returned shape is exactly `{slug,data}`,
 * byte-identical to every pre-#90 caller). `Hub.astro`'s ADR cards DO read the
 * raw markdown body, so it passes `{ withBody: true }` to get `body` carried on
 * each entry — the one field it previously mapped inline.
 */
export async function collectDocEntries(
  opts: { withBody?: boolean } = {},
): Promise<DocEntry[]> {
  const entries = await getCollection('docs');
  // `entry` is a `CollectionEntry<'docs'>`, but `astro:content` does not resolve
  // under bare `tsc` (CI's astro-aware typecheck sees the real type); annotate a
  // minimal structural shape so this split module adds no implicit-`any` beyond
  // the pre-#90 baseline.
  return sortBySlug(
    (entries as ReadonlyArray<{ id: string; data: unknown; body?: string }>).map((entry) => ({
      slug: slugFromEntryId(entry.id),
      data: entry.data as unknown as DocKittyFrontmatter,
      ...(opts.withBody ? { body: entry.body ?? '' } : {}),
    })),
  );
}

/**
 * Load the citation catalog (`bibliography` + `tools` collections) the External-references
 * block resolves against. Same structural-cast posture as {@link collectDocEntries}.
 */
export async function collectCitationCatalog(): Promise<CitationCatalog> {
  const records = async <T>(name: 'bibliography' | 'tools'): Promise<T[]> =>
    ((await getCollection(name)) as ReadonlyArray<{ data: unknown }>).map((e) => e.data as T);
  return buildCatalog(await records<BibliographyRecord>('bibliography'), await records<ToolRecord>('tools'));
}

/**
 * Flatten `DocEntry`s into the `DocsIndex` shape the resolvers consume: a map
 * keyed by route slug whose values are `{ slug, title, kind, doc_status,
 * description }`. Built from the FULL collection (not the discoverable subset)
 * so a `related` ref to a non-discoverable page still resolves — a dangling ref
 * is build-fatal by design (FR-004), never silently dropped.
 */
export function buildDocsIndex(entries: DocEntry[]): DocsIndex {
  const index: DocsIndex = {};
  for (const { slug, data } of entries) {
    index[slug] = {
      slug,
      title: data.title,
      kind: data.kind ?? '',
      doc_status: data.doc_status ?? 'draft',
      ...(data.description !== undefined ? { description: data.description } : {}),
    };
  }
  return index;
}

// ---------------------------------------------------------------------------
// The content graph (#176, FR-010..FR-013). One pure builder: the route reads the
// collections and the docs tree, this folds them into nodes and edges. Relations
// come from the SAME resolvers the Related / Audience / External-references blocks
// call (C-010), frontmatter only (C-002) -- no body links, no glossary autolinks.
// ---------------------------------------------------------------------------

/** The `schema` value of `api/content-graph.json`; bump on a breaking shape change. */
export const CONTENT_GRAPH_SCHEMA = 'dockitty.content-graph/1';

export type GraphRel = 'related' | 'audience' | 'cites' | 'in-section' | 'derived-from';

/** A `{by, at}` stamp as the graph writes it (`at` is a UTC instant). */
export interface GraphStamp {
  by: string;
  at: string;
  content_hash?: string;
}

/** A graph node. Optional fields are omitted when absent; keys are written in this order. */
export interface GraphNode {
  id: string;
  kind: 'page' | 'persona' | 'catalog' | 'resource';
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  status?: 'draft' | 'stable' | 'deprecated';
  generated?: GraphStamp;
  verified?: GraphStamp[];
  stale_after?: string;
  sources?: Array<{ resource: string; title: string }>;
  doc_status?: string;
  doc_kind?: string;
  section?: string;
  href?: string;
  url?: string;
  authors?: string[];
  updated?: string;
}

/** A graph edge. `id` is `source|rel|target`. */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  rel: GraphRel;
  note?: string;
}

export interface ContentGraph {
  schema: typeof CONTENT_GRAPH_SCHEMA;
  okf_version: string;
  generatedFrom: 'doc-kitty';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Where one page lives: its bundle id, its route (no base), and whether it is a section index. */
export interface PageLocation {
  /** Bundle path without the extension (`guides/README`); the node id. */
  id: string;
  /** Root-absolute route from the shared route table (`/guides/`). */
  route: string;
  index: boolean;
}

export interface ContentGraphContext {
  /** Route slug -> location, from {@link locatePages}. */
  locations: Readonly<Record<string, PageLocation>>;
  /** Draft routes from `draftRoutesOf`: read off disk, so independent of `DK_PUBLISH_DRAFTS`. */
  draftRoutes: ReadonlySet<string>;
  catalog: CitationCatalog;
}

/**
 * Locate every page of a docs tree from the shared walk: slug -> {bundle id, route,
 * index}. The slugs and routes are the loader's and the route table's own
 * (`resolveIndexEntries`, `buildRouteTable`), so a section README is found under its
 * collapsed slug while its id stays the file's bundle path.
 */
export function locatePages(
  paths: readonly string[],
  indexBasename?: IndexBasenameOption,
): Record<string, PageLocation> {
  const { ids } = resolveIndexEntries(paths, { indexBasename });
  const { routes } = buildRouteTable(paths, { indexBasename });
  const out: Record<string, PageLocation> = {};
  for (const file of [...paths].sort(compareCodeUnit)) {
    const slug = ids.get(file) as string;
    const id = file.replace(/\.mdx?$/i, '');
    out[slug] = { id, route: routes[file] as string, index: id !== slug };
  }
  return out;
}

type Sink = {
  node: (n: GraphNode) => void;
  edge: (source: string, rel: GraphRel, target: string, note?: string) => void;
};

interface GraphScope {
  index: DocsIndex;
  catalog: CitationCatalog;
  locate: (slug: string) => PageLocation;
  /** Bundle ids of every page (drafts included), for `sources` that name a page. */
  pageIds: ReadonlySet<string>;
  /** Slugs of the published section indexes. */
  publishedIndexes: ReadonlySet<string>;
}

const compact = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const instantOf = (v: unknown): string | undefined => {
  const parsed = normaliseInstant(v);
  return parsed ? formatInstant(parsed.date) : undefined;
};

const stampOf = (v: unknown): GraphStamp | undefined => {
  const s = v as { by?: unknown; at?: unknown; content_hash?: unknown } | null;
  const at = instantOf(s?.at);
  const by = toActor(s?.by);
  if (!s || by === null || at === undefined) return undefined;
  return compact({
    by,
    at,
    content_hash: typeof s.content_hash === 'string' ? s.content_hash : undefined,
  });
};

/** `verified` is a list or one bare mapping; the graph always writes a list. */
const verifiedOf = (v: unknown): GraphStamp[] | undefined => {
  if (v === undefined || v === null) return undefined;
  const stamps = (Array.isArray(v) ? v : [v]).flatMap((s) => stampOf(s) ?? []);
  return stamps.length > 0 ? stamps : undefined;
};

const authorsOf = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const actors = v.flatMap((a) => toActor(a) ?? []);
  return actors.length > 0 ? actors : undefined;
};

function pageNode({ slug, data }: DocEntry, loc: PageLocation): GraphNode {
  const persona = !loc.index && slug.startsWith('context/audience/');
  return compact({
    id: loc.id,
    kind: persona ? ('persona' as const) : ('page' as const),
    type: data.type,
    title: data.title,
    description: data.description,
    resource: data.resource,
    tags: data.tags,
    status: okfStatusOf(data.doc_status),
    generated: stampOf(data.generated),
    verified: verifiedOf(data.verified),
    stale_after: instantOf(data.stale_after),
    sources: data.sources,
    doc_status: data.doc_status,
    doc_kind: data.kind,
    section: sectionOf(slug),
    href: loc.route,
    authors: authorsOf(data.authors),
    updated: instantOf(data.updated),
  });
}

function relatedEdges({ slug, data }: DocEntry, g: GraphScope, sink: Sink): void {
  for (const ref of data.related ?? []) {
    const card = resolveRelated(ref, g.index);
    sink.edge(g.locate(slug).id, 'related', g.locate(card.ref).id, typeof ref === 'string' ? undefined : ref.note);
  }
}

function audienceEdges({ slug, data }: DocEntry, g: GraphScope, sink: Sink): void {
  for (const entry of data.audience ?? []) {
    if (!resolveProfile(entry.profile, g.index)) continue; // soft miss, like the block
    const persona = g.locate(`context/audience/${entry.profile}`).id;
    sink.edge(g.locate(slug).id, 'audience', persona, entry.guidance_text || undefined);
  }
}

function citeEdges({ slug, data }: DocEntry, g: GraphScope, sink: Sink): void {
  for (const ref of data.external_references ?? []) {
    const resolved = resolveCitation(ref, g.catalog);
    const source = g.locate(slug).id;
    if ('url' in ref) {
      const node: GraphNode = { id: `resource:${ref.url}`, kind: 'resource', title: ref.title, url: ref.url };
      sink.node(node);
      sink.edge(source, 'cites', node.id, ref.note);
      continue;
    }
    const title = 'name' in resolved ? resolved.name : resolved.title;
    const node: GraphNode = { id: `catalog:${ref.type}:${ref.id}`, kind: 'catalog', title, url: resolved.url };
    sink.node(node);
    sink.edge(source, 'cites', node.id);
  }
}

/** The nearest published section index above `slug`, falling back to the bundle root. */
function sectionEdge({ slug }: DocEntry, g: GraphScope, sink: Sink): void {
  if (slug === '') return;
  const parts = slug.split('/');
  for (let n = parts.length - 1; n >= 0; n -= 1) {
    const candidate = parts.slice(0, n).join('/');
    if (g.publishedIndexes.has(candidate)) {
      sink.edge(g.locate(slug).id, 'in-section', g.locate(candidate).id);
      return;
    }
  }
}

function derivedEdges({ slug, data }: DocEntry, g: GraphScope, sink: Sink): void {
  for (const src of data.sources ?? []) {
    const asId = src.resource.replace(/^\/+/, '').replace(/\.mdx?$/i, '');
    const target = g.pageIds.has(asId) ? asId : `resource:${src.resource}`;
    if (target !== asId) sink.node({ id: target, kind: 'resource', title: src.title, resource: src.resource });
    sink.edge(g.locate(slug).id, 'derived-from', target);
  }
}

const compareEdges = (a: GraphEdge, b: GraphEdge): number =>
  compareCodeUnit(a.source, b.source) || compareCodeUnit(a.rel, b.rel) || compareCodeUnit(a.target, b.target);

/**
 * Fold the docs entries into the content graph. Pure and order-independent
 * (NFR-001, C-011): nodes sort by `id`, edges by `(source, rel, target)`, both by
 * code unit, and an edge's id is `source|rel|target`. Draft pages (their route is in
 * `draftRoutes`) and every edge that would touch one are left out. Resolution runs
 * over the FULL corpus, so a dangling `related` stays build-fatal as in the block.
 */
export function buildContentGraph(entries: readonly DocEntry[], ctx: ContentGraphContext): ContentGraph {
  const locate = (slug: string): PageLocation =>
    ctx.locations[slug] ?? { id: slug === '' ? 'README' : slug, route: routeOfSlug(slug), index: slug === '' };
  const published = entries.filter((e) => !ctx.draftRoutes.has(locate(e.slug).route));
  const scope: GraphScope = {
    index: buildDocsIndex([...entries]),
    catalog: ctx.catalog,
    locate,
    pageIds: new Set(entries.map((e) => locate(e.slug).id)),
    publishedIndexes: new Set(published.filter((e) => locate(e.slug).index).map((e) => e.slug)),
  };
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const sink: Sink = {
    node: (n) => void (nodes.has(n.id) || nodes.set(n.id, n)),
    edge: (source, rel, target, note) => {
      const id = `${source}|${rel}|${target}`;
      if (!edges.has(id)) edges.set(id, compact({ id, source, target, rel, note: note || undefined }));
    },
  };
  for (const entry of published) sink.node(pageNode(entry, locate(entry.slug)));
  for (const entry of published) {
    for (const emit of [relatedEdges, audienceEdges, citeEdges, sectionEdge, derivedEdges]) emit(entry, scope, sink);
  }
  return {
    schema: CONTENT_GRAPH_SCHEMA,
    okf_version: OKF_VERSION,
    generatedFrom: 'doc-kitty',
    nodes: [...nodes.values()].sort((a, b) => compareCodeUnit(a.id, b.id)),
    // An edge into a draft (or any id that is not a node) is dropped here.
    edges: [...edges.values()].filter((e) => nodes.has(e.source) && nodes.has(e.target)).sort(compareEdges),
  };
}
