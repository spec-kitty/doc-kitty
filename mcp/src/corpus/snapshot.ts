/**
 * The launch-time corpus snapshot (FR-006): every artifact of one corpus
 * build, loaded once, held immutable for the process lifetime (research.md
 * R2 - snapshot-at-start is load-bearing). This module is where contract
 * interpretation happens:
 *
 *   - version handshake (FR-005): the index `version` string's major must be
 *     in SUPPORTED_CONTRACT_MAJORS; an unknown or non-numeric major is
 *     UNKNOWN_CONTRACT_MAJOR and the server never becomes ready (NFR-005);
 *   - buildId compare-all (FR-008): every artifact that carries a `buildId`
 *     must equal the index's; divergence is BUILD_IDENTITY_MISMATCH. A corpus
 *     with no buildId anywhere (predates FR-008) loads with a warning instead
 *     - the migration allowance from contracts/mcp-surface.md;
 *   - pages-gating detection (pinned): the pages surface is gated off when
 *     index records lack `_links.self`; identity and fetch use the records'
 *     `_links.self.href` verbatim when present, and `source` is never fetched
 *     (emitted unconditionally, dangles in gated mode). A gated snapshot loads
 *     degraded and is marked, so the surface layer can announce
 *     PAGES_LINKS_GATED through capabilities;
 *   - sections tolerance: pre-WP01 corpora carry no `sections[]` (loads with
 *     an empty listing), and the legacy home-record empty `section` value
 *     maps to the site root section (synthesized, id '').
 *
 * Transport lives in the adapters; shape guards live in source.ts.
 */
import type { AgentIndex, AgentPagePayload, ScenarioIndex } from '@spec-kitty/doc-toolkit/contract';
import {
  BuildIdentityMismatchError,
  MalformedCorpusError,
  UnknownContractMajorError,
} from '../errors.js';
import {
  assertIndexShape,
  assertPageShape,
  assertScenariosShape,
  pageIdFromArtifactRef,
  parseArtifact,
} from './source.js';
import type { CorpusSource, LoadLogger, PageArtifactRef } from './source.js';

/** Contract majors this server speaks (today: "3"). */
const SUPPORTED_CONTRACT_MAJORS: ReadonlySet<string> = new Set(['3']);

/** Per-page artifact URLs live under this pathname segment on both adapters. */
const PAGES_PREFIX = 'api/pages/';

export interface Section {
  id: string;
  label: string;
  order: number;
  purpose?: string;
}

/**
 * One page of the snapshot. The small projected fields (id, section, title,
 * description, keywords, links, markdown, docStatus) are what the tools read;
 * `record`, `artifact` and `raw` keep the full parse and the raw artifact
 * text so the resource surface (WP04) and the conformance suite (WP05,
 * FR-010) can byte-derive without re-fetching.
 */
export interface SnapshotPage {
  /** Pinned derivation: artifact path relative to api/pages/ minus .json. */
  id: string;
  /** The index record's `_links.self.href`, verbatim - never slug arithmetic. */
  ref: string;
  section: string;
  title: string;
  description: string;
  keywords: string[];
  links: AgentIndex['pages'][number]['_links'];
  markdown: string;
  docStatus: string;
  record: AgentIndex['pages'][number];
  artifact: AgentPagePayload;
  raw: string;
}

export interface CorpusSnapshot {
  siteTitle: string;
  /** Launch-config identity of the source (site base URL or local dir). */
  baseUrl: string;
  contractVersion: string;
  /** The corpus build identity; undefined only on legacy pre-FR-008 corpora. */
  buildId?: string;
  sections: Section[];
  pages: SnapshotPage[];
  scenarios?: { artifact: ScenarioIndex; raw: string };
  /** True when the index gates per-page artifacts off (no `_links.self`). */
  pagesGated: boolean;
  /** Informational load timestamp (excluded from byte-derivation checks). */
  loadedAt: string;
}

export interface LoadSnapshotOptions {
  logger?: LoadLogger;
}

export async function loadSnapshot(source: CorpusSource, options: LoadSnapshotOptions = {}): Promise<CorpusSnapshot> {
  const log = options.logger;
  const started = Date.now();

  const index = loadIndex(await source.loadIndex(log));
  handshakeContractMajor(index.version);

  // Gating detection (pinned): records without `_links.self` promise no page
  // artifact. Present refs are fetched verbatim; absent ones degrade the load.
  const fetchList: Array<{ ref: PageArtifactRef; record: AgentIndex['pages'][number] }> = [];
  for (const record of index.pages) {
    const href = record._links.self?.href;
    if (href === undefined) continue;
    fetchList.push({ ref: { id: pageIdFromArtifactRef(href), href }, record });
  }
  const pagesGated = fetchList.length < index.pages.length;
  if (pagesGated) {
    log?.({
      phase: 'snapshot',
      event: 'warning',
      message: `pages links gated: ${index.pages.length - fetchList.length} of ${index.pages.length} records carry no _links.self - loading degraded (PAGES_LINKS_GATED)`,
    });
  }

  const refs = fetchList.map((entry) => entry.ref);
  const rawPages = refs.length > 0 ? await source.loadPages(refs, log) : new Map<string, string>();
  const scenariosRef = index._links.scenarios?.href;
  const rawScenarios = scenariosRef === undefined ? undefined : await source.loadScenarios(scenariosRef, log);

  const pages: SnapshotPage[] = [];
  const seenIds = new Set<string>();
  for (const { ref, record } of fetchList) {
    const artifactPath = `${PAGES_PREFIX}${ref.id}.json`;
    const raw = rawPages.get(ref.id)!;
    const artifact = guardPage(parseArtifact(raw, artifactPath), artifactPath);
    if (!seenIds.add(ref.id)) {
      throw new MalformedCorpusError(`api/index.json: two records resolve to page id '${ref.id}'`);
    }
    pages.push(projectPage(record, artifact, raw, ref));
  }

  const scenarios =
    rawScenarios === undefined
      ? undefined
      : { artifact: guardScenarios(parseArtifact(rawScenarios, 'api/scenarios.json'), 'api/scenarios.json'), raw: rawScenarios };

  const buildId = compareBuildIdentity(index, pages, scenarios?.artifact, log);
  const sections = resolveSections(index, log);

  const snapshot: CorpusSnapshot = {
    siteTitle: index.title,
    baseUrl: source.base,
    contractVersion: index.version,
    ...(buildId === undefined ? {} : { buildId }),
    sections,
    pages,
    ...(scenarios === undefined ? {} : { scenarios }),
    pagesGated,
    loadedAt: new Date().toISOString(),
  };
  log?.({
    phase: 'snapshot',
    event: 'end',
    ms: Date.now() - started,
    message: `${pages.length} pages, ${sections.length} sections, scenarios surface ${scenarios === undefined ? 'absent' : 'loaded'}${pagesGated ? ' (pages gated)' : ''}`,
  });
  return snapshot;
}

/** Parse + guard the index artifact. */
function loadIndex(rawIndex: string): AgentIndex {
  const index = parseArtifact(rawIndex, 'api/index.json');
  assertIndexShape(index);
  return index;
}

/**
 * FR-005 handshake: branch on the version STRING's major. '3', '3.1' -> major
 * '3'. Empty, non-numeric ('beta') or an unknown major all fail closed.
 */
function handshakeContractMajor(version: string): void {
  const major = version.split('.')[0]!;
  if (major.length === 0 || !/^[0-9]+$/.test(major)) {
    throw new UnknownContractMajorError(`api/index.json: version '${version}' has no numeric contract major`);
  }
  if (!SUPPORTED_CONTRACT_MAJORS.has(major)) {
    throw new UnknownContractMajorError(
      `api/index.json: contract major '${major}' is not supported (supported: ${[...SUPPORTED_CONTRACT_MAJORS].join(', ')})`,
    );
  }
}

function guardPage(value: unknown, path: string): AgentPagePayload {
  assertPageShape(value, path);
  return value;
}

function guardScenarios(value: unknown, path: string): ScenarioIndex {
  assertScenariosShape(value, path);
  return value;
}

/**
 * The pinned projection: identity from the record's artifact ref; the legacy
 * home-record empty section value lands on the synthesized site root section
 * (id '', see resolveSections); keywords/markdown pass through from the
 * per-page artifact, never derived.
 */
function projectPage(
  record: AgentIndex['pages'][number],
  artifact: AgentPagePayload,
  raw: string,
  ref: PageArtifactRef,
): SnapshotPage {
  return {
    id: ref.id,
    ref: ref.href,
    section: record.section,
    title: record.title,
    description: record.description,
    keywords: artifact.keywords,
    links: record._links,
    markdown: artifact.markdown,
    docStatus: record.doc_status,
    record,
    artifact,
    raw,
  };
}

/**
 * buildId compare-all (FR-008): every artifact that carries the field must
 * equal the reference identity (the index's buildId; the first carrier's when
 * a corpus carries it on pages alone - torn either way). No carrier anywhere
 * (a pre-FR-008 corpus) loads with a warning (migration allowance). Partial
 * presence warns too; carriers are still compared.
 */
function compareBuildIdentity(
  index: AgentIndex,
  pages: SnapshotPage[],
  scenarios: ScenarioIndex | undefined,
  log?: LoadLogger,
): string | undefined {
  const carriers: Array<{ path: string; buildId: string }> = [];
  if (index.buildId !== undefined) carriers.push({ path: 'api/index.json', buildId: index.buildId });
  for (const page of pages) {
    if (page.artifact.buildId !== undefined) {
      carriers.push({ path: `${PAGES_PREFIX}${page.id}.json`, buildId: page.artifact.buildId });
    }
  }
  if (scenarios?.buildId !== undefined) carriers.push({ path: 'api/scenarios.json', buildId: scenarios.buildId });

  const accepting = 1 + pages.length + (scenarios === undefined ? 0 : 1);
  if (carriers.length === 0) {
    log?.({
      phase: 'snapshot',
      event: 'warning',
      message: `no buildId on any of ${accepting} artifacts (pre-FR-008 corpus) - loading without torn-corpus detection (migration allowance)`,
    });
    return undefined;
  }
  if (carriers.length < accepting) {
    log?.({
      phase: 'snapshot',
      event: 'warning',
      message: `buildId present on ${carriers.length} of ${accepting} artifacts - torn-corpus detection covers carriers only`,
    });
  }
  const reference = carriers[0]!;
  for (const carrier of carriers.slice(1)) {
    if (carrier.buildId !== reference.buildId) {
      throw new BuildIdentityMismatchError(
        `${carrier.path}: buildId ${carrier.buildId} != ${reference.path}'s ${reference.buildId} - torn corpus read, refusing to become ready`,
      );
    }
  }
  return reference.buildId;
}

/**
 * Sections listing with the two pinned tolerances: absent `sections[]` (a
 * pre-WP01 corpus) yields an empty listing, and the legacy home-record empty
 * section value maps to the site root section - a single synthesized section
 * with the well-known empty id, prepended, never invented by content.
 *
 * Record `section` values are passed through UNVALIDATED against the listing:
 * the registry is a display overlay, not an enumeration - a real corpus can
 * legitimately carry folders the registry never lists (the example site's
 * `glossary-demo/` folder is exactly such a case, on purpose). A mismatch is
 * a data quirk of the site, not a malformed corpus.
 */
function resolveSections(index: AgentIndex, log?: LoadLogger): Section[] {
  const emitted: Section[] = (index.sections ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    order: s.order,
    ...(s.purpose === undefined ? {} : { purpose: s.purpose }),
  }));
  if (index.sections === undefined) {
    log?.({
      phase: 'snapshot',
      event: 'warning',
      message: 'index carries no sections[] (pre-WP01 corpus) - section listing is empty',
    });
  }
  const known = new Set(emitted.map((s) => s.id));
  const hasRootMembers = index.pages.some((record) => record.section === '');
  if (hasRootMembers && !known.has('')) {
    return [{ id: '', label: '', order: 0 }, ...emitted];
  }
  return emitted;
}

/**
 * The contract-pinned site slug (contracts/mcp-surface.md, Resources): the
 * launch base lowercased, scheme and trailing slash dropped, non-alphanumerics
 * collapsed to `-`. Two servers over the same site must mint identical ids.
 */
export function siteSlugFor(launchBase: string): string {
  let value = launchBase.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  value = value.replace(/\/+$/, ''); // trailing slashes
  value = value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return value;
}
